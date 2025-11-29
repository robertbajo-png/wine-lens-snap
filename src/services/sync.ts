import type { TablesInsert, Json } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabaseClient";
import type { CachedWineAnalysisEntry } from "@/lib/wineCache";
import { computeLabelHash } from "@/lib/wineCache";
import { normalizeAnalysisJson } from "@/lib/analysisSchema";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export type SyncResult = {
  inserted: { key: string; remoteId: string }[];
  duplicates: { key: string; remoteId: string }[];
};

type SyncCandidate = {
  entry: CachedWineAnalysisEntry;
  labelHash: string | null;
  rawOcr: string | null;
  timestampIso: string;
  timestampMs: number;
  remoteId?: string;
};

type RemoteScanRecord = {
  id: string;
  label_hash: string | null;
  created_at: string | null;
};

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function parseVintage(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isNaN(year) ? null : year;
}

function resolveRawOcr(entry: CachedWineAnalysisEntry): string | null {
  return (
    entry.ocrText ??
    entry.result.originaltext ??
    entry.result.evidence?.etiketttext ??
    null
  );
}

function resolveLabelHash(entry: CachedWineAnalysisEntry): string | null {
  if (entry.labelHash) {
    return entry.labelHash;
  }

  const candidates = [
    entry.ocrText,
    entry.result.originaltext,
    entry.result.evidence?.etiketttext,
    entry.result.vin,
  ];

  for (const candidate of candidates) {
    const hash = computeLabelHash(candidate);
    if (hash) {
      return hash;
    }
  }

  return null;
}

function groupRemoteScans(records: RemoteScanRecord[]): Map<string, RemoteScanRecord[]> {
  const grouped = new Map<string, RemoteScanRecord[]>();
  for (const record of records) {
    if (!record.label_hash) continue;
    const list = grouped.get(record.label_hash) ?? [];
    list.push(record);
    grouped.set(record.label_hash, list);
  }
  return grouped;
}

export async function syncLocalScans(entries: CachedWineAnalysisEntry[]): Promise<SyncResult> {
  if (entries.length === 0) {
    return { inserted: [], duplicates: [] };
  }

  const candidates = entries
    .map<SyncCandidate | null>((entry) => {
      const timestampMs = parseTimestamp(entry.timestamp);
      if (timestampMs === null) {
        return null;
      }
      return {
        entry,
        labelHash: resolveLabelHash(entry),
        rawOcr: resolveRawOcr(entry),
        timestampIso: entry.timestamp,
        timestampMs,
      };
    })
    .filter((candidate): candidate is SyncCandidate => candidate !== null)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (candidates.length === 0) {
    return { inserted: [], duplicates: [] };
  }

  const labelHashes = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.labelHash)
        .filter((hash): hash is string => Boolean(hash)),
    ),
  );

  let remoteGrouped = new Map<string, RemoteScanRecord[]>();
  if (labelHashes.length > 0) {
    const { data, error } = await supabase
      .from("scans")
      .select("id,label_hash,created_at")
      .in("label_hash", labelHashes);
    if (error) {
      throw new Error(`Failed to fetch remote scans: ${error.message}`);
    }
    remoteGrouped = groupRemoteScans(data ?? []);
  }

  const insertedCandidates: SyncCandidate[] = [];
  const duplicatesExisting: SyncResult['duplicates'] = [];
  const duplicatesLocal: { key: string; matchKey: string }[] = [];

  for (const candidate of candidates) {
    if (candidate.labelHash) {
      const remoteRecords = remoteGrouped.get(candidate.labelHash) ?? [];
      const remoteDuplicate = remoteRecords.find((record) => {
        const remoteMs = parseTimestamp(record.created_at);
        if (remoteMs === null) {
          return false;
        }
        return Math.abs(remoteMs - candidate.timestampMs) <= FIVE_MINUTES_MS;
      });

      if (remoteDuplicate) {
        duplicatesExisting.push({ key: candidate.entry.key, remoteId: remoteDuplicate.id });
        continue;
      }

      const localDuplicate = insertedCandidates.find((existing) => {
        if (existing.labelHash !== candidate.labelHash) {
          return false;
        }
        return Math.abs(existing.timestampMs - candidate.timestampMs) <= FIVE_MINUTES_MS;
      });

      if (localDuplicate) {
        duplicatesLocal.push({ key: candidate.entry.key, matchKey: localDuplicate.entry.key });
        continue;
      }
    }

    candidate.remoteId = generateUuid();
    insertedCandidates.push(candidate);
  }

  const insertPayloads = insertedCandidates.map((candidate) => {
    const normalizedResult = normalizeAnalysisJson(candidate.entry.result) ?? candidate.entry.result;
    return {
      id: candidate.remoteId,
      label_hash: candidate.labelHash ?? null,
      raw_ocr: candidate.rawOcr,
      image_thumb: candidate.entry.imageData ?? null,
      analysis_json: normalizedResult as unknown as Json,
      vintage: parseVintage(normalizedResult.årgång),
      created_at: candidate.timestampIso,
    };
  });

  if (insertPayloads.length > 0) {
    const { error } = await supabase.from("scans").insert(insertPayloads);
    if (error) {
      throw new Error(`Failed to sync scans: ${error.message}`);
    }
  }

  const inserted = insertedCandidates.map((candidate) => ({
    key: candidate.entry.key,
    remoteId: candidate.remoteId as string,
  }));

  const insertedMap = new Map(inserted.map((item) => [item.key, item.remoteId]));
  const duplicates = [
    ...duplicatesExisting,
    ...duplicatesLocal
      .map((item) => {
        const remoteId = insertedMap.get(item.matchKey);
        return remoteId ? { key: item.key, remoteId } : null;
      })
      .filter((value): value is { key: string; remoteId: string } => Boolean(value)),
  ];

  return { inserted, duplicates };
}
