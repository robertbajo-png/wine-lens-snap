import type { WineAnalysisResult } from "./wineCache";

const HISTORY_KEY = "wine_history";

export type HistoryEntry = {
  ts: string;
  vin?: string;
  producent?: string;
  land_region?: string;
  årgång?: string;
  meters?: WineAnalysisResult["meters"];
  evidence?: WineAnalysisResult["evidence"];
  _meta?: any;
};

export function getDeviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("device_id", id);
  }
  return id;
}

export function saveHistoryLocal(entry: HistoryEntry) {
  try {
    const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const updated = [entry, ...prev].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Kunde inte spara lokalt i historiken:", e);
  }
}

export async function syncHistoryRemote(entry: HistoryEntry) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase-konfiguration saknas; hoppar över historiksynk.");
    return;
  }

  const url = `${supabaseUrl}/functions/v1/history-sync`;
  const deviceId = getDeviceId();
  const payload = {
    ...entry,
    device_id: deviceId,
    meta: entry._meta ?? null,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
        "x-device-id": deviceId,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("history-sync misslyckades:", res.status, await res.text());
    }
  } catch (err) {
    console.warn("history-sync fel:", err);
  }
}

export async function saveHistory(entry: HistoryEntry) {
  saveHistoryLocal(entry);
  syncHistoryRemote(entry);
}
