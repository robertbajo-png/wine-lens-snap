import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Wine, Loader2, Download, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getCachedAnalysis, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
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
import { prewarmOcr, ocrRecognize } from "@/lib/ocrWorker";
import {
  supportsOffscreenCanvas,
  runPipelineOnMain,
  type PipelineOptions,
  type PipelineProgress,
  type PipelineResult,
} from "@/lib/imagePipelineCore";
import { readExifOrientation } from "@/lib/exif";

const INTRO_ROUTE = "/for-you";
const AUTO_RETAKE_DELAY = 1500;
type ProgressKey = "prep" | "ocr" | "analysis" | null;

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
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressKey>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  // Auto-trigger camera on mount if no image/results
  const autoOpenedRef = useRef(false);
  const cameraOpenedRef = useRef(false);
  const cameraModeRef = useRef(false);
  const autoRetakeTimerRef = useRef<number | null>(null);
  const shouldAutoRetakeRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const currentImageRef = useRef<PipelineSource | null>(null);
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
      cameraOpenedRef.current = true;
      cameraModeRef.current = true;
      document.getElementById("wineImageUpload")?.click();
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

    setIsProcessing(true);
    setBanner(null);
    setProgressStep("prep");
    setProgressNote("Förbereder bilden…");
    setProgressPercent(5);
    setProgressLabel("Skannar…");
    shouldAutoRetakeRef.current = false;
    if (autoRetakeTimerRef.current) {
      window.clearTimeout(autoRetakeTimerRef.current);
      autoRetakeTimerRef.current = null;
    }

    const options: PipelineOptions = {
      autoCrop: { fallbackCropPct: 0.1 },
      preprocess: {
        maxSide: 1200,
        quality: 0.68,
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
      const cached = getCachedAnalysis(cacheLookupKey);
      if (cached) {
        setResults(cached);
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

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 25000);

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
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

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
          // Behåll inkomna meters oförändrade; ingen client-side påhitt
          meters:
            data.meters && typeof data.meters === "object"
              ? data.meters
              : { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null },
          evidence: data.evidence || { etiketttext: "", webbträffar: [] },
          detekterat_språk: data.detekterat_språk,
          originaltext: data.originaltext,
          _meta: data._meta,
        };

        setResults(result);
        setCachedAnalysis(cacheLookupKey, result, processedImage);

        if (!noTextFound) {
          if (note === "hit_memory" || note === "hit_supabase") {
            setBanner({
              type: "info",
              title: "Sparad analys",
              text: "Hämtade sparad profil för snabbare upplevelse.",
            });
          } else if (note === "hit_analysis_cache" || note === "hit_analysis_cache_get") {
            setBanner({
              type: "info",
              title: "Snabbladdad profil",
              text: "⚡ Hämtade färdig vinprofil från global cache.",
            });
          } else if (note === "perplexity_timeout") {
            setBanner({
              type: "warning",
              title: "Endast etikettinfo",
              text: "Webbsökning tog för lång tid – smakprofil visas inte.",
              ctaLabel: "Försök igen",
              onCta: handleRetryScan,
            });
          } else if (note === "perplexity_failed") {
            setBanner({
              type: "warning",
              title: "Endast etikettinfo",
              text: "Kunde inte söka på webben – smakprofil visas inte.",
              ctaLabel: "Försök igen",
              onCta: handleRetryScan,
            });
          } else if (note === "fastpath" || note === "fastpath_heuristic") {
            setBanner({
              type: "info",
              title: "Snabbanalys",
              text: "⚡ Snabbanalys – fyller profil utan webbsvar.",
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
    } finally {
      setIsProcessing(false);
      setProgressStep(null);
      setProgressNote(null);
      setProgressPercent(null);
      setProgressLabel(null);

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
    } else if (cameraOpenedRef.current) {
      // User cancelled camera - go back to the introduction page
      navigate(INTRO_ROUTE);
    }
  };

  const handleTakePhoto = () => {
    cameraOpenedRef.current = true;
    cameraModeRef.current = true;
    document.getElementById("wineImageUpload")?.click();
  };

  const handleReset = () => {
    setPreviewImage(null);
    setResults(null);
    setIsProcessing(false);
    setProgressStep(null);
    setBanner(null);
    setProgressNote(null);
    setProgressPercent(null);
    setProgressLabel(null);
    autoOpenedRef.current = false;
    cameraOpenedRef.current = false;
    shouldAutoRetakeRef.current = false;
    if (autoRetakeTimerRef.current) {
      window.clearTimeout(autoRetakeTimerRef.current);
      autoRetakeTimerRef.current = null;
    }

    currentImageRef.current = null;

    // Re-open the camera/input on the next tick så användaren slipper tom skärm
    setTimeout(() => {
      cameraOpenedRef.current = true;
      cameraModeRef.current = true;
      document.getElementById("wineImageUpload")?.click();
    }, 0);
  };

  const handleRetryScan = () => {
    if (isProcessing) return;
    handleReset();
  };

  // --- helpers ---
  const hasNumeric = (value: unknown) => typeof value === "number" && Number.isFinite(value);
  const metersOk =
    results?.meters &&
    hasNumeric(results.meters.sötma) &&
    hasNumeric(results.meters.fyllighet) &&
    hasNumeric(results.meters.fruktighet) &&
    hasNumeric(results.meters.fruktsyra);
  const hasWebEvidence = (results?.evidence?.webbträffar?.length ?? 0) > 0;
  const showVerifiedMeters = Boolean(metersOk && hasWebEvidence);

  // --- spara historik (lokalt + supabase) när resultat finns ---
  useEffect(() => {
    if (!results) return;
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
  }, [results]);

  // Show results view if we have results
  if (results && !isProcessing) {
    const showInstallCTA = isInstallable && !isInstalled;
    const pairings = Array.isArray(results.passar_till)
      ? (results.passar_till.filter(Boolean) as string[])
      : [];
    const ocrText = results.originaltext && results.originaltext !== "–"
      ? results.originaltext
      : results.evidence?.etiketttext;

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
                onClick={() => navigate("/om")}
              >
                Om WineSnap
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

          {banner && <Banner {...banner} className="mb-6" />}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-6">
              <ResultHeader
                vin={results.vin}
                ar={results.årgång}
                producent={results.producent}
                land_region={results.land_region}
                typ={results.typ}
              />

              <section className="rounded-2xl border border-theme-card bg-gradient-to-br from-[hsl(var(--surface-elevated)/1)] via-[hsl(var(--surface-elevated)/0.8)] to-[hsl(var(--surface-elevated)/0.6)] p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">Smakprofil</h3>
                  {!showVerifiedMeters && (
                    <span className="rounded-full border border-theme-card bg-theme-elevated px-2 py-0.5 text-[10px] uppercase tracking-wide text-theme-secondary">
                      Etikettinfo
                    </span>
                  )}
                </div>
                {showVerifiedMeters ? (
                  <MetersRow
                    meters={results.meters}
                    estimated={results?._meta?.meters_source === "derived"}
                  />
                ) : (
                  <div className="text-sm text-theme-secondary">
                    <p className="opacity-80">Smakprofil kunde inte fastställas utan webbkällor.</p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-xl bg-theme-elevated text-theme-primary transition-colors hover:bg-theme-elevated"
                        onClick={handleRetryScan}
                      >
                        Försök igen
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <KeyFacts
                druvor={results.druvor}
                fargtyp={results.färgtyp}
                klassificering={results.klassificering}
                alkoholhalt={results.alkoholhalt}
                volym={results.volym}
                sockerhalt={results.sockerhalt}
                syra={results.syra}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <ClampTextCard title="Karaktär" text={results.karaktär} />
                <ClampTextCard title="Smak" text={results.smak} />
              </div>

              <Pairings items={pairings} />

              <ServingCard servering={results.servering} />

              <EvidenceAccordion
                ocr={ocrText}
                hits={results.evidence?.webbträffar}
                primary={results.källa}
              />

              {results.detekterat_språk && (
                <p className="text-xs text-theme-secondary opacity-80">
                  Upptäckt språk: {results.detekterat_språk.toUpperCase()}
                </p>
              )}

              <p className="text-xs text-theme-secondary opacity-80">
                Resultatet sparas lokalt tillsammans med etikettbilden.
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

        <ActionBar onNewScan={handleReset} />
      </div>
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
              onClick={() => navigate("/om")}
            >
              Om WineSnap
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
                "Resultatet sparas i historiken automatiskt.",
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
