import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import {
  WINE_CACHE_UPDATED_EVENT,
  getAnalysesPendingSync,
  markAnalysesReadyForSync,
  markAnalysisSynced,
} from "@/lib/wineCache";
import { syncLocalScans } from "@/services/sync";

export const useSyncScans = (user: User | null) => {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const runSync = async () => {
      if (cancelled || syncingRef.current) {
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }

      const pending = getAnalysesPendingSync();
      if (pending.length === 0) {
        return;
      }

      syncingRef.current = true;
      try {
        const { inserted, duplicates } = await syncLocalScans(pending);
        [...inserted, ...duplicates].forEach(({ key, remoteId }) => {
          markAnalysisSynced(key, remoteId);
        });
      } catch (error) {
        console.error("Failed to sync scans", error);
      } finally {
        syncingRef.current = false;
      }
    };

    markAnalysesReadyForSync();
    void runSync();

    const handleOnline = () => {
      markAnalysesReadyForSync();
      void runSync();
    };

    const handleCacheUpdate = () => {
      markAnalysesReadyForSync();
      void runSync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener(WINE_CACHE_UPDATED_EVENT, handleCacheUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(WINE_CACHE_UPDATED_EVENT, handleCacheUpdate);
    };
  }, [user]);
};
