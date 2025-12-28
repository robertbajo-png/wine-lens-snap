import type { Tables } from "@/integrations/supabase/types";
import { normalizeAnalysisJson } from "@/lib/analysisSchema";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { supabase } from "@/lib/supabaseClient";

export type TasteProfileEntry = {
  value: string;
  count: number;
};

export type TasteProfile = {
  grapes: TasteProfileEntry[];
  regions: TasteProfileEntry[];
  styles: TasteProfileEntry[];
  totalScans: number;
};

export type WineScan = Omit<Tables<"scans">, "analysis_json"> & {
  analysis_json: Partial<WineAnalysisResult> | null;
};

const splitCompositeField = (value: string): string[] =>
  value
    .split(/[,/|;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

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

const extractRegions = (rawRegion: unknown): string[] => {
  if (typeof rawRegion !== "string") return [];
  const trimmed = rawRegion.trim();
  if (!trimmed) return [];
  return splitCompositeField(trimmed);
};

const sortEntries = (counter: Map<string, TasteProfileEntry>): TasteProfileEntry[] =>
  Array.from(counter.values()).sort((a, b) => {
    if (b.count === a.count) {
      return a.value.localeCompare(b.value, "sv");
    }
    return b.count - a.count;
  });

export const buildTasteProfile = (scans: WineScan[]): TasteProfile => {
  const grapeCounts = new Map<string, TasteProfileEntry>();
  const regionCounts = new Map<string, TasteProfileEntry>();
  const styleCounts = new Map<string, TasteProfileEntry>();

  for (const scan of scans) {
    const analysis = normalizeAnalysisJson(scan.analysis_json as Partial<WineAnalysisResult> | null);
    if (!analysis) {
      continue;
    }

    for (const grape of analysis.grapes) {
      addCount(grapeCounts, grape);
    }

    for (const region of extractRegions(analysis.land_region)) {
      addCount(regionCounts, region);
    }

    if (analysis.style) {
      addCount(styleCounts, analysis.style);
    }
  }

  return {
    grapes: sortEntries(grapeCounts),
    regions: sortEntries(regionCounts),
    styles: sortEntries(styleCounts),
    totalScans: scans.length,
  };
};

export const getTasteProfileForUser = async (userId: string, limit = 50): Promise<TasteProfile> => {
  if (!userId) {
    return { grapes: [], regions: [], styles: [], totalScans: 0 };
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
      analysis_json: row.analysis_json as Partial<WineAnalysisResult> | null,
    })) ?? [];

  return buildTasteProfile(scans);
};
