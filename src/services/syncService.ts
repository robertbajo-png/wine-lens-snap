import type { TablesInsert } from "@/integrations/supabase/types";
import { logEvent } from "@/lib/logger";
import { supabase } from "@/lib/supabaseClient";
import { getPendingScans, markSynced, type LocalScanPayload } from "./scanLocalStore";

type RemoteScanRecord = {
  id: string;
  label_hash: string | null;
  created_at: string | null;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
};

const serializeAnalysisJson = (payload: unknown): TablesInsert<"scans">["analysis_json"] => {
  try {
    return JSON.parse(JSON.stringify(payload ?? null));
  } catch (_error) {
    return null;
  }
};

const buildRemoteIndex = async (pending: LocalScanPayload[]): Promise<Map<string, RemoteScanRecord[]>> => {
  const labelHashes = Array.from(
    new Set(pending.map((scan) => scan.label_hash).filter((hash): hash is string => Boolean(hash))),
  );

  if (labelHashes.length === 0) {
    return new Map();
  }

  const timestamps = pending
    .map((scan) => toTimestamp(scan.created_at))
    .filter((value): value is number => value !== null);

  const query = supabase.from("scans").select("id,label_hash,created_at").in("label_hash", labelHashes);

  const { data, error } =
    timestamps.length === 0
      ? await query
      : await query
          .gte("created_at", new Date(Math.min(...timestamps) - FIVE_MINUTES_MS).toISOString())
          .lte("created_at", new Date(Math.max(...timestamps) + FIVE_MINUTES_MS).toISOString());

  if (error) {
    throw new Error(`Failed to load remote scans: ${error.message}`);
  }

  const grouped = new Map<string, RemoteScanRecord[]>();
  for (const record of data ?? []) {
    if (!record.label_hash) continue;
    const list = grouped.get(record.label_hash) ?? [];
    list.push(record);
    grouped.set(record.label_hash, list);
  }

  return grouped;
};

const findRemoteDuplicate = (
  scan: LocalScanPayload,
  remoteIndex: Map<string, RemoteScanRecord[]>,
): string | null => {
  if (!scan.label_hash) return null;

  const scanTimestamp = toTimestamp(scan.created_at);
  if (scanTimestamp === null) {
    return null;
  }

  const candidates = remoteIndex.get(scan.label_hash) ?? [];
  for (const candidate of candidates) {
    const candidateTimestamp = toTimestamp(candidate.created_at);
    if (candidateTimestamp === null) {
      continue;
    }
    if (Math.abs(candidateTimestamp - scanTimestamp) <= FIVE_MINUTES_MS) {
      return candidate.id;
    }
  }

  return null;
};

const upsertScan = async (scan: LocalScanPayload, userId: string) => {
  const payload: TablesInsert<"scans"> = {
    id: scan.id,
    created_at: scan.created_at,
    label_hash: scan.label_hash,
    analysis_json: serializeAnalysisJson(scan.analysis_json),
    user_id: userId,
    image_thumb: null,
    raw_ocr: null,
    vintage: null,
  };

  const { error } = await supabase.from("scans").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
};

const syncSingleScan = async (scan: LocalScanPayload, userId: string) => {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < MAX_ATTEMPTS) {
    try {
      await upsertScan(scan, userId);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt += 1;
      if (attempt < MAX_ATTEMPTS) {
        await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError ?? new Error("Unknown sync failure");
};

export const syncPendingScans = async (
  userId: string,
): Promise<{
  synced: number;
  failed: number;
}> => {
  const pending = await getPendingScans();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let remoteIndex = new Map<string, RemoteScanRecord[]>();
  try {
    remoteIndex = await buildRemoteIndex(pending);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(error);
    }
  }

  let synced = 0;
  let failed = 0;

  for (const scan of pending) {
    try {
      const duplicateId = findRemoteDuplicate(scan, remoteIndex);
      if (!duplicateId) {
        await syncSingleScan(scan, userId);
      }

      await markSynced(scan.id);
      await logEvent("sync_scan_succeeded", { localId: scan.id, duplicate: Boolean(duplicateId) });
      synced += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";
      await logEvent("sync_scan_failed", { localId: scan.id, reason });
      failed += 1;
    }
  }

  return { synced, failed };
};
