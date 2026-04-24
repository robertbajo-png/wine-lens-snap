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

export const ANALYSIS_TIMEOUT_MS = 120000; // 120s - edge function can take 60-90s with Perplexity + Gemini

export type ProgressKey = "prep" | "ocr" | "analysis" | "done" | "error" | null;
export type ScanStatus = "idle" | "processing" | "success" | "error";

export type ScanStage = "prep" | "ocr" | "analysis" | "network";

/**
 * Fel som kastas av pipeline med info om vilket delsteg som misslyckades.
 * Används av UI för att visa rätt felmeddelande och vägledning.
 */
export class ScanPipelineError extends Error {
  stage: ScanStage;
  cause?: unknown;
  status?: number;

  constructor(stage: ScanStage, message: string, options?: { cause?: unknown; status?: number }) {
    super(message);
    this.name = "ScanPipelineError";
    this.stage = stage;
    this.cause = options?.cause;
    this.status = options?.status;
  }
}

export type PipelineSource = { dataUrl: string; buffer: ArrayBuffer; type: string; orientation: number };

export type ScanPipelineProgress = {
  step: ProgressKey;
  percent: number | null;
  label: string | null;
  note: string | null;
};

export type ScanLogLevel = "info" | "warn" | "error";

export type ScanLogEntry = {
  id: string;
  timestamp: number;
  stage: ScanStage | "pipeline";
  level: ScanLogLevel;
  message: string;
  data?: Record<string, unknown> | null;
};

export type ScanLogEmitter = (entry: Omit<ScanLogEntry, "id" | "timestamp">) => void;

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
  onLogEvent?: ScanLogEmitter;
  allowFullAnalysis?: boolean;
};

const MAX_FILE_SIDE = 2560;  // Larger image = more details for OCR
const JPEG_QUALITY = 0.92;  // Higher quality for better text recognition
const OCR_MIN_LENGTH = 10;

/**
 * Validates OCR text quality on client-side.
 * If the text looks like garbage, returns false so server uses Gemini OCR instead.
 */
const isValidClientOcr = (text: string | null): boolean => {
  if (!text || text.length < 10) return false;
  
  // Check for garbage characters ratio - if too many weird symbols, reject
  const garbageChars = (text.match(/[|;{}\[\]<>@#$%&*_=+\\^~`]/g) || []).length;
  const totalChars = text.length;
  if (garbageChars / totalChars > 0.1) {
    console.log(`[Client OCR] Rejected: too many garbage chars (${garbageChars}/${totalChars})`);
    return false;
  }
  
  // Check for broken text patterns
  const brokenPatterns = /(\n.{1,2}\n)|(\n-\s)|(\s-\s\n)|([\|;]{2,})/g;
  if (brokenPatterns.test(text)) {
    console.log(`[Client OCR] Rejected: broken text patterns detected`);
    return false;
  }
  
  // Count substantial words (4+ letters, at least 70% alphabetic)
  const words = text.split(/\s+/).filter(w => {
    if (w.length < 4) return false;
    const letterCount = (w.match(/[a-zA-ZåäöÅÄÖéèêëàáâãæçñüúùûîïíìôóòõøœßđğışžćčšśźżłńţţ]/gi) || []).length;
    return letterCount >= w.length * 0.7;
  });
  
  if (words.length < 2) {
    console.log(`[Client OCR] Rejected: only ${words.length} substantial words`);
    return false;
  }
  
  console.log(`[Client OCR] Accepted: ${words.length} valid words in "${text.substring(0, 50)}..."`);
  return true;
};

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
  
  // Validate OCR text - if it looks like garbage, don't send it
  // Let the server run Gemini OCR instead
  const validatedOcrText = isValidClientOcr(ocrText) ? ocrText : null;
  const clientOcrRejected = ocrText && !validatedOcrText;
  
  if (clientOcrRejected) {
    console.log(`[callAnalysis] Client OCR rejected as garbage, server will use Gemini OCR`);
  }
  
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      ocrText: validatedOcrText,
      imageBase64: processedImage,
      noTextFound: noTextFound || clientOcrRejected,
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
  onLogEvent,
  allowFullAnalysis = true,
}: RunFullScanPipelineParams): Promise<ScanPipelineResult> => {
  const log: ScanLogEmitter = (entry) => {
    try {
      onLogEvent?.(entry);
    } catch {
      // ignore log emitter failures
    }
  };

  await prewarmOcr(uiLang).catch(() => {
    // ignorerad förladdningsfail
  });

  // DEBUG: Log original image size
  const originalSizeKB = Math.round(source.buffer.byteLength / 1024);
  console.log(`[scanPipeline] Original image: ${originalSizeKB}KB, type: ${source.type}`);
  log({
    stage: "prep",
    level: "info",
    message: `Startar bildförberedelse (${originalSizeKB} KB, ${source.type || "okänd typ"})`,
    data: { originalSizeKB, type: source.type, orientation: source.orientation },
  });

  const options: PipelineOptions = {
    autoCrop: null, // DISABLED for debugging - to see if auto-crop is cutting text
    preprocess: {
      maxSide: MAX_FILE_SIDE,
      quality: JPEG_QUALITY,
      grayscale: false,  // Keep color for better OCR accuracy
      contrast: 1.0,     // No contrast adjustment - preserve original details
    },
  };

  console.log(`[scanPipeline] Pipeline options:`, JSON.stringify(options));

  const progressHandler = (update: PipelineProgress) => {
    onProgress?.(toProgressState(update));
  };

  let pipelineResult: PipelineResult;
  let bitmapDims: { width: number; height: number } | null = null;
  try {
    if (supportsOffscreenCanvas()) {
      try {
        const blob = new Blob([source.buffer], { type: source.type || "image/jpeg" });
        const bitmap = await createImageBitmap(blob);
        bitmapDims = { width: bitmap.width, height: bitmap.height };
        console.log(`[scanPipeline] Bitmap created: ${bitmap.width}x${bitmap.height}`);
        pipelineResult = await runWorkerPipeline(bitmap, options, source.orientation, progressHandler);
      } catch (workerError) {
        console.warn("Worker pipeline misslyckades, faller tillbaka på huvudtråden", workerError);
        log({
          stage: "prep",
          level: "warn",
          message: "Worker-pipeline misslyckades – faller tillbaka på huvudtråden",
          data: { error: workerError instanceof Error ? workerError.message : String(workerError) },
        });
        pipelineResult = await runPipelineOnMain(source.dataUrl, options, progressHandler);
      }
    } else {
      pipelineResult = await runPipelineOnMain(source.dataUrl, options, progressHandler);
    }
  } catch (prepError) {
    log({
      stage: "prep",
      level: "error",
      message: prepError instanceof Error ? prepError.message : "Bildbearbetningen misslyckades",
      data: { error: String(prepError) },
    });
    throw new ScanPipelineError(
      "prep",
      prepError instanceof Error ? prepError.message : "Bildbearbetningen misslyckades",
      { cause: prepError },
    );
  }

  // DEBUG: Log processed image size
  const processedSizeKB = Math.round((pipelineResult.base64.length * 0.75) / 1024);
  console.log(`[scanPipeline] Processed image: ~${processedSizeKB}KB base64 (after pipeline)`);
  console.log(`[scanPipeline] Size change: ${originalSizeKB}KB -> ~${processedSizeKB}KB`);
  log({
    stage: "prep",
    level: "info",
    message: `Bild förberedd: ${originalSizeKB} KB → ~${processedSizeKB} KB`,
    data: {
      originalSizeKB,
      processedSizeKB,
      dimensions: bitmapDims,
    },
  });

  if (pipelineResult.bitmap) {
    pipelineResult.bitmap.close();
  }

  const processedImage = pipelineResult.base64;
  onProgress?.({ step: "ocr", note: "Läser text på etiketten (OCR)…", percent: null, label: "Läser etiketten" });
  log({ stage: "ocr", level: "info", message: "Startar OCR på bearbetad bild" });

  const ocrKey = await sha1Base64(processedImage);
  let ocrText = getOcrCache(ocrKey);
  let ocrFromCache = Boolean(ocrText);
  if (!ocrText) {
    try {
      ocrText = await ocrRecognize(processedImage, uiLang);
    } catch (ocrError) {
      log({
        stage: "ocr",
        level: "error",
        message: ocrError instanceof Error ? ocrError.message : "OCR misslyckades",
        data: { error: String(ocrError) },
      });
      throw new ScanPipelineError(
        "ocr",
        ocrError instanceof Error ? ocrError.message : "Kunde inte läsa text från etiketten",
        { cause: ocrError },
      );
    }
    if (ocrText && ocrText.length >= 3) {
      setOcrCache(ocrKey, ocrText);
    }
  }

  const noTextFound = !ocrText || ocrText.length < OCR_MIN_LENGTH;
  const cacheLookupKey = !noTextFound && ocrText ? ocrText : processedImage;
  const cacheKey = getCacheKey(cacheLookupKey);
  const cachedEntry = getCachedAnalysisEntry(cacheLookupKey);

  log({
    stage: "ocr",
    level: noTextFound ? "warn" : "info",
    message: noTextFound
      ? `OCR klar – ingen läsbar text hittades (${ocrText?.length ?? 0} tecken)`
      : `OCR klar – ${ocrText?.length ?? 0} tecken${ocrFromCache ? " (från cache)" : ""}`,
    data: {
      chars: ocrText?.length ?? 0,
      fromCache: ocrFromCache,
      preview: ocrText ? ocrText.slice(0, 200) : null,
      noTextFound,
    },
  });


  
  // Helper to check if a cached result has actual useful wine data
  const hasUsefulData = (result: WineAnalysisResult): boolean => {
    const vin = result.vin;
    const isEmptyVin = !vin || vin === '-' || vin === '–' || vin.trim() === '';
    if (isEmptyVin) return false;
    
    // Also check if we have at least some meaningful data
    const hasRegion = result.land_region && result.land_region !== '-' && result.land_region !== '–';
    const hasProducer = result.producent && result.producent !== '-' && result.producent !== '–';
    const hasGrapes = result.druvor && result.druvor !== '-' && result.druvor !== '–';
    
    return hasRegion || hasProducer || hasGrapes;
  };
  
  // Only use cache if it contains full analysis with actual useful data
  // Skip if: label_only mode, OR result has no useful data (empty/placeholder values)
  const shouldUseCache = cachedEntry && 
    cachedEntry.result.mode !== 'label_only' && 
    hasUsefulData(cachedEntry.result);
    
  if (shouldUseCache) {
    const cachedResult = normalizeAnalysisSchema(cachedEntry.result) ?? cachedEntry.result;
    const cachedRawOcrValue = !noTextFound && ocrText ? ocrText : null;
    trackEvent("analysis_cache_hit", {
      hasOcr: Boolean(cachedRawOcrValue),
      saved: cachedEntry.saved,
    });
    log({
      stage: "analysis",
      level: "info",
      message: "Träff i lokal analys-cache – hoppar över AI-anrop",
      data: { mode: cachedEntry.result.mode, saved: cachedEntry.saved },
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
  } else if (cachedEntry) {
    const reason = cachedEntry.result.mode === 'label_only' 
      ? 'label_only mode' 
      : 'no useful data in cached result';
    console.log(`[scanPipeline] Skipping cached result (${reason}), forcing fresh full analysis`);
    log({
      stage: "analysis",
      level: "warn",
      message: `Hoppar över cache (${reason}) – kör ny full analys`,
    });
  }

  onProgress?.({ step: "analysis", note: "AI analyserar vinet (kan ta upp till 90 sek)…", percent: null, label: "Analyserar vinet" });
  log({
    stage: "analysis",
    level: "info",
    message: `Skickar bild + OCR till AI (mode: ${allowFullAnalysis ? "full" : "label_only"})`,
    data: { hasOcr: Boolean(ocrText), ocrChars: ocrText?.length ?? 0, allowFullAnalysis },
  });

  let response: Response | null = null;
  let analysisMode: "full" | "label_only" = allowFullAnalysis ? "full" : "label_only";

  const callAnalysisOrThrow = async (params: Parameters<typeof callAnalysis>[0]): Promise<Response> => {
    try {
      return await callAnalysis(params);
    } catch (callError) {
      // AbortError hanteras separat utanför av label_only-fallback
      if (callError instanceof Error && callError.name === "AbortError") {
        throw callError;
      }
      // TypeError från fetch = nätverksfel (offline, DNS, CORS, etc.)
      const isNetwork =
        callError instanceof TypeError ||
        (callError instanceof Error && /network|fetch|failed to fetch/i.test(callError.message));
      log({
        stage: isNetwork ? "network" : "analysis",
        level: "error",
        message: isNetwork
          ? "Nätverksfel mot AI-tjänsten"
          : callError instanceof Error
            ? callError.message
            : "Okänt fel mot AI-tjänsten",
        data: { error: String(callError) },
      });
      throw new ScanPipelineError(
        isNetwork ? "network" : "analysis",
        isNetwork
          ? "Ingen kontakt med servern – kontrollera din internetanslutning."
          : callError instanceof Error
            ? callError.message
            : "Kunde inte nå analystjänsten",
        { cause: callError },
      );
    }
  };

  try {
    response = await callAnalysisOrThrow({
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
      log({
        stage: "analysis",
        level: "warn",
        message: "AI-anrop tog för lång tid – försöker igen i etikettläge",
      });
      analysisMode = "label_only";
      response = await callAnalysisOrThrow({
        supabaseUrl,
        supabaseAnonKey,
        ocrText,
        processedImage,
        noTextFound,
        uiLang,
        ocrKey,
        labelOnly: true,
      });
    } else if (error instanceof Error && error.name === "AbortError") {
      log({ stage: "analysis", level: "error", message: "Analysen tog för lång tid (timeout)" });
      throw new ScanPipelineError("analysis", "Analysen tog för lång tid – försök igen.", { cause: error });
    } else {
      throw error;
    }
  }

  if (!response) {
    throw new ScanPipelineError("analysis", "Analysen kunde inte startas");
  }

  log({
    stage: "analysis",
    level: response.ok ? "info" : "error",
    message: `AI-svar mottaget: HTTP ${response.status}`,
    data: { status: response.status, ok: response.ok },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new ScanPipelineError("analysis", "Rate limit överskriden – vänta en stund och försök igen.", { status: 429 });
    }
    if (response.status === 402) {
      throw new ScanPipelineError("analysis", "AI-krediter slut – kontakta support.", { status: 402 });
    }
    if (response.status >= 500) {
      throw new ScanPipelineError("analysis", `AI-tjänsten svarade med fel (${response.status}). Försök igen om en stund.`, { status: response.status });
    }
    throw new ScanPipelineError("analysis", errorData?.error || `HTTP ${response.status}`, { status: response.status });
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

  log({
    stage: "analysis",
    level: ok ? "info" : "error",
    message: ok
      ? `AI-analys klar (mode: ${analysisMode}, note: ${resolvedNote ?? "—"})`
      : "AI returnerade ok=false",
    data: {
      mode: analysisMode,
      note: resolvedNote,
      hasData: Boolean(data),
      sources: data?.sources?.length ?? 0,
      timings,
    },
  });

  if (!ok) {
    throw new ScanPipelineError("analysis", "AI-analysen misslyckades – försök igen.");
  }

  if (!data) {
    throw new ScanPipelineError("analysis", "AI-tjänsten gav ett tomt svar – försök igen.");
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
