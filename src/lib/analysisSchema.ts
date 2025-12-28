import { z } from "zod";

import { normalizeEvidenceItems } from "./evidence";
import { trackEvent } from "./telemetry";
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

const evidenceItemSchema = z.object({
  field: z.string(),
  type: z.enum(["label", "web", "heuristic"]),
  title: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  snippet: z.string().optional().nullable(),
});

export const analysisSchema = z.object({
  vin: z.string().optional(),
  land_region: z.string().optional(),
  producent: z.string().optional(),
  druvor: z.string().optional(),
  årgång: z.string().optional(),
  typ: z.string().optional(),
  färgtyp: z.string().optional(),
  klassificering: z.string().optional(),
  alkoholhalt: z.string().optional(),
  volym: z.string().optional(),
  karaktär: z.string().optional(),
  smak: z.string().optional(),
  passar_till: z.array(z.string()).optional(),
  servering: z.string().optional(),
  sockerhalt: z.string().optional(),
  syra: z.string().optional(),
  källa: z.string().optional(),
  meters: z.object({
    sötma: z.number().nullable().optional(),
    fyllighet: z.number().nullable().optional(),
    fruktighet: z.number().nullable().optional(),
    fruktsyra: z.number().nullable().optional(),
  }).partial().optional(),
  evidence: z.object({
    etiketttext: z.string().optional(),
    webbträffar: z.array(z.string()).optional(),
    items: z.array(evidenceItemSchema).optional(),
  }).partial().optional(),
  källstatus: z.object({
    source: z.enum(["web", "heuristic"]).optional(),
    evidence_links: z.array(evidenceItemSchema).optional(),
  }).partial().optional(),
  mode: z.enum(["label_only", "label+web"]).optional(),
  confidence: z.number().optional(),
  sources: z.array(z.string()).optional(),
  summary: z.string().optional(),
  grapes: z.array(z.string()).optional(),
  style: z.string().nullable().optional(),
  food_pairings: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  _meta: z.record(z.unknown()).optional(),
  detekterat_språk: z.string().optional(),
  originaltext: z.string().optional(),
}).passthrough();

const buildFallbackAnalysis = (): Partial<WineAnalysisResult> => ({
  vin: "",
  land_region: "",
  producent: "",
  druvor: "",
  årgång: "",
  typ: "",
  färgtyp: "",
  klassificering: "",
  alkoholhalt: "",
  volym: "",
  karaktär: "",
  smak: "",
  passar_till: [],
  servering: "",
  sockerhalt: "",
  syra: "",
  källa: "",
  meters: {
    sötma: null,
    fyllighet: null,
    fruktighet: null,
    fruktsyra: null,
  },
  evidence: {
    etiketttext: "",
    webbträffar: [],
    items: [],
  },
  källstatus: {
    source: "heuristic",
    evidence_links: [],
  },
  mode: DEFAULT_ANALYSIS_MODE,
  confidence: DEFAULT_ANALYSIS_CONFIDENCE,
  sources: [],
  summary: "",
  grapes: [],
  style: null,
  food_pairings: [],
  warnings: [],
});

const logAnalysisParseFailure = (issues: string[], received: unknown) => {
  try {
    trackEvent("analysis_parse_failed", {
      issues,
      receivedType: typeof received,
    });
  } catch (error) {
    console.warn("analysis_parse_failed telemetry failed", error);
  }
};

export const parseAnalysisJson = (
  analysis: Partial<WineAnalysisResult> | null | undefined | unknown,
): Partial<WineAnalysisResult> | null => {
  if (analysis === null || analysis === undefined) {
    return null;
  }

  const parsed = analysisSchema.safeParse(analysis);

  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues.slice(0, 5).map((issue) => {
    const path = issue.path.join(".") || "root";
    return `${path}: ${issue.message}`;
  });
  logAnalysisParseFailure(issues, analysis);

  return buildFallbackAnalysis();
};

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

export function normalizeAnalysisJson(
  analysis: Partial<WineAnalysisResult> | null | undefined,
): (Partial<WineAnalysisResult> & AnalysisJsonFields) | null {
  const parsedAnalysis = parseAnalysisJson(analysis);
  if (!parsedAnalysis) return null;

  const mode: AnalysisMode = parsedAnalysis.mode === "label+web" || parsedAnalysis.mode === "label_only"
    ? parsedAnalysis.mode
    : DEFAULT_ANALYSIS_MODE;

  const confidenceValue = typeof parsedAnalysis.confidence === "number"
    ? parsedAnalysis.confidence
    : DEFAULT_ANALYSIS_CONFIDENCE;
  const confidence = Math.min(1, Math.max(0, confidenceValue));

  const evidenceItems = normalizeEvidenceItems({
    evidence: (parsedAnalysis as WineAnalysisResult).evidence,
    sourceStatus: (parsedAnalysis as WineAnalysisResult).källstatus,
    ocrText: (parsedAnalysis as WineAnalysisResult).originaltext,
    sources: (parsedAnalysis as WineAnalysisResult).sources,
  });

  const sources = Array.from(
    new Set(
      evidenceItems
        .filter((item) => item.type === "web" && typeof item.url === "string")
        .map((item) => item.url as string),
    ),
  );
  const summary = typeof parsedAnalysis.summary === "string"
    ? parsedAnalysis.summary
    : typeof (parsedAnalysis as WineAnalysisResult).karaktär === "string"
        && (parsedAnalysis as WineAnalysisResult).karaktär.length > 0
      ? (parsedAnalysis as WineAnalysisResult).karaktär
      : typeof (parsedAnalysis as WineAnalysisResult).smak === "string"
        ? (parsedAnalysis as WineAnalysisResult).smak
        : "";

  const grapes = parseGrapeList(
    (parsedAnalysis as WineAnalysisResult).grapes ?? (parsedAnalysis as WineAnalysisResult).druvor,
  );
  const style = typeof parsedAnalysis?.style === "string"
    ? parsedAnalysis.style
    : typeof (parsedAnalysis as WineAnalysisResult).typ === "string"
        && (parsedAnalysis as WineAnalysisResult).typ.length > 0
      ? (parsedAnalysis as WineAnalysisResult).typ
      : typeof (parsedAnalysis as WineAnalysisResult).färgtyp === "string"
        ? (parsedAnalysis as WineAnalysisResult).färgtyp
        : null;

  const food_pairings = normalizeStringArray(
    parsedAnalysis.food_pairings ?? (parsedAnalysis as WineAnalysisResult).passar_till,
  );

  const warnings = normalizeStringArray(parsedAnalysis.warnings);

  const evidence = {
    etiketttext: typeof (parsedAnalysis as WineAnalysisResult).evidence?.etiketttext === "string"
      ? (parsedAnalysis as WineAnalysisResult).evidence?.etiketttext ?? ""
      : typeof (parsedAnalysis as WineAnalysisResult).originaltext === "string"
        ? (parsedAnalysis as WineAnalysisResult).originaltext
        : "",
    webbträffar: sources,
    items: evidenceItems,
  };

  const källstatus = {
    source: evidenceItems.some((item) => item.type === "web" && item.url) ? "web" : "heuristic",
    evidence_links: evidenceItems,
  } as WineAnalysisResult["källstatus"];

  return {
    ...parsedAnalysis,
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
  } as Partial<WineAnalysisResult> & AnalysisJsonFields;
}
