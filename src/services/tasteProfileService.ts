import type { Tables } from "@/integrations/supabase/types";
import { normalizeAnalysisJson } from "@/lib/analysisSchema";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { supabase } from "@/lib/supabaseClient";

export type TasteProfileEntry = {
  value: string;
  count: number;
};

export type TasteProfile = {
  topGrapes: TasteProfileEntry[];
  topRegions: TasteProfileEntry[];
  topStyles: TasteProfileEntry[];
  topPairings: TasteProfileEntry[];
  avgSweetness: number | null;
  avgAcidity: number | null;
  avgTannin: number | null;
};

export type WineScan = Omit<Tables<"scans">, "analysis_json"> & {
  analysis_json: Partial<WineAnalysisResult> | string | null;
};

const splitCompositeField = (value: string): string[] =>
  value
    .split(/[,/|;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const normalizeToNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getMeterValue = (
  analysis: Partial<WineAnalysisResult> | null,
  candidateKeys: string[],
): number | null => {
  if (!analysis) return null;

  for (const key of candidateKeys) {
    const meterValue = normalizeToNumber((analysis as Record<string, unknown>)?.meters?.[key]);
    if (meterValue !== null) {
      return meterValue;
    }

    const directValue = normalizeToNumber((analysis as Record<string, unknown>)[key]);
    if (directValue !== null) {
      return directValue;
    }
  }

  return null;
};

const addCount = (counter: Map<string, TasteProfileEntry>, rawValue: string) => {
  const normalized = rawValue.trim();
  if (!normalized) {
    return;
  }

  const key = normalized.toLowerCase();
  const existing = counter.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }

  counter.set(key, { value: normalized, count: 1 });
};

const extractStringValues = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => (typeof value === "string" ? splitCompositeField(value) : []))
      .filter((value) => value.trim().length > 0);
  }

  if (typeof raw === "string") {
    return splitCompositeField(raw);
  }

  return [];
};

const extractRegions = (rawRegion: unknown): string[] => {
  if (typeof rawRegion !== "string") return [];
  const trimmed = rawRegion.trim();
  if (!trimmed) return [];
  return splitCompositeField(trimmed);
};

const parseAnalysisPayload = (
  analysis: WineScan["analysis_json"],
): Partial<WineAnalysisResult> | null => {
  if (analysis === null || analysis === undefined) {
    return null;
  }

  let candidate: unknown = analysis;

  if (typeof analysis === "string") {
    try {
      candidate = JSON.parse(analysis);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return null;
  }

  const recordCandidate = { ...(candidate as Record<string, unknown>) };
  let normalizedGrapes = extractStringValues(recordCandidate.grapes);
  if (normalizedGrapes.length === 0) {
    normalizedGrapes = extractStringValues((recordCandidate as Record<string, unknown>).druvor);
  }
  if (normalizedGrapes.length > 0) {
    recordCandidate.grapes = normalizedGrapes;
  }

  const normalizedPairings = extractStringValues(
    recordCandidate.food_pairings ?? (recordCandidate as Record<string, unknown>).passar_till,
  );
  if (normalizedPairings.length > 0) {
    recordCandidate.food_pairings = normalizedPairings;
  }

  const meters = recordCandidate.meters;
  if (meters && typeof meters === "object" && !Array.isArray(meters)) {
    const normalizedMeters: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(meters as Record<string, unknown>)) {
      normalizedMeters[key] = normalizeToNumber(value);
    }
    recordCandidate.meters = normalizedMeters;
  }

  return recordCandidate as Partial<WineAnalysisResult>;
};

const normalizeScanAnalysis = (analysis: WineScan["analysis_json"]) =>
  normalizeAnalysisJson(parseAnalysisPayload(analysis));

const sortEntries = (counter: Map<string, TasteProfileEntry>): TasteProfileEntry[] =>
  Array.from(counter.values()).sort((a, b) => {
    if (b.count === a.count) {
      return a.value.localeCompare(b.value, "sv");
    }
    return b.count - a.count;
  });

const computeAverage = (sum: number, count: number): number | null =>
  count > 0 ? Math.round((sum / count) * 100) / 100 : null;

const EMPTY_TASTE_PROFILE: TasteProfile = {
  topGrapes: [],
  topRegions: [],
  topStyles: [],
  topPairings: [],
  avgSweetness: null,
  avgAcidity: null,
  avgTannin: null,
};

export const buildTasteProfile = (scans: WineScan[]): TasteProfile => {
  const grapeCounts = new Map<string, TasteProfileEntry>();
  const regionCounts = new Map<string, TasteProfileEntry>();
  const styleCounts = new Map<string, TasteProfileEntry>();
  const pairingCounts = new Map<string, TasteProfileEntry>();

  let sweetnessSum = 0;
  let sweetnessCount = 0;
  let aciditySum = 0;
  let acidityCount = 0;
  let tanninSum = 0;
  let tanninCount = 0;

  for (const scan of scans) {
    const analysis = normalizeScanAnalysis(scan.analysis_json);
    if (!analysis) {
      continue;
    }

    extractStringValues(analysis.grapes).forEach((grape) => addCount(grapeCounts, grape));
    extractRegions(analysis.land_region).forEach((region) => addCount(regionCounts, region));
    extractStringValues(analysis.style).forEach((style) => addCount(styleCounts, style));
    extractStringValues((analysis as Record<string, unknown>).food_pairings).forEach((pairing) =>
      addCount(pairingCounts, pairing),
    );

    const sweetnessValue = getMeterValue(analysis, ["sötma", "sweetness"]);
    if (sweetnessValue !== null) {
      sweetnessSum += sweetnessValue;
      sweetnessCount += 1;
    }

    const acidityValue = getMeterValue(analysis, ["fruktsyra", "acidity"]);
    if (acidityValue !== null) {
      aciditySum += acidityValue;
      acidityCount += 1;
    }

    const tanninValue = getMeterValue(analysis, ["tannin", "tannins", "strävhet", "stravhet"]);
    if (tanninValue !== null) {
      tanninSum += tanninValue;
      tanninCount += 1;
    }
  }

  return {
    topGrapes: sortEntries(grapeCounts),
    topRegions: sortEntries(regionCounts),
    topStyles: sortEntries(styleCounts),
    topPairings: sortEntries(pairingCounts),
    avgSweetness: computeAverage(sweetnessSum, sweetnessCount),
    avgAcidity: computeAverage(aciditySum, acidityCount),
    avgTannin: computeAverage(tanninSum, tanninCount),
  };
};

export const getTasteProfileForUser = async (userId: string, limit = 50): Promise<TasteProfile> => {
  if (!userId) {
    return EMPTY_TASTE_PROFILE;
  }

  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;

  const { data, error } = await supabase
    .from("scans")
    .select("id,created_at,analysis_json,image_thumb,label_hash,raw_ocr,user_id,vintage")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(resolvedLimit);

  if (error) {
    throw new Error(`Failed to fetch scans: ${error.message}`);
  }

  const scans: WineScan[] =
    data?.map((row) => ({
      ...row,
      analysis_json: row.analysis_json as WineScan["analysis_json"],
    })) ?? [];

  if (!Array.isArray(scans) || scans.length === 0) {
    return EMPTY_TASTE_PROFILE;
  }

  return buildTasteProfile(scans);
};
