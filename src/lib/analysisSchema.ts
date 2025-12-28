import { normalizeEvidenceItems } from "./evidence";
import type { WineAnalysisResult } from "./wineCache";

export type AnalysisMode = "label_only" | "label+web";

export interface AnalysisJsonFields {
  mode: AnalysisMode;
  confidence: number;
  sources: string[];
  summary: string;
  grapes: string[];
  style: string | null;
  food_pairings: string[];
  warnings: string[];
}

export const DEFAULT_ANALYSIS_MODE: AnalysisMode = "label_only";
export const DEFAULT_ANALYSIS_CONFIDENCE = 0.4;

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

const parseGrapeList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return normalizeStringArray(value);
  }

  if (typeof value !== "string") return [];

  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export function normalizeAnalysisJson<T extends Partial<WineAnalysisResult> | null | undefined>(
  analysis: T,
): (T & AnalysisJsonFields) | null {
  if (!analysis || typeof analysis !== "object") {
    return null;
  }

  const mode: AnalysisMode = analysis.mode === "label+web" || analysis.mode === "label_only"
    ? analysis.mode
    : DEFAULT_ANALYSIS_MODE;

  const confidenceValue = typeof analysis.confidence === "number" ? analysis.confidence : DEFAULT_ANALYSIS_CONFIDENCE;
  const confidence = Math.min(1, Math.max(0, confidenceValue));

  const evidenceItems = normalizeEvidenceItems({
    evidence: (analysis as WineAnalysisResult).evidence,
    sourceStatus: (analysis as WineAnalysisResult).källstatus,
    ocrText: (analysis as WineAnalysisResult).originaltext,
    sources: (analysis as WineAnalysisResult).sources,
  });

  const sources = Array.from(
    new Set(
      evidenceItems
        .filter((item) => item.type === "web" && typeof item.url === "string")
        .map((item) => item.url as string),
    ),
  );
  const summary = typeof analysis.summary === "string"
    ? analysis.summary
    : typeof (analysis as WineAnalysisResult).karaktär === "string" && (analysis as WineAnalysisResult).karaktär.length > 0
      ? (analysis as WineAnalysisResult).karaktär
      : typeof (analysis as WineAnalysisResult).smak === "string"
        ? (analysis as WineAnalysisResult).smak
        : "";

  const grapes = parseGrapeList((analysis as WineAnalysisResult).grapes ?? (analysis as WineAnalysisResult).druvor);
  const style = typeof analysis?.style === "string"
    ? analysis.style
    : typeof (analysis as WineAnalysisResult).typ === "string" && (analysis as WineAnalysisResult).typ.length > 0
      ? (analysis as WineAnalysisResult).typ
      : typeof (analysis as WineAnalysisResult).färgtyp === "string"
        ? (analysis as WineAnalysisResult).färgtyp
        : null;

  const food_pairings = normalizeStringArray(
    analysis.food_pairings ?? (analysis as WineAnalysisResult).passar_till,
  );

  const warnings = normalizeStringArray(analysis.warnings);

  const evidence = {
    etiketttext: typeof (analysis as WineAnalysisResult).evidence?.etiketttext === "string"
      ? (analysis as WineAnalysisResult).evidence?.etiketttext ?? ""
      : typeof (analysis as WineAnalysisResult).originaltext === "string"
        ? (analysis as WineAnalysisResult).originaltext
        : "",
    webbträffar: sources,
    items: evidenceItems,
  };

  const källstatus = {
    source: evidenceItems.some((item) => item.type === "web" && item.url) ? "web" : "heuristic",
    evidence_links: evidenceItems,
  } as WineAnalysisResult["källstatus"];

  return {
    ...analysis,
    mode,
    confidence,
    sources,
    summary,
    grapes,
    style,
    food_pairings,
    warnings,
    evidence,
    källstatus,
  } as T & AnalysisJsonFields;
}
