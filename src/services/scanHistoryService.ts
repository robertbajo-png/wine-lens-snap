import type { Json, Database } from "@/integrations/supabase/types";
import { computeLabelHash, getCacheKey, setAnalysisSavedState, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
import { supabase } from "@/lib/supabaseClient";

const parseVintageFromString = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{4}/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeRawText = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "–") {
    return null;
  }
  return trimmed;
};

export const saveScanToHistory = async (results: WineAnalysisResult) => {
  const { saveHistory } = await import("@/lib/history");
  await saveHistory({
    ts: new Date().toISOString(),
    vin: results.vin,
    producent: results.producent,
    land_region: results.land_region,
    årgång: results.årgång,
    meters: results.meters,
    evidence: results.evidence,
    _meta: results._meta ?? null,
  });
};

type ScanInsert = Database["public"]["Tables"]["scans"]["Insert"];

type RemoteScanParams = {
  results: WineAnalysisResult;
  previewImage: string | null;
};

export const createRemoteScan = async ({ results, previewImage }: RemoteScanParams): Promise<string> => {
  const rawTextCandidate =
    normalizeRawText(results.originaltext) ?? normalizeRawText(results.evidence?.etiketttext) ?? null;
  const labelHash = computeLabelHash(rawTextCandidate ?? results.vin ?? null);
  const { data, error } = await supabase
    .from("scans")
    .insert([
      {
        label_hash: labelHash,
        raw_ocr: rawTextCandidate,
        image_thumb: previewImage,
        analysis_json: results as unknown as Json,
        vintage: parseVintageFromString(results.årgång),
      } satisfies ScanInsert,
    ])
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Kunde inte spara skanningen.");
  }

  return data.id;
};

type SaveWineParams = {
  currentCacheKey: string;
  currentOcrText: string | null;
  previewImage: string | null;
  remoteScanId: string | null;
  results: WineAnalysisResult;
};

export const saveWineLocally = ({
  currentCacheKey,
  currentOcrText,
  previewImage,
  remoteScanId,
  results,
}: SaveWineParams) => {
  const updated = setAnalysisSavedState(currentCacheKey, true);
  if (!updated) {
    const keySource = currentOcrText ?? currentCacheKey;
    const derivedLabelHash = computeLabelHash(keySource ?? results.originaltext ?? results.vin ?? null);
    setCachedAnalysis(keySource, results, {
      imageData: previewImage ?? undefined,
      rawOcr: currentOcrText,
      remoteId: remoteScanId,
      labelHash: derivedLabelHash ?? undefined,
      saved: true,
    });
    return getCacheKey(keySource);
  }

  return currentCacheKey;
};

type RemoveWineParams = {
  currentCacheKey: string;
};

export const removeWineLocally = ({ currentCacheKey }: RemoveWineParams) =>
  setAnalysisSavedState(currentCacheKey, false);

type PersistRefinedParams = {
  currentOcrText: string | null;
  isSaved: boolean;
  previewImage: string | null;
  remoteScanId: string | null;
  results: WineAnalysisResult | null;
  updated: WineAnalysisResult;
};

export const persistRefinedAnalysis = ({
  currentOcrText,
  isSaved,
  previewImage,
  remoteScanId,
  results,
  updated,
}: PersistRefinedParams) => {
  const keySource = currentOcrText ?? results?.originaltext ?? results?.vin ?? null;
  if (!keySource) return;

  setCachedAnalysis(keySource, updated, {
    imageData: previewImage ?? undefined,
    rawOcr: currentOcrText,
    remoteId: remoteScanId,
    saved: isSaved,
  });
};
