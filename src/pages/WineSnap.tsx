import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Json } from "@/integrations/supabase/types";
import {
  BookmarkPlus,
  Camera,
  Download,
  ImageUp,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trash2,
  Wine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import {
  getCachedAnalysisEntry,
  setCachedAnalysis,
  computeLabelHash,
  getCacheKey,
  setAnalysisSavedState,
  type WineAnalysisResult,
} from "@/lib/wineCache";
import { normalizeAnalysisJson } from "@/lib/analysisSchema";
import { sha1Base64, getOcrCache, setOcrCache } from "@/lib/ocrCache";
import { ProgressBanner } from "@/components/ProgressBanner";
import { Banner } from "@/components/Banner";
import { AmbientBackground } from "@/components/AmbientBackground";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import ResultHeader from "@/components/result/ResultHeader";
import MetersRow from "@/components/result/MetersRow";
import KeyFacts from "@/components/result/KeyFacts";
import ClampTextCard from "@/components/result/ClampTextCard";
import Pairings from "@/components/result/Pairings";
import ServingCard from "@/components/result/ServingCard";
import EvidenceAccordion from "@/components/result/EvidenceAccordion";
import ActionBar from "@/components/result/ActionBar";
import ResultSkeleton from "@/components/result/ResultSkeleton";
import { WineListsPanel } from "@/components/result/WineListsPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { prewarmOcr, ocrRecognize } from "@/lib/ocrWorker";
import {
  supportsOffscreenCanvas,
  runPipelineOnMain,
  type PipelineOptions,
  type PipelineProgress,
  type PipelineResult,
} from "@/lib/imagePipelineCore";
import { readExifOrientation } from "@/lib/exif";
import { useTabStateContext } from "@/contexts/TabStateContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { trackEvent } from "@/lib/telemetry";
import { supabase } from "@/lib/supabaseClient";
import { logError, logEvent } from "@/lib/logger";

const INTRO_ROUTE = "/for-you";
const AUTO_RETAKE_DELAY = 1500;
const WEB_EVIDENCE_THRESHOLD = 2;
const HTTP_LINK_REGEX = /^https?:\/\//i;
const CONFIDENCE_THRESHOLD = 0.7;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ANALYSIS_TIMEOUT_MS = 60000; // 60s to match edge function Gemini timeout
type ProgressKey = "prep" | "ocr" | "analysis" | "done" | "error" | null;
type ScanStatus = "idle" | "processing" | "success" | "error";

type BannerState = {
  type: "info" | "success" | "warning" | "error";
  text: string;
  title?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

type PipelineSource = { dataUrl: string; buffer: ArrayBuffer; type: string; orientation: number };

type WorkerProgressMessage = {
  type: "progress";
  value: number;
  stage?: string;
  note?: string;
};

type WorkerResultMessage = {
  type: "result";
  ok?: boolean;
  base64: string;
  width: number;
  height: number;
};

type WorkerErrorMessage = {
  type: "error";
  ok?: boolean;
  message?: string;
};

type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

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

type AnalysisResponse = {
  ok: boolean;
  note?: string;
  timings?: Record<string, unknown> | null;
  data?: (Partial<WineAnalysisResult> & {
    meters?: WineAnalysisResult["meters"];
    evidence?: WineAnalysisResult["evidence"];
    _meta?: WineAnalysisResult["_meta"];
  }) | null;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Kunde inte läsa filen"));
    reader.readAsDataURL(file);
  });

const WineSnap = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [progressStep, setProgressStep] = useState<ProgressKey>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [currentCacheKey, setCurrentCacheKey] = useState<string | null>(null);
  const [currentOcrText, setCurrentOcrText] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [remoteScanId, setRemoteScanId] = useState<string | null>(null);
  const [persistingScan, setPersistingScan] = useState(false);
  const [isRefineDialogOpen, setIsRefineDialogOpen] = useState(false);
  const [refineVintage, setRefineVintage] = useState("");
  const [refineGrape, setRefineGrape] = useState("");
  const [refineStyle, setRefineStyle] = useState("");
  const { setTabState } = useTabStateContext();
  const triggerHaptic = useHapticFeedback();

  // Auto-trigger camera on mount if no image/results
  const autoOpenedRef = useRef(false);
  const cameraOpenedRef = useRef(false);
  const cameraModeRef = useRef(false);
  const autoRetakeTimerRef = useRef<number | null>(null);
  const shouldAutoRetakeRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const currentImageRef = useRef<PipelineSource | null>(null);
  const scanStartTimeRef = useRef<number | null>(null);
  const ensureScanPromiseRef = useRef<Promise<string> | null>(null);

  const openFilePicker = (useCamera: boolean) => {
    cameraOpenedRef.current = true;
    cameraModeRef.current = useCamera;
    document.getElementById("wineImageUpload")?.click();
  };

  const getResponseTimeMs = () => {
    if (scanStartTimeRef.current === null) {
      return undefined;
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = Math.round(now - scanStartTimeRef.current);
    return elapsed >= 0 ? elapsed : undefined;
  };
  useEffect(() => {
    const lang = navigator.language || "sv-SE";
    prewarmOcr(lang).catch(() => {
      // ignorerad förladdningsfail
    });
  }, []);

  useEffect(() => {
    return () => {
      if (autoRetakeTimerRef.current) {
        window.clearTimeout(autoRetakeTimerRef.current);
        autoRetakeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (results || previewImage) return;
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const t = setTimeout(() => {
      openFilePicker(true);
    }, 0);
    return () => clearTimeout(t);
  }, [results, previewImage]);

  const ensureWorker = () => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/imageWorker.ts", import.meta.url), { type: "module" });
    }
    return workerRef.current;
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

      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (!message || typeof message !== "object") return;

        if (message.type === "progress") {
          onProgress?.({ value: Number(message.value) || 0, stage: message.stage, note: message.note });
          return;
        }

        if (message.type === "result") {
          cleanup();
          resolve({ base64: message.base64, width: message.width, height: message.height });
          return;
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

  const processWineImage = async (source?: PipelineSource | null) => {
    const uiLang = navigator.language || "sv-SE";
    const activeSource = source ?? currentImageRef.current;

    if (!activeSource) {
      return;
    }

    scanStartTimeRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();

    const modeHint = cameraModeRef.current ? "camera" : "manual";
    const labelHashPresent = Boolean(
      computeLabelHash(currentOcrText ?? results?.originaltext ?? results?.vin ?? null),
    );
    const trigger = cameraModeRef.current ? "camera" : autoOpenedRef.current ? "auto" : "upload";
    void logEvent("scan_started", {
      modeHint,
      labelHashPresent,
    });
    trackEvent("scan_start", {
      trigger,
      hasSource: Boolean(activeSource),
      retried: Boolean(source),
    });

    let encounteredError = false;
    setScanStatus("processing");
    setIsProcessing(true);
    setBanner(null);
    setProgressStep("prep");
    setProgressNote("Komprimerar bilden (max 2048px, 90% JPG)…");
    setProgressPercent(5);
    setProgressLabel("Förbereder…");
    shouldAutoRetakeRef.current = false;
    if (autoRetakeTimerRef.current) {
      window.clearTimeout(autoRetakeTimerRef.current);
      autoRetakeTimerRef.current = null;
    }

    const options: PipelineOptions = {
      autoCrop: { fallbackCropPct: 0.1 },
      preprocess: {
        maxSide: 2048,
        quality: 0.9,
        grayscale: true,
        contrast: 1.12,
      },
    };

    const progressHandler = (update: PipelineProgress) => {
      setProgressStep("prep");
      const value =
        typeof update.value === "number" && Number.isFinite(update.value) ? update.value : null;
      setProgressPercent(value);
      setProgressLabel("Skannar…");
      setProgressNote(update.note ?? "Skannar…");
    };

    try {
      let pipelineResult: PipelineResult;
      if (supportsOffscreenCanvas()) {
        try {
          const blob = new Blob([activeSource.buffer], { type: activeSource.type || "image/jpeg" });
          const bitmap = await createImageBitmap(blob);
          pipelineResult = await runWorkerPipeline(
            bitmap,
            options,
            activeSource.orientation,
            progressHandler,
          );
        } catch (workerError) {
          console.warn("Worker pipeline misslyckades, faller tillbaka på huvudtråden", workerError);
          pipelineResult = await runPipelineOnMain(activeSource.dataUrl, options, progressHandler);
        }
      } else {
        pipelineResult = await runPipelineOnMain(activeSource.dataUrl, options, progressHandler);
      }

      if (pipelineResult.bitmap) {
        pipelineResult.bitmap.close();
      }

      const processedImage = pipelineResult.base64;


      setProgressPercent(null);
      setProgressLabel(null);
      setProgressStep("ocr");
      setProgressNote("Läser text (OCR) …");
      const ocrKey = await sha1Base64(processedImage);
      let ocrText = getOcrCache(ocrKey);
      if (!ocrText) {
        ocrText = await ocrRecognize(processedImage, uiLang);
        if (ocrText && ocrText.length >= 3) {
          setOcrCache(ocrKey, ocrText);
        }
      }

      const noTextFound = !ocrText || ocrText.length < 10;
      if (noTextFound) {
        const guidance = "Ingen text hittades – flytta närmare etiketten och undvik reflexer.";
        setBanner({
          type: "warning",
          title: "Ingen text hittades",
          text: guidance,
          ctaLabel: "Försök igen",
          onCta: handleRetryScan,
        });
        shouldAutoRetakeRef.current = true;
        toast({
          title: "Ingen text hittades",
          description: "Flytta närmare etiketten och undvik reflexer. Vi försöker ändå analysera.",
          variant: "destructive",
        });
      } else {
        shouldAutoRetakeRef.current = false;
      }

      const cacheLookupKey = !noTextFound && ocrText ? ocrText : processedImage;
      const cacheKey = getCacheKey(cacheLookupKey);
      const cachedEntry = getCachedAnalysisEntry(cacheLookupKey);
      if (cachedEntry) {
        const cachedResult = normalizeAnalysisJson(cachedEntry.result) ?? cachedEntry.result;
        setResults(cachedResult as WineAnalysisResult);
        setCurrentCacheKey(cacheKey);
        setIsSaved(cachedEntry.saved);
        setCurrentOcrText(!noTextFound ? ocrText ?? null : cacheLookupKey);
        if (!noTextFound) {
          setBanner({
            type: "info",
            title: "Sparad analys",
            text: "Hämtade sparad analys från din enhet.",
          });
        }
        toast({
          title: "Klart!",
          description: "Analys hämtad från cache.",
        });
        void logEvent("scan_succeeded", {
          mode: (cachedResult as WineAnalysisResult).mode ?? "label_only",
          confidence:
            typeof (cachedResult as WineAnalysisResult).confidence === "number"
              ? (cachedResult as WineAnalysisResult).confidence
              : null,
          latencyMs: getResponseTimeMs(),
        });
        trackEvent("scan_succeeded", {
          source: "cache",
          noTextFound,
          mode: (cachedResult as WineAnalysisResult).mode,
          confidence: (cachedResult as WineAnalysisResult).confidence,
          responseTimeMs: getResponseTimeMs(),
        });
        setProgressStep(null);
        setProgressNote(null);
        setIsProcessing(false);
        return;
      }

      setProgressStep("analysis");
      setProgressNote("Analyserar vinet …");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Appen saknar Supabase-konfiguration – sätt VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY (eller VITE_SUPABASE_ANON_KEY)."
        );
      }

      const callAnalysis = async (labelOnly: boolean) => {
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
            geminiOnly: true,
            skipCache: true,
            labelOnly,
          }),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);
        return response;
      };

      let response: Response | null = null;
      let analysisMode: "full" | "label_only" = "full";

      try {
        response = await callAnalysis(false);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setProgressLabel("Etikettläge");
          setProgressNote("Webbsökning tog för lång tid – visar etikettinfo.");
          setProgressPercent(65);
          analysisMode = "label_only";
          response = await callAnalysis(true);
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
          toast({
            title: "För många förfrågningar",
            description: "Vänta en stund och försök igen.",
            variant: "destructive",
          });
          throw new Error("Rate limit överskriden – vänta en stund");
        }
        if (response.status === 402) {
          toast({
            title: "Betalning krävs",
            description: "AI-krediter slut. Kontakta support.",
            variant: "destructive",
          });
          throw new Error("AI-krediter slut");
        }
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const { ok, data, note, timings }: AnalysisResponse = await response.json();
      const resolvedNote = analysisMode === "label_only" ? note ?? "label_only_fallback" : note;
      if (import.meta.env.DEV && timings) {
        console.debug("WineSnap analysis timings", timings);
      }

      if (!ok) {
        throw new Error("Analys misslyckades");
      }

      if (data) {
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
          // Behåll inkomna meters oförändrade; ingen client-side påhitt
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

        const normalizedResult = normalizeAnalysisJson(result) ?? result;

        setResults(normalizedResult as WineAnalysisResult);
        setScanStatus("success");
        setProgressStep("done");
        setProgressLabel("Analysen klar");
        setProgressPercent(100);
        const resolvedRemoteId =
          typeof data?._meta?.existing_scan_id === "string"
            ? data._meta.existing_scan_id
            : typeof data?._meta?.scan_id === "string"
              ? data._meta?.scan_id
              : undefined;
        setRemoteScanId(resolvedRemoteId ?? null);
        const labelHashMeta = typeof data?._meta?.label_hash === "string" ? data._meta.label_hash : undefined;
        const rawOcrValue = !noTextFound && ocrText ? ocrText : null;
        setCurrentCacheKey(cacheKey);
        setCurrentOcrText(rawOcrValue ?? cacheLookupKey);
        setIsSaved(false);
        setCachedAnalysis(cacheLookupKey, normalizedResult as WineAnalysisResult, {
          imageData: processedImage,
          rawOcr: rawOcrValue,
          remoteId: resolvedRemoteId ?? null,
          labelHash: labelHashMeta,
          saved: false,
        });
        void logEvent("scan_succeeded", {
          mode: normalizedResult.mode ?? "label_only",
          confidence: typeof normalizedResult.confidence === "number" ? normalizedResult.confidence : null,
          latencyMs: getResponseTimeMs(),
        });
        trackEvent("scan_succeeded", {
          source: resolvedNote ?? "analysis",
          noTextFound,
          mode: normalizedResult.mode,
          confidence: normalizedResult.confidence,
          responseTimeMs: getResponseTimeMs(),
        });

        if (!noTextFound) {
          if (resolvedNote === "hit_memory" || resolvedNote === "hit_supabase") {
            setBanner({
              type: "info",
              title: "Sparad analys",
              text: "Hämtade sparad profil för snabbare upplevelse.",
            });
          } else if (resolvedNote === "hit_analysis_cache" || resolvedNote === "hit_analysis_cache_get") {
            setBanner({
              type: "info",
              title: "Snabbladdad profil",
              text: "⚡ Hämtade färdig vinprofil från global cache.",
            });
          } else if (resolvedNote === "perplexity_timeout") {
            setBanner({
              type: "warning",
              title: "Endast etikettinfo",
              text: "Webbsökning tog för lång tid – smakprofil visas inte.",
              ctaLabel: "Försök igen",
              onCta: handleRetryScan,
            });
          } else if (resolvedNote === "perplexity_failed") {
            setBanner({
              type: "warning",
              title: "Endast etikettinfo",
              text: "Kunde inte söka på webben – smakprofil visas inte.",
              ctaLabel: "Försök igen",
              onCta: handleRetryScan,
            });
          } else if (resolvedNote === "fastpath" || resolvedNote === "fastpath_heuristic") {
            setBanner({
              type: "info",
              title: "Snabbanalys",
              text: "⚡ Snabbanalys – fyller profil utan webbsvar.",
            });
          } else if (resolvedNote === "label_only_fallback") {
            setBanner({
              type: "warning",
              title: "Endast etikettinfo",
              text: "Webbsökningen avbröts – visar analys baserad på etiketten.",
              ctaLabel: "Försök igen",
              onCta: handleRetryScan,
            });
          } else {
            setBanner({
              type: "success",
              title: "Analysen klar",
              text: "Klart! Din vinprofil är uppdaterad.",
            });
          }
        }
      }
    } catch (error) {
      encounteredError = true;
      setScanStatus("error");
      setProgressStep("error");
      setProgressLabel("Skanning misslyckades");
      let errorMessage = "Kunde inte analysera bilden – försök igen i bättre ljus.";

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "Analysen tog för lång tid – försök igen";
          toast({
            title: "Timeout",
            description: "Analysen tog för lång tid. Försök igen.",
            variant: "destructive",
          });
        } else {
          errorMessage = error.message;
        }
      }

      const latencyMs = getResponseTimeMs();
      const normalizedReason: "network" | "ai_error" | "timeout" | "other" = (() => {
        if (error instanceof Error && error.name === "AbortError") {
          return "timeout";
        }

        const lowered = errorMessage.toLowerCase();
        if (lowered.includes("network") || lowered.includes("fetch")) {
          return "network";
        }
        if (lowered.includes("ai") || lowered.includes("model")) {
          return "ai_error";
        }
        return "other";
      })();

      void logEvent("scan_failed", {
        reason: normalizedReason,
        latencyMs,
      });
      trackEvent("scan_failed", {
        reason: errorMessage,
        name: error instanceof Error ? error.name : undefined,
        category: normalizedReason,
        responseTimeMs: latencyMs,
      });

      const retryAction = currentImageRef.current
        ? () => {
            if (currentImageRef.current) {
              void processWineImage(currentImageRef.current);
            }
          }
        : handleRetryScan;
      setBanner({
        type: "error",
        title: "Skanningen misslyckades",
        text: errorMessage,
        ctaLabel: "Försök igen",
        onCta: retryAction,
      });
      shouldAutoRetakeRef.current = false;

      if (!(error instanceof Error && error.name === "AbortError")) {
        toast({
          title: "Skanningen misslyckades",
          description: errorMessage,
          variant: "destructive",
        });
      }

      void logError(
        "WineSnap",
        "processWineImage",
        errorMessage,
        {
          category: normalizedReason,
          responseTimeMs: latencyMs,
        },
      );
    } finally {
      setIsProcessing(false);
      if (encounteredError) {
        setProgressNote((prev) => prev ?? "Försök igen efter att ha kontrollerat bilden.");
      } else {
        setProgressStep(null);
        setProgressNote(null);
        setProgressPercent(null);
        setProgressLabel(null);
      }
      scanStartTimeRef.current = null;

      if (shouldAutoRetakeRef.current && cameraModeRef.current) {
        autoRetakeTimerRef.current = window.setTimeout(() => {
          document.getElementById("wineImageUpload")?.click();
        }, AUTO_RETAKE_DELAY);
      }
      shouldAutoRetakeRef.current = false;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const message = "Bilden är för stor. Välj en fil under 10 MB.";
        setBanner({
          type: "error",
          title: "För stor fil",
          text: message,
          ctaLabel: "Välj annan bild",
          onCta: () => openFilePicker(cameraModeRef.current),
        });
        setScanStatus("error");
        setProgressStep("error");
        setProgressLabel("För stor fil");
        setProgressPercent(0);
        setProgressNote(message);
        toast({
          title: "För stor fil",
          description: message,
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      if (autoRetakeTimerRef.current) {
        window.clearTimeout(autoRetakeTimerRef.current);
        autoRetakeTimerRef.current = null;
      }
      shouldAutoRetakeRef.current = false;
      const triggeredByCamera = cameraOpenedRef.current;
      cameraOpenedRef.current = false;
      cameraModeRef.current = triggeredByCamera;

      try {
        const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), readFileAsDataUrl(file)]);
        const orientation = readExifOrientation(buffer) ?? 1;
        currentImageRef.current = { buffer, dataUrl, type: file.type || "image/jpeg", orientation };
        setPreviewImage(dataUrl);
        await processWineImage(currentImageRef.current);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Kunde inte läsa bildfilen – försök igen.";
        setBanner({
          type: "error",
          title: "Filuppladdning misslyckades",
          text: message,
          ctaLabel: "Försök igen",
          onCta: handleRetryScan,
        });
        toast({
          title: "Filuppladdning misslyckades",
          description: message,
          variant: "destructive",
        });
      }
    } else if (cameraOpenedRef.current && cameraModeRef.current) {
      // User cancelled camera - go back to the introduction page
      navigate(INTRO_ROUTE);
    }
  };

  const handleTakePhoto = () => {
    shouldAutoRetakeRef.current = false;
    handleReset({ reopenPicker: true, useCamera: true });
  };

  const ensureRemoteScan = useCallback(async (): Promise<string> => {
    if (remoteScanId) {
      return remoteScanId;
    }

    if (!results) {
      throw new Error("Vänta tills analysen är klar innan du sparar vinet.");
    }

    if (!user?.id) {
      throw new Error("Logga in för att kunna spara listor.");
    }

    if (ensureScanPromiseRef.current) {
      return ensureScanPromiseRef.current;
    }

    const promise = (async () => {
      setPersistingScan(true);
      try {
        const rawTextCandidate =
          normalizeRawText(results.originaltext) ?? normalizeRawText(results.evidence?.etiketttext) ?? null;
        const labelHash = computeLabelHash(rawTextCandidate ?? results.vin ?? null);
        const { data, error } = await supabase
          .from("scans")
          .insert([{
            label_hash: labelHash,
            raw_ocr: rawTextCandidate,
            image_thumb: previewImage,
            analysis_json: results as unknown as Json,
            vintage: parseVintageFromString(results.årgång),
          }])
          .select("id")
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? "Kunde inte spara skanningen.");
        }

        setRemoteScanId(data.id);
        return data.id;
      } finally {
        setPersistingScan(false);
        ensureScanPromiseRef.current = null;
      }
    })();

    ensureScanPromiseRef.current = promise;
    return promise;
  }, [previewImage, remoteScanId, results, user?.id]);

  const handleReset = (options?: { reopenPicker?: boolean; useCamera?: boolean }) => {
    triggerHaptic();
    setPreviewImage(null);
    setResults(null);
    setScanStatus("idle");
    setIsProcessing(false);
    setProgressStep(null);
    setBanner(null);
    setProgressNote(null);
    setProgressPercent(null);
    setProgressLabel(null);
    setCurrentCacheKey(null);
    setCurrentOcrText(null);
    setIsSaved(false);
    setIsSaving(false);
    setIsRemoving(false);
    setRemoteScanId(null);
    setPersistingScan(false);
    autoOpenedRef.current = false;
    cameraOpenedRef.current = false;
    shouldAutoRetakeRef.current = false;
    ensureScanPromiseRef.current = null;
    if (autoRetakeTimerRef.current) {
      window.clearTimeout(autoRetakeTimerRef.current);
      autoRetakeTimerRef.current = null;
    }

    currentImageRef.current = null;

    if (options?.reopenPicker) {
      setTimeout(() => {
        openFilePicker(options.useCamera ?? true);
      }, 0);
    }
  };

  const handleRetryScan = () => {
    if (isProcessing) return;
    handleReset({ reopenPicker: true, useCamera: true });
  };

  const handleChangeImage = () => {
    if (isProcessing) return;
    handleReset({ reopenPicker: true, useCamera: false });
  };

  const handleSaveWine = useCallback(() => {
    if (!results || !currentCacheKey) {
      return;
    }

    setIsSaving(true);
    try {
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
        setCurrentCacheKey(getCacheKey(keySource));
      }
      setIsSaved(true);
      triggerHaptic();
      toast({
        title: "Vinet har lagts till i dina sparade viner.",
        description: results.vin,
      });
    } catch (error) {
      console.error("Failed to save wine", error);
      toast({
        title: "Kunde inte spara vinet",
        description: "Försök igen om en liten stund.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentCacheKey, currentOcrText, previewImage, remoteScanId, results, toast, triggerHaptic]);

  const handleRemoveWine = useCallback(() => {
    if (!currentCacheKey) {
      return;
    }

    setIsRemoving(true);
    try {
      const updated = setAnalysisSavedState(currentCacheKey, false);
      if (updated) {
        setIsSaved(false);
        toast({
          title: "Borttaget ur Mina viner",
          description: updated.result.vin,
        });
      }
    } catch (error) {
      console.error("Failed to remove saved wine", error);
      toast({
        title: "Kunde inte ta bort vinet",
        description: "Försök igen om en liten stund.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  }, [currentCacheKey, toast]);

  const persistRefinedResult = useCallback(
    (updated: WineAnalysisResult) => {
      const keySource = currentOcrText ?? results?.originaltext ?? results?.vin ?? null;
      if (!keySource) return;

      setCachedAnalysis(keySource, updated, {
        imageData: previewImage ?? undefined,
        rawOcr: currentOcrText,
        remoteId: remoteScanId,
        saved: isSaved,
      });
    },
    [currentOcrText, isSaved, previewImage, remoteScanId, results?.originaltext, results?.vin],
  );

  const handleApplyRefinements = useCallback(() => {
    if (!results) return;

    const trimmedVintage = refineVintage.trim();
    const trimmedGrape = refineGrape.trim();
    const trimmedStyle = refineStyle.trim();

    const updated: WineAnalysisResult = {
      ...results,
      årgång: trimmedVintage || results.årgång,
      druvor: trimmedGrape || results.druvor,
      typ: trimmedStyle || results.typ,
      style: trimmedStyle || results.style,
      grapes: trimmedGrape
        ? trimmedGrape
            .split(/[,/&;]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : results.grapes,
    };

    setResults(updated);
    persistRefinedResult(updated);
    toast({
      title: "Detaljer uppdaterade",
      description: "Vi använder dina insikter för en säkrare profil.",
    });
    setIsRefineDialogOpen(false);
  }, [persistRefinedResult, refineGrape, refineStyle, refineVintage, results, toast]);

  const stageFallbackLabels: Record<Exclude<ProgressKey, null>, string> = {
    prep: "Förbereder…",
    ocr: "Tolkar etikett…",
    analysis: "Analyserar…",
    done: "Klar",
    error: "Fel uppstod",
  };

  const navigationLabel = progressLabel ?? (progressStep ? stageFallbackLabels[progressStep] : null);

  const statusLabels: Record<ScanStatus, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "Redo för skanning", tone: "outline" },
    processing: { label: "Skannar…", tone: "default" },
    success: { label: "Skanning klar", tone: "secondary" },
    error: { label: "Fel – försök igen", tone: "destructive" },
  };

  useEffect(() => {
    setTabState("scan", (prev) => ({
      ...prev,
      isProcessing,
      progressLabel: navigationLabel ?? null,
    }));
  }, [isProcessing, navigationLabel, setTabState]);

  useEffect(() => {
    return () => {
      setTabState("scan", (prev) => ({
        ...prev,
        isProcessing: false,
        progressLabel: null,
      }));
    };
  }, [setTabState]);

  useEffect(() => {
    if (!results) {
      setRefineVintage("");
      setRefineGrape("");
      setRefineStyle("");
      return;
    }

    setRefineVintage(results.årgång && results.årgång !== "–" ? results.årgång : "");
    const grapeCandidate =
      results.druvor && results.druvor !== "–"
        ? results.druvor
        : Array.isArray(results.grapes) && results.grapes.length
          ? results.grapes[0] ?? ""
          : "";
    setRefineGrape(grapeCandidate ?? "");
    setRefineStyle(results.typ && results.typ !== "–" ? results.typ : results.style ?? results.färgtyp ?? "");
  }, [results]);

  // --- helpers ---
  const hasNumeric = (value: unknown) => typeof value === "number" && Number.isFinite(value);
  const metersOk =
    results?.meters &&
    hasNumeric(results.meters.sötma) &&
    hasNumeric(results.meters.fyllighet) &&
    hasNumeric(results.meters.fruktighet) &&
    hasNumeric(results.meters.fruktsyra);
  const sourceStatus = results?.källstatus;
  const evidenceFallback = results?.evidence?.webbträffar ?? [];
  const evidenceLinks = Array.isArray(sourceStatus?.evidence_links) && sourceStatus?.evidence_links.length
    ? (sourceStatus?.evidence_links as string[])
    : evidenceFallback;
  const verifiedEvidenceCount = evidenceLinks.filter((url) => typeof url === "string" && HTTP_LINK_REGEX.test(url)).length;
  const isWebSource = sourceStatus?.source === "web";
  const metersFromTrustedSource = results?._meta?.meters_source === "web";
  const showVerifiedMeters = Boolean(
    metersOk &&
    metersFromTrustedSource &&
    isWebSource &&
    verifiedEvidenceCount >= WEB_EVIDENCE_THRESHOLD
  );
  const sourceLabel = sourceStatus ? (isWebSource ? "Webb" : "Heuristik") : "Okänd";
  const sourceDescription = sourceStatus
    ? isWebSource
      ? verifiedEvidenceCount >= WEB_EVIDENCE_THRESHOLD
        ? `Bekräftad av ${verifiedEvidenceCount} webbkällor`
        : `Behöver fler källor (${verifiedEvidenceCount}/${WEB_EVIDENCE_THRESHOLD})`
      : "Baserad på etikett, druva och region"
    : "Källstatus saknas";
  const missingSourceText = !sourceStatus
    ? "Källstatus saknas för denna analys. Försök att skanna om flaskan."
    : isWebSource
      ? `Vi behöver minst ${WEB_EVIDENCE_THRESHOLD} verifierade webbkällor för att visa smakprofilen (har ${verifiedEvidenceCount}).`
      : "Vi saknar verifierade webbkällor och visar inte etikettbaserad heuristik.";

  // --- spara historik (lokalt + supabase) när resultat finns ---
  useEffect(() => {
    if (!results || !isSaved) return;
    import("../lib/history").then(({ saveHistory }) => {
      saveHistory({
        ts: new Date().toISOString(),
        vin: results.vin,
        producent: results.producent,
        land_region: results.land_region,
        årgång: results.årgång,
        meters: results.meters,
        evidence: results.evidence,
        _meta: results._meta ?? null,
      });
    });
  }, [isSaved, results]);

  // Show results view if we have results
  if (results && !isProcessing) {
    const showInstallCTA = isInstallable && !isInstalled;
    const pairings = Array.isArray(results.passar_till)
      ? (results.passar_till.filter(Boolean) as string[])
      : Array.isArray(results.food_pairings)
        ? (results.food_pairings.filter(Boolean) as string[])
        : [];
    const ocrText = results.originaltext && results.originaltext !== "–"
      ? results.originaltext
      : results.evidence?.etiketttext;
    const isLabelOnly = results.mode === "label_only";
    const confidenceValue = typeof results.confidence === "number" ? results.confidence : null;
    const needsRefinement = Boolean(
      isLabelOnly || (confidenceValue !== null && confidenceValue < CONFIDENCE_THRESHOLD),
    );
    const refinementReason = isLabelOnly
      ? "Det här bygger bara på etiketten – lägg till detaljer eller försök igen."
      : "Analysen är osäker – förbättra resultatet med fler detaljer.";
    const showDetailedSections = !isLabelOnly;
    const grapeSuggestions = Array.from(
      new Set(
        [
          ...(Array.isArray(results.grapes) ? results.grapes.filter(Boolean) : []),
          ...(results.druvor ? results.druvor.split(/[,/&;]/).map((item) => item.trim()).filter(Boolean) : []),
        ].slice(0, 6),
      ),
    );
    const styleSuggestions = Array.from(
      new Set(
        [results.style, results.typ, results.färgtyp]
          .filter((value): value is string => Boolean(value && value !== "–"))
          .slice(0, 6),
      ),
    );

    return (
      <>
        <Dialog open={isRefineDialogOpen} onOpenChange={setIsRefineDialogOpen}>
          <DialogContent className="border-theme-card bg-theme-elevated text-theme-primary">
            <DialogHeader>
              <DialogTitle>Förfina resultatet</DialogTitle>
              <DialogDescription className="text-theme-secondary">
                Hjälp oss säkra analysen genom att lägga till detaljer eller skanna etiketten igen.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border border-theme-card bg-theme-elevated/50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-theme-primary">Ta en ny bild</p>
                    <p className="text-sm text-theme-secondary">Fota etiketten igen för att få fler källor.</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsRefineDialogOpen(false);
                      handleRetryScan();
                    }}
                    className="border-theme-card bg-theme-canvas text-theme-primary hover:bg-theme-elevated"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Starta ny skanning
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="refineVintage">Årgång (valfritt)</Label>
                  <Input
                    id="refineVintage"
                    inputMode="numeric"
                    value={refineVintage}
                    onChange={(event) => setRefineVintage(event.target.value)}
                    placeholder="t.ex. 2019"
                    className="border-theme-card bg-theme-canvas text-theme-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refineStyle">Stil</Label>
                  <Input
                    id="refineStyle"
                    value={refineStyle}
                    onChange={(event) => setRefineStyle(event.target.value)}
                    placeholder="t.ex. Chianti Classico"
                    className="border-theme-card bg-theme-canvas text-theme-primary"
                  />
                  {styleSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-theme-secondary">
                      {styleSuggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="rounded-full border border-theme-card px-3 py-1 text-theme-primary hover:border-theme-primary"
                          onClick={() => setRefineStyle(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refineGrape">Druva</Label>
                <Input
                  id="refineGrape"
                  value={refineGrape}
                  onChange={(event) => setRefineGrape(event.target.value)}
                  placeholder="t.ex. Sangiovese"
                  className="border-theme-card bg-theme-canvas text-theme-primary"
                />
                {grapeSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs text-theme-secondary">
                    {grapeSuggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-full border border-theme-card px-3 py-1 text-theme-primary hover:border-theme-primary"
                        onClick={() => setRefineGrape(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 flex items-center gap-2 sm:justify-between">
              <p className="text-xs text-theme-secondary">Vi sparar dina manuella justeringar tillsammans med etiketten.</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIsRefineDialogOpen(false)} className="text-theme-primary">
                  Avbryt
                </Button>
                <Button onClick={handleApplyRefinements} className="bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-theme-primary">
                  Spara detaljer
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
          <AmbientBackground />

          <input
            id="wineImageUpload"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-32 pt-10 sm:pt-16">
            <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">WineSnap</p>
                <p className="text-sm text-theme-secondary">Din digitala sommelier</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-theme-secondary hover:text-theme-primary"
                  onClick={() => navigate("/me")}
                >
                  Profil
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
                  onClick={() => navigate("/me/wines")}
                >
                  Historik
                </Button>
                {showInstallCTA && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
                    onClick={handleInstall}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Installera app
                  </Button>
                )}
              </div>
            </header>

            {banner && <Banner {...banner} className="mb-4" />}
            {isLabelOnly && (
              <Banner
                type="warning"
                title="Endast etikettdata"
                text="Det här bygger bara på etiketten – viss information kan saknas."
                className="mb-4"
              />
            )}

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Badge variant={statusLabels[scanStatus].tone}>{statusLabels[scanStatus].label}</Badge>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryScan}
                  disabled={isProcessing}
                  className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Starta om
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleChangeImage}
                  disabled={isProcessing}
                  className="text-theme-primary hover:bg-theme-elevated"
                >
                  <ImageUp className="mr-2 h-4 w-4" />
                  Byt bild
                </Button>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-6">
                <ResultHeader
                  vin={results.vin}
                  ar={results.årgång}
                  producent={results.producent}
                  land_region={results.land_region}
                  typ={results.typ}
                />

                {needsRefinement && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-theme-card bg-theme-elevated/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-theme-primary">Förfina resultat</p>
                      <p className="text-sm text-theme-secondary">{refinementReason}</p>
                      {confidenceValue !== null && (
                        <p className="text-xs text-theme-secondary/80">Säkerhet: {(confidenceValue * 100).toFixed(0)}%</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsRefineDialogOpen(true)}
                      className="border-theme-card bg-theme-canvas text-theme-primary hover:bg-theme-elevated"
                    >
                      Förfina resultat
                    </Button>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    onClick={handleSaveWine}
                    disabled={isSaved || isSaving || !currentCacheKey}
                    className="h-12 w-full justify-center rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-base font-semibold text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)] disabled:from-[#7B3FE4]/40 disabled:via-[#8451ED]/40 disabled:to-[#9C5CFF]/40 sm:w-auto sm:min-w-[220px]"
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
                    {isSaved ? "Sparat" : "Spara till mina viner"}
                  </Button>
                  {isSaved ? (
                    <Button
                      variant="outline"
                      onClick={handleRemoveWine}
                      disabled={isRemoving}
                      className="h-12 w-full justify-center rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80 sm:w-auto"
                    >
                      {isRemoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Ta bort ur mina viner
                    </Button>
                  ) : null}
                </div>

                {user ? (
                  <WineListsPanel
                    scanId={remoteScanId}
                    ensureScanId={ensureRemoteScan}
                    isPersistingScan={persistingScan}
                  />
                ) : (
                  <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
                    <CardContent className="flex flex-col gap-3 text-sm text-theme-secondary sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-theme-primary">Logga in för att spara vinet</p>
                        <p>Skapa listor som Favoriter, Köp igen och Gästlista med ditt konto.</p>
                      </div>
                      <Button
                        variant="outline"
                        className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                        onClick={() => navigate("/login?redirectTo=/scan")}
                      >
                        Logga in
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {showDetailedSections ? (
                  <section className="rounded-2xl border border-theme-card bg-gradient-to-br from-[hsl(var(--surface-elevated)/1)] via-[hsl(var(--surface-elevated)/0.8)] to-[hsl(var(--surface-elevated)/0.6)] p-4 backdrop-blur-sm">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">Smakprofil</h3>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="inline-flex items-center rounded-full border border-theme-card bg-theme-elevated px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-theme-secondary">
                          Källa: {sourceLabel}
                        </span>
                        <span className="text-[11px] text-theme-secondary">{sourceDescription}</span>
                      </div>
                    </div>
                    {showVerifiedMeters ? (
                      <MetersRow
                        meters={results.meters}
                        estimated={results?._meta?.meters_source === "derived"}
                      />
                    ) : (
                      <Banner
                        type="warning"
                        title="Smakprofil saknas"
                        text={missingSourceText}
                        ctaLabel="Ny skanning"
                        onCta={handleRetryScan}
                      />
                    )}
                  </section>
                ) : (
                  <Card className="border-theme-card/80 bg-theme-elevated/60">
                    <CardContent className="text-sm text-theme-secondary">
                      <p className="font-semibold text-theme-primary">Vi visar bara etikettinfo</p>
                      <p>Smakprofil, serveringstips och matmatchningar döljs tills vi har mer källor.</p>
                    </CardContent>
                  </Card>
                )}

                {showDetailedSections && (
                  <KeyFacts
                    druvor={results.druvor}
                    fargtyp={results.färgtyp}
                    klassificering={results.klassificering}
                    alkoholhalt={results.alkoholhalt}
                    volym={results.volym}
                    sockerhalt={results.sockerhalt}
                    syra={results.syra}
                  />
                )}

                {showDetailedSections && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ClampTextCard title="Karaktär" text={results.karaktär} />
                    <ClampTextCard title="Smak" text={results.smak} />
                  </div>
                )}

                {showDetailedSections && <Pairings items={pairings} />}

                {showDetailedSections && <ServingCard servering={results.servering} />}

                <EvidenceAccordion
                  ocr={ocrText}
                  hits={
                    sourceStatus?.evidence_links?.length
                      ? sourceStatus.evidence_links
                      : results.evidence?.webbträffar
                  }
                  primary={results.källa}
                />

                {results.detekterat_språk && (
                  <p className="text-xs text-theme-secondary opacity-80">
                    Upptäckt språk: {results.detekterat_språk.toUpperCase()}
                  </p>
                )}

                <p className="text-xs text-theme-secondary opacity-80">
                  Spara profilen för att lägga till den i dina viner. Osparade skanningar rensas när du lämnar sidan.
                </p>
              </div>

              {previewImage && (
                <aside className="lg:sticky lg:top-24">
                  <div className="overflow-hidden rounded-3xl border border-theme-card bg-black/40 shadow-xl backdrop-blur">
                    <img src={previewImage} alt="Skannad vinetikett" className="h-full w-full object-cover" />
                  </div>
                </aside>
              )}
            </div>
          </div>

                <ActionBar onNewScan={() => handleReset({ reopenPicker: true, useCamera: true })} />
        </div>
      </>
    );
  }

  // Main landing page
  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />

      <input
        id="wineImageUpload"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {isInstallable && !isInstalled && (
        <div className="absolute right-4 top-4 z-10">
          <Button
            onClick={handleInstall}
            variant="outline"
            size="sm"
            className="border-theme-card bg-theme-elevated text-theme-primary shadow-lg backdrop-blur hover:bg-theme-elevated"
          >
            <Download className="mr-2 h-4 w-4" />
            Installera app
          </Button>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 pb-20 pt-12 text-center sm:px-8">
        <header className="mb-10 flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-theme-elevated shadow-lg shadow-purple-900/40">
              <Wine className="h-6 w-6 text-purple-100" />
            </div>
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">WineSnap</p>
              <p className="text-sm text-theme-secondary">Skanna vinetiketter med AI</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-theme-secondary hover:text-theme-primary"
              onClick={() => navigate("/")}
            >
              Hem
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-theme-secondary hover:text-theme-primary"
              onClick={() => navigate("/me")}
            >
              Profil
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
              onClick={() => navigate("/me/wines")}
            >
              Historik
            </Button>
          </div>
        </header>

        {banner && <Banner {...banner} className="mb-4 w-full" />}

        {isProcessing && !results && !previewImage && (
          <div className="mb-8 w-full rounded-3xl border border-theme-card bg-theme-elevated p-6 text-left">
            <ResultSkeleton />
          </div>
        )}


        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-theme-card bg-theme-elevated px-4 py-1 text-sm text-purple-100">
              <Sparkles className="h-4 w-4" />
              Klar för nästa skanning
            </p>
            <h1 className="text-3xl font-semibold text-theme-primary">Din digitala sommelier</h1>
            <p className="text-base text-theme-secondary">
              Fota etiketten och låt AI:n skapa en komplett vinprofil med smaknoter, serveringstips och matmatchningar – sparat lokalt för nästa gång.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3">
            <Badge variant={statusLabels[scanStatus].tone}>{statusLabels[scanStatus].label}</Badge>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryScan}
                disabled={isProcessing}
                className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Starta om
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeImage}
                disabled={isProcessing}
                className="text-theme-primary hover:bg-theme-elevated"
              >
                <ImageUp className="mr-2 h-4 w-4" />
                Byt bild
              </Button>
            </div>
          </div>

          {(isProcessing || progressStep || progressNote || progressPercent !== null) && (
            <div className="w-full">
              <ProgressBanner
                step={progressStep}
                note={progressNote}
                progress={progressPercent}
                label={progressLabel}
              />
            </div>
          )}

          {scanStatus === "error" && !isProcessing && !results && (
            <Card className="w-full border-theme-card bg-theme-elevated">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-theme-primary">
                  <Wine className="h-5 w-5" />
                  <p className="font-semibold">Något gick snett</p>
                </div>
                <p className="text-sm text-theme-secondary">
                  Kontrollera ljuset och prova igen. Du kan starta om eller välja en annan bild utan att ladda om sidan.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleRetryScan}
                    className="bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-theme-primary"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Starta om skanning
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleChangeImage}
                    className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                  >
                    <ImageUp className="mr-2 h-4 w-4" />
                    Byt bild
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {previewImage && (
            <Card className="relative w-full overflow-hidden rounded-[30px] border border-theme-card bg-gradient-to-br from-[hsl(var(--surface-elevated)/1)] via-[hsl(var(--surface-elevated)/0.85)] to-[hsl(var(--surface-elevated)/0.55)] shadow-2xl shadow-purple-900/40">
              <CardContent className="p-4">
                <div className="relative">
                  <img
                    src={previewImage}
                    alt="Wine bottle"
                    className="w-full rounded-2xl bg-black/20 object-contain"
                  />

                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur">
                      <div className="w-full max-w-xs space-y-4 text-center">
                        <Loader2 className="mx-auto h-10 w-10 animate-spin text-purple-200" />
                        <ProgressBanner
                          step={progressStep}
                          note={progressNote}
                          progress={progressPercent}
                          label={progressLabel}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!previewImage && (
            <div className="w-full space-y-4">
              <Button
                onClick={handleTakePhoto}
                className="h-14 w-full rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-base font-semibold shadow-[0_20px_45px_-22px_rgba(123,63,228,0.95)]"
                size="lg"
                disabled={isProcessing}
              >
                <Camera className="mr-2 h-5 w-5" />
                Fota vinflaska
              </Button>
              <p className="text-sm text-theme-secondary">
                Bäst resultat när etiketten fyller rutan och du fotar i mjukt ljus.
              </p>
            </div>
          )}

          <div className="w-full rounded-3xl border border-theme-card bg-theme-elevated p-5 text-left text-sm text-theme-secondary">
            <p className="font-semibold text-theme-primary">Så funkar skanningen</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                "Justera flaskan tills guidelinjen blir grön.",
                "Vi kör OCR och AI-analys i bakgrunden.",
                "Spara själv när du vill lägga till vinet i historiken.",
              ].map((tip, idx) => (
                <div key={tip} className="rounded-2xl border border-theme-card bg-black/25 p-3">
                  <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-theme-elevated text-xs font-semibold text-theme-primary">
                    {idx + 1}
                  </span>
                  <p>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WineSnap;
