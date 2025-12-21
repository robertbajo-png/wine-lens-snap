import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import {
  WINE_CACHE_UPDATED_EVENT,
  getAnalysesPendingSync,
  markAnalysesReadyForSync,
  markAnalysisSynced,
} from "@/lib/wineCache";
import { trackEvent } from "@/lib/telemetry";
import { syncLocalScans } from "@/services/sync";

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const INITIAL_BACKOFF_MS = 5000;
export const SYNC_BACKOFF_INITIAL_MS = INITIAL_BACKOFF_MS;
export const SYNC_BACKOFF_MAX_MS = MAX_BACKOFF_MS;

type SyncCoordinatorDeps = {
  isOnline: () => boolean;
  getPending: typeof getAnalysesPendingSync;
  markReady: typeof markAnalysesReadyForSync;
  markSynced: typeof markAnalysisSynced;
  sync: typeof syncLocalScans;
  schedule: typeof window.setTimeout;
  clearSchedule: typeof window.clearTimeout;
  telemetry: typeof trackEvent;
};

export const createSyncCoordinator = (deps: SyncCoordinatorDeps) => {
  let syncing = false;
  let cancelled = false;
  let retryDelayMs = 0;
  let retryTimer: number | null = null;

  const scheduleRetry = () => {
    retryDelayMs = retryDelayMs === 0 ? INITIAL_BACKOFF_MS : Math.min(retryDelayMs * 2, MAX_BACKOFF_MS);
    deps.telemetry("sync_backoff_scheduled", { delayMs: retryDelayMs });
    retryTimer = deps.schedule(async () => {
      retryTimer = null;
      await runSync();
    }, retryDelayMs);
  };

  const runSync = async () => {
    if (cancelled || syncing) {
      return;
    }

    const pending = deps.getPending();
    if (pending.length === 0) {
      return;
    }

    if (!deps.isOnline()) {
      deps.telemetry("sync_offline_skip", { pending: pending.length });
      return;
    }

    syncing = true;
    try {
      deps.telemetry("sync_attempt", { pending: pending.length });
      const { inserted, duplicates } = await deps.sync(pending);
      [...inserted, ...duplicates].forEach(({ key, remoteId }) => {
        deps.markSynced(key, remoteId);
      });
      retryDelayMs = 0;
      deps.telemetry("sync_completed", { inserted: inserted.length, duplicates: duplicates.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.telemetry("sync_failed", { message });
      scheduleRetry();
    } finally {
      syncing = false;
    }
  };

  const notify = () => {
    if (cancelled) return;
    deps.markReady();
    void runSync();
  };

  const teardown = () => {
    cancelled = true;
    if (retryTimer !== null) {
      deps.clearSchedule(retryTimer);
      retryTimer = null;
    }
  };

  return { notify, teardown, runSync };
};

export const useSyncScans = (user: User | null) => {
  const coordinatorRef = useRef<ReturnType<typeof createSyncCoordinator> | null>(null);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return;
    }

    coordinatorRef.current = createSyncCoordinator({
      isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
      getPending: getAnalysesPendingSync,
      markReady: markAnalysesReadyForSync,
      markSynced: markAnalysisSynced,
      sync: syncLocalScans,
      schedule: window.setTimeout.bind(window),
      clearSchedule: window.clearTimeout.bind(window),
      telemetry: trackEvent,
    });

    coordinatorRef.current.notify();

    const handleEvent = () => coordinatorRef.current?.notify();

    window.addEventListener("online", handleEvent);
    window.addEventListener(WINE_CACHE_UPDATED_EVENT, handleEvent);

    return () => {
      coordinatorRef.current?.teardown();
      window.removeEventListener("online", handleEvent);
      window.removeEventListener(WINE_CACHE_UPDATED_EVENT, handleEvent);
    };
  }, [user]);
};
