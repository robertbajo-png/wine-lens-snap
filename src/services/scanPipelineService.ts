import {
  getCachedAnalysisEntry,
  getCacheKey,
  setCachedAnalysis,
  type WineAnalysisResult,
} from "@/lib/wineCache";
import { normalizeAnalysisJson as normalizeAnalysisSchema } from "@/lib/analysisSchema";
import { sha1Base64, getOcrCache, setOcrCache } from "@/lib/ocrCache";
import { prewarmOcr, ocrRecognize } from "@/lib/ocrWorker";
import {
  supportsOffscreenCanvas,
  runPipelineOnMain,
  type PipelineOptions,
  type PipelineProgress,
  type PipelineResult,
} from "@/lib/imagePipelineCore";
import { computeLabelHash } from "@/lib/wineCache";
import { trackEvent } from "@/lib/telemetry";

export const ANALYSIS_TIMEOUT_MS = 60000; // 60s to match edge function Gemini timeout

export type ProgressKey = "prep" | "ocr" | "analysis" | "done" | "error" | null;
export type ScanStatus = "idle" | "processing" | "success" | "error";

export type PipelineSource = { dataUrl: string; buffer: ArrayBuffer; type: string; orientation: number };

export type ScanPipelineProgress = {
  step: ProgressKey;
  percent: number | null;
  label: string | null;
  note: string | null;
};

export type ScanPipelineResult = {
  result: WineAnalysisResult;
  cacheKey: string;
  cacheLookupKey: string;
  rawOcrValue: string | null;
  noTextFound: boolean;
  analysisMode: "full" | "label_only";
  resolvedNote?: string | null;
  fromCache: boolean;
  savedFromCache: boolean;
  remoteScanId?: string | null;
  labelHash?: string | null;
  timings?: Record<string, unknown> | null;
};

export type RunFullScanPipelineParams = {
  source: PipelineSource;
  uiLang: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onProgress?: (progress: ScanPipelineProgress) => void;
  allowFullAnalysis?: boolean;
};

const MAX_FILE_SIDE = 2048;
const JPEG_QUALITY = 0.9;
const OCR_MIN_LENGTH = 10;

let workerRef: Worker | null = null;

const ensureWorker = () => {
  if (!workerRef) {
    workerRef = new Worker(new URL("../workers/imageWorker.ts", import.meta.url), { type: "module" });
  }
  return workerRef;
};

export const terminateScanWorker = () => {
  workerRef?.terminate();
  workerRef = null;
};

const runWorkerPipeline = async (
  bitmap: ImageBitmap,
  options: PipelineOptions,
  orientation: number | undefined,
  onProgress?: (progress: PipelineProgress) => void,
): Promise<PipelineResult> => {
  const worker = ensureWorker();

  return new Promise<PipelineResult>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === "progress" && onProgress) {
        onProgress({
          value: message.value,
          stage: message.stage,
          note: message.note,
        });
        return;
      }

      if (message.type === "result") {
        cleanup();
        const resultMessage = message as PipelineResult & { ok?: boolean };
        if (resultMessage.ok) {
          resolve(resultMessage);
        } else {
          reject(new Error("Bildprocessen misslyckades"));
        }
      }

      if (message.type === "error") {
        cleanup();
        reject(new Error(message.message || "Bildprocessen misslyckades"));
      }
    };

    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || "Bakgrundsprocessen misslyckades"));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    try {
      worker.postMessage(
        { type: "pipeline", bitmap, options, orientation },
        [bitmap],
      );
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

const toProgressState = (progress: PipelineProgress): ScanPipelineProgress => {
  const value = typeof progress.value === "number" && Number.isFinite(progress.value) ? progress.value : null;
  return {
    step: "prep",
    percent: value,
    label: "Skannar…",
    note: progress.note ?? "Skannar…",
  };
};

const callAnalysis = async (
  {
    supabaseUrl,
    supabaseAnonKey,
    ocrText,
    processedImage,
    noTextFound,
    uiLang,
    ocrKey,
    labelOnly,
  }: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    ocrText: string | null;
    processedImage: string;
    noTextFound: boolean;
    uiLang: string;
    ocrKey: string;
    labelOnly: boolean;
  },
): Promise<Response> => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), ANALYSIS_TIMEOUT_MS);
  const functionUrl = `${supabaseUrl}/functions/v1/wine-vision`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      ocrText,
      imageBase64: processedImage,
      noTextFound,
      uiLang,
      ocr_image_hash: ocrKey,
      skipCache: true,
      labelOnly,
    }),
    signal: abortController.signal,
  });
  clearTimeout(timeoutId);
  return response;
};

export const runFullScanPipeline = async ({
  source,
  uiLang,
  supabaseUrl,
  supabaseAnonKey,
  onProgress,
  allowFullAnalysis = true,
}: RunFullScanPipelineParams): Promise<ScanPipelineResult> => {
  await prewarmOcr(uiLang).catch(() => {
    // ignorerad förladdningsfail
  });

  const options: PipelineOptions = {
    autoCrop: { fallbackCropPct: 0.1 },
    preprocess: {
      maxSide: MAX_FILE_SIDE,
      quality: JPEG_QUALITY,
      grayscale: true,
      contrast: 1.12,
    },
  };

  const progressHandler = (update: PipelineProgress) => {
    onProgress?.(toProgressState(update));
  };

  let pipelineResult: PipelineResult;
  if (supportsOffscreenCanvas()) {
    try {
      const blob = new Blob([source.buffer], { type: source.type || "image/jpeg" });
      const bitmap = await createImageBitmap(blob);
      pipelineResult = await runWorkerPipeline(bitmap, options, source.orientation, progressHandler);
    } catch (workerError) {
      console.warn("Worker pipeline misslyckades, faller tillbaka på huvudtråden", workerError);
      pipelineResult = await runPipelineOnMain(source.dataUrl, options, progressHandler);
    }
  } else {
    pipelineResult = await runPipelineOnMain(source.dataUrl, options, progressHandler);
  }

  if (pipelineResult.bitmap) {
    pipelineResult.bitmap.close();
  }

  const processedImage = pipelineResult.base64;
  onProgress?.({ step: "ocr", note: "Läser text (OCR) …", percent: null, label: null });

  const ocrKey = await sha1Base64(processedImage);
  let ocrText = getOcrCache(ocrKey);
  if (!ocrText) {
    ocrText = await ocrRecognize(processedImage, uiLang);
    if (ocrText && ocrText.length >= 3) {
      setOcrCache(ocrKey, ocrText);
    }
  }

  const noTextFound = !ocrText || ocrText.length < OCR_MIN_LENGTH;
  const cacheLookupKey = !noTextFound && ocrText ? ocrText : processedImage;
  const cacheKey = getCacheKey(cacheLookupKey);
  const cachedEntry = getCachedAnalysisEntry(cacheLookupKey);
  if (cachedEntry) {
    const cachedResult = normalizeAnalysisSchema(cachedEntry.result) ?? cachedEntry.result;
    const cachedRawOcrValue = !noTextFound && ocrText ? ocrText : null;
    trackEvent("analysis_cache_hit", {
      hasOcr: Boolean(cachedRawOcrValue),
      saved: cachedEntry.saved,
    });
    return {
      result: cachedResult as WineAnalysisResult,
      cacheKey,
      cacheLookupKey,
      rawOcrValue: cachedRawOcrValue,
      noTextFound,
      analysisMode: (cachedResult as WineAnalysisResult).mode === "label_only" ? "label_only" : "full",
      fromCache: true,
      savedFromCache: cachedEntry.saved,
    };
  }

  onProgress?.({ step: "analysis", note: "Analyserar vinet …", percent: null, label: null });

  let response: Response | null = null;
  let analysisMode: "full" | "label_only" = allowFullAnalysis ? "full" : "label_only";

  try {
    response = await callAnalysis({
      supabaseUrl,
      supabaseAnonKey,
      ocrText,
      processedImage,
      noTextFound,
      uiLang,
      ocrKey,
      labelOnly: !allowFullAnalysis,
    });
  } catch (error) {
    if (allowFullAnalysis && error instanceof Error && error.name === "AbortError") {
      onProgress?.({ step: "analysis", label: "Etikettläge", note: "Webbsökning tog för lång tid – visar etikettinfo.", percent: 65 });
      analysisMode = "label_only";
      response = await callAnalysis({
        supabaseUrl,
        supabaseAnonKey,
        ocrText,
        processedImage,
        noTextFound,
        uiLang,
        ocrKey,
        labelOnly: true,
      });
    } else {
      throw error;
    }
  }

  if (!response) {
    throw new Error("Analysen kunde inte startas");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error("Rate limit överskriden – vänta en stund");
    }
    if (response.status === 402) {
      throw new Error("AI-krediter slut");
    }
    throw new Error(errorData?.error || `HTTP ${response.status}`);
  }

  const { ok, data, note, timings }: {
    ok: boolean;
    note?: string;
    timings?: Record<string, unknown> | null;
    data?: (Partial<WineAnalysisResult> & {
      meters?: WineAnalysisResult["meters"];
      evidence?: WineAnalysisResult["evidence"];
      _meta?: WineAnalysisResult["_meta"];
    }) | null;
  } = await response.json();
  const resolvedNote = analysisMode === "label_only" ? note ?? "label_only_fallback" : note;

  if (!ok) {
    throw new Error("Analys misslyckades");
  }

  if (!data) {
    throw new Error("Tomt svar från analysen");
  }

  const result: WineAnalysisResult = {
    vin: data.vin || "–",
    land_region: data.land_region || "–",
    producent: data.producent || "–",
    druvor: data.druvor || "–",
    årgång: data.årgång || "–",
    typ: data.typ || "–",
    färgtyp: data.färgtyp || "–",
    klassificering: data.klassificering || "–",
    alkoholhalt: data.alkoholhalt || "–",
    volym: data.volym || "–",
    karaktär: data.karaktär || "–",
    smak: data.smak || "–",
    passar_till: data.passar_till || [],
    servering: data.servering || "–",
    sockerhalt: data.sockerhalt || "–",
    syra: data.syra || "–",
    källa: data.källa || "–",
    mode: data.mode,
    confidence: typeof data.confidence === "number" ? data.confidence : undefined,
    sources: data.sources,
    summary: data.summary,
    grapes: data.grapes,
    style: data.style,
    food_pairings: data.food_pairings,
    warnings: data.warnings,
    meters:
      data.meters && typeof data.meters === "object"
        ? data.meters
        : { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null },
    evidence: data.evidence || { etiketttext: "", webbträffar: [] },
    källstatus: data.källstatus || { source: "heuristic", evidence_links: [] },
    detekterat_språk: data.detekterat_språk,
    originaltext: data.originaltext,
    _meta: data._meta,
  };

  const normalizedResult = normalizeAnalysisSchema(result) ?? result;
  const resolvedRemoteId =
    typeof data?._meta?.existing_scan_id === "string"
      ? data._meta.existing_scan_id
      : typeof data?._meta?.scan_id === "string"
        ? data._meta?.scan_id
        : undefined;
  const labelHashMeta = typeof data?._meta?.label_hash === "string" ? data._meta.label_hash : undefined;
  const rawOcrValue = !noTextFound && ocrText ? ocrText : null;
  const labelHash = labelHashMeta ?? computeLabelHash(rawOcrValue ?? cacheLookupKey);
  if (analysisMode === "label_only" && resolvedNote === "label_only_fallback") {
    trackEvent("analysis_label_only_fallback", {
      hasOcr: Boolean(rawOcrValue),
      note: resolvedNote,
    });
  }

  setCachedAnalysis(cacheLookupKey, normalizedResult as WineAnalysisResult, {
    imageData: processedImage,
    rawOcr: rawOcrValue,
    remoteId: resolvedRemoteId ?? null,
    labelHash,
    saved: false,
  });

  return {
    result: normalizedResult as WineAnalysisResult,
    cacheKey,
    cacheLookupKey,
    rawOcrValue: rawOcrValue ?? cacheLookupKey,
    noTextFound,
    analysisMode,
    resolvedNote,
    fromCache: false,
    savedFromCache: false,
    remoteScanId: resolvedRemoteId ?? null,
    labelHash,
    timings,
  };
};
