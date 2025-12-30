import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useIsPremium } from "@/hooks/useUserSettings";
import { computeLabelHash, type WineAnalysisResult } from "@/lib/wineCache";
import { prewarmOcr } from "@/lib/ocrWorker";
import { Banner } from "@/components/Banner";
import { AmbientBackground } from "@/components/AmbientBackground";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { readExifOrientation } from "@/lib/exif";
import { useTabStateContext } from "@/contexts/TabStateContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { trackEvent } from "@/lib/telemetry";
import { logError, logEvent } from "@/lib/logger";
import {
  createRemoteScan,
  persistRefinedAnalysis,
  removeWineLocally,
  saveScanToHistory,
  saveWineLocally,
} from "@/services/scanHistoryService";
import { useScanPipeline } from "@/hooks/useScanPipeline";
import type { PipelineSource, ProgressKey, ScanStatus } from "@/services/scanPipelineService";
import { ScanResultView } from "@/components/wine-scan/ScanResultView";
import { ScanEmptyState } from "@/components/wine-scan/ScanEmptyState";
import { FREE_SCAN_LIMIT_PER_DAY, getFreeScanUsage, incrementFreeScanUsage } from "@/lib/premiumAccess";
import { normalizeEvidenceItems } from "@/lib/evidence";

const INTRO_ROUTE = "/for-you";
const AUTO_RETAKE_DELAY = 1500;
const WEB_EVIDENCE_THRESHOLD = 2;
const HTTP_LINK_REGEX = /^https?:\/\//i;
const CONFIDENCE_THRESHOLD = 0.7;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

type BannerState = {
  type: "info" | "success" | "warning" | "error";
  text: string;
  title?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (!file || file.size === 0) {
      reject(new Error("Filen är tom eller kunde inte hittas"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result || result.length === 0) {
        reject(new Error("Filen kunde inte läsas korrekt"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      const errorMsg = reader.error?.message || "Okänt fel vid filläsning";
      console.error('[readFileAsDataUrl] FileReader error:', reader.error);
      reject(new Error(`Kunde inte läsa filen: ${errorMsg}`));
    };
    reader.onabort = () => {
      reject(new Error("Filläsningen avbröts"));
    };
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[readFileAsDataUrl] Exception:', err);
      reject(new Error("Kunde inte starta filläsningen"));
    }
  });

/**
 * WineSnap samlar hela skanningsflödet: den triggar useScanPipeline för OCR och analys,
 * synkar historik via scanHistoryService och skickar data/åtgärder vidare till de nya
 * wine-scan-komponenterna samt navigerings- och installationsflödena.
 */
const WineSnap = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isPremium, isLoading: isPremiumLoading } = useIsPremium();
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [persistingScan, setPersistingScan] = useState(false);
  const [isRefineDialogOpen, setIsRefineDialogOpen] = useState(false);
  const [refineVintage, setRefineVintage] = useState("");
  const [refineGrape, setRefineGrape] = useState("");
  const [refineStyle, setRefineStyle] = useState("");
  const {
    state: {
      results,
      scanStatus,
      isProcessing,
      progressStep,
      progressNote,
      progressPercent,
      progressLabel,
      currentCacheKey,
      currentOcrText,
      remoteScanId,
    },
    startScan,
    reset: resetScanState,
    setResults,
    setCurrentCacheKey,
    setCurrentOcrText,
    setRemoteScanId,
    setProgressNote,
    setProgressLabel,
    setProgressPercent,
    setProgressStep,
    setScanStatus,
    setIsProcessing,
    terminateWorker,
    getResponseTimeMs,
  } = useScanPipeline();
  const { setTabState } = useTabStateContext();
  const triggerHaptic = useHapticFeedback();
  const [freeScanUsage, setFreeScanUsage] = useState(() => getFreeScanUsage());

  // Auto-trigger camera on mount if no image/results
  const autoOpenedRef = useRef(false);
  const cameraOpenedRef = useRef(false);
  const cameraModeRef = useRef(false);
  const autoRetakeTimerRef = useRef<number | null>(null);
  const shouldAutoRetakeRef = useRef(false);
  const currentImageRef = useRef<PipelineSource | null>(null);
  const ensureScanPromiseRef = useRef<Promise<string> | null>(null);
  const filePickerPendingRef = useRef(false);

  const openFilePicker = (useCamera: boolean) => {
    // Prevent duplicate calls - if we already tried to open the file picker recently, abort
    // But only for a very short time (100ms) to prevent true double-clicks while allowing retries
    if (filePickerPendingRef.current) {
      console.log('[openFilePicker] Already pending, skipping duplicate call');
      return;
    }
    
    console.log('[openFilePicker] Called, useCamera:', useCamera);
    filePickerPendingRef.current = true;
    
    // Reset pending status after very short delay to prevent true double-clicks
    // but allow quick retries if user cancelled
    setTimeout(() => {
      filePickerPendingRef.current = false;
    }, 100);
    
    cameraOpenedRef.current = true;
    cameraModeRef.current = useCamera;
    const input = document.getElementById("wineImageUpload") as HTMLInputElement | null;
    console.log('[openFilePicker] Input element found:', !!input);
    if (input) {
      input.value = ''; // Reset to allow same file re-selection
      input.click();
      console.log('[openFilePicker] Click triggered');
    }
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
      terminateWorker();
    };
  }, [terminateWorker]);

  // Auto-trigger on mount disabled - user should click the button themselves
  // This prevents conflicts with manual button clicks on mobile browsers
  // useEffect(() => {
  //   if (results || previewImage) return;
  //   if (autoOpenedRef.current) return;
  //   autoOpenedRef.current = true;
  //   const t = setTimeout(() => {
  //     openFilePicker(true);
  //   }, 0);
  //   return () => clearTimeout(t);
  // }, [results, previewImage]);

  const processWineImage = async (source?: PipelineSource | null) => {
    const uiLang = navigator.language || "sv-SE";
    const activeSource = source ?? currentImageRef.current;

    if (!activeSource) {
      return;
    }

    if (!isPremium && !isPremiumLoading) {
      const usage = getFreeScanUsage();
      if (usage.count >= usage.limit) {
        setBanner({
          type: "warning",
          title: "Premium-funktion",
          text: `Gratis ger ${usage.limit} analyser per dag. Lås upp obegränsade skanningar och djupanalys med Premium.`,
          ctaLabel: "Bli premium",
          onCta: () => navigate("/me"),
        });
        toast({
          title: "Begränsat i gratisläget",
          description: "Du har nått dagens gräns. Uppgradera till premium för obegränsade analyser.",
          variant: "destructive",
        });
        return;
      }

      setFreeScanUsage(usage);
    }

    const modeHint = cameraModeRef.current ? "camera" : "manual";
    const labelHashPresent = Boolean(
      computeLabelHash(currentOcrText ?? results?.originaltext ?? results?.vin ?? null),
    );
    const trigger = cameraModeRef.current ? "camera" : autoOpenedRef.current ? "auto" : "upload";
    void logEvent("scan_started", {
      modeHint,
      labelHashPresent,
      trigger,
      hasSource: Boolean(activeSource),
    });
    trackEvent("scan_start", {
      trigger,
      hasSource: Boolean(activeSource),
      retried: Boolean(source),
    });

    let encounteredError = false;
    setBanner(null);
    shouldAutoRetakeRef.current = false;
    if (autoRetakeTimerRef.current) {
      window.clearTimeout(autoRetakeTimerRef.current);
      autoRetakeTimerRef.current = null;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Appen saknar Supabase-konfiguration – sätt VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY (eller VITE_SUPABASE_ANON_KEY).",
        );
      }

      const pipelineOutcome = await startScan({
        source: activeSource,
        uiLang,
        supabaseUrl,
        supabaseAnonKey,
        allowFullAnalysis: true, // TODO: revert to isPremium || isPremiumLoading when premium gating is ready
      });

      const {
        result: analysisResult,
        fromCache,
        noTextFound,
        resolvedNote,
        analysisMode,
        cacheLookupKey,
        rawOcrValue,
        responseTimeMs,
        savedFromCache,
        timings,
      } = pipelineOutcome;

      if (import.meta.env.DEV && timings) {
        console.debug("WineSnap analysis timings", timings);
      }

      const effectiveOcrText = rawOcrValue ?? cacheLookupKey;
      setIsSaved(savedFromCache);

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

      if (!isPremium) {
        incrementFreeScanUsage();
        setFreeScanUsage(getFreeScanUsage());
      }

      if (fromCache) {
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
          mode: (analysisResult as WineAnalysisResult).mode ?? "label_only",
          confidence:
            typeof (analysisResult as WineAnalysisResult).confidence === "number"
              ? (analysisResult as WineAnalysisResult).confidence
              : null,
          latencyMs: responseTimeMs,
          source: "cache",
          trigger,
          labelHashPresent,
          noTextFound,
        });
        trackEvent("scan_succeeded", {
          source: "cache",
          noTextFound,
          mode: (analysisResult as WineAnalysisResult).mode,
          confidence: (analysisResult as WineAnalysisResult).confidence,
          responseTimeMs,
        });
        setProgressStep(null);
        setProgressNote(null);
        setProgressPercent(null);
        setProgressLabel(null);
        return;
      }

      setIsSaved(false);

      void logEvent("scan_succeeded", {
        mode: analysisResult.mode ?? "label_only",
        confidence: typeof analysisResult.confidence === "number" ? analysisResult.confidence : null,
        latencyMs: responseTimeMs,
        source: resolvedNote ?? "analysis",
        trigger,
        labelHashPresent,
        noTextFound,
        analysisMode,
      });
      trackEvent("scan_succeeded", {
        source: resolvedNote ?? "analysis",
        noTextFound,
        mode: analysisResult.mode,
        confidence: analysisResult.confidence,
        responseTimeMs,
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
        } else if (resolvedNote === "label_only_fallback" || analysisMode === "label_only") {
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

      setCurrentOcrText(effectiveOcrText);
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
        } else if (error.message.includes("Rate limit")) {
          errorMessage = error.message;
          toast({
            title: "För många förfrågningar",
            description: "Vänta en stund och försök igen.",
            variant: "destructive",
          });
        } else if (error.message.includes("AI-krediter")) {
          errorMessage = error.message;
          toast({
            title: "Betalning krävs",
            description: "AI-krediter slut. Kontakta support.",
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
        trigger,
        modeHint,
        errorMessage,
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
      if (encounteredError) {
        setProgressNote((prev) => prev ?? "Försök igen efter att ha kontrollerat bilden.");
      } else {
        setProgressStep(null);
        setProgressNote(null);
        setProgressPercent(null);
        setProgressLabel(null);
      }

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
        console.log('[handleFileChange] Reading file:', file.name, 'size:', file.size, 'type:', file.type);
        const [buffer, dataUrl] = await Promise.all([
          file.arrayBuffer().catch(err => {
            console.error('[handleFileChange] arrayBuffer error:', err);
            throw new Error("Kunde inte läsa filens innehåll");
          }),
          readFileAsDataUrl(file)
        ]);
        console.log('[handleFileChange] File read successfully, dataUrl length:', dataUrl.length);
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
    console.log('[handleTakePhoto] Called - opening file picker directly in user gesture');
    shouldAutoRetakeRef.current = false;
    
    // Reset state FIRST (but preserve camera flags for handleFileChange)
    setPreviewImage(null);
    resetScanState();
    setBanner(null);
    setIsSaved(false);
    setIsSaving(false);
    setIsRemoving(false);
    setPersistingScan(false);
    autoOpenedRef.current = false;
    ensureScanPromiseRef.current = null;
    if (autoRetakeTimerRef.current) {
      window.clearTimeout(autoRetakeTimerRef.current);
      autoRetakeTimerRef.current = null;
    }
    currentImageRef.current = null;
    
    // THEN open file picker SYNCHRONOUSLY in user gesture
    // Set camera flags AFTER reset so they're not overwritten
    cameraOpenedRef.current = true;
    cameraModeRef.current = true;
    const input = document.getElementById("wineImageUpload") as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
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
        const remoteId = await createRemoteScan({ results, previewImage });
        setRemoteScanId(remoteId);
        return remoteId;
      } finally {
        setPersistingScan(false);
        ensureScanPromiseRef.current = null;
      }
    })();

    ensureScanPromiseRef.current = promise;
    return promise;
  }, [previewImage, remoteScanId, results, setPersistingScan, setRemoteScanId, user?.id]);

  const handleReset = (options?: { reopenPicker?: boolean; useCamera?: boolean }) => {
    triggerHaptic();
    setPreviewImage(null);
    resetScanState();
    setBanner(null);
    setIsSaved(false);
    setIsSaving(false);
    setIsRemoving(false);
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
      // Use requestAnimationFrame instead of setTimeout - slightly better for user gesture chain
      // But note: for best results, call openFilePicker directly in the click handler
      requestAnimationFrame(() => {
        openFilePicker(options.useCamera ?? true);
      });
    }
  };

  // Listen for navigation state to trigger new scan (when scan button is clicked while already on /scan)
  const lastTriggerRef = useRef<number | null>(null);
  useEffect(() => {
    const state = location.state as { triggerNewScan?: number } | null;
    if (state?.triggerNewScan && state.triggerNewScan !== lastTriggerRef.current) {
      lastTriggerRef.current = state.triggerNewScan;
      // Clear the state to prevent re-triggering on refresh
      navigate(location.pathname, { replace: true, state: {} });
      // Check if file picker is already pending before triggering
      if (!filePickerPendingRef.current) {
        // Reset and open camera
        handleReset({ reopenPicker: true, useCamera: true });
      }
    }
  }, [location.state, location.pathname, navigate]);

  const handleRetryScan = () => {
    if (isProcessing) return;
    // Open file picker FIRST (synchronously in click handler) to preserve user gesture
    openFilePicker(true);
    // Then reset state (without reopening picker)
    handleReset({ reopenPicker: false });
  };

  const handleChangeImage = () => {
    if (isProcessing) return;
    // Open file picker FIRST (synchronously in click handler) to preserve user gesture
    openFilePicker(false);
    // Then reset state (without reopening picker)
    handleReset({ reopenPicker: false });
  };

  const handleSaveWine = useCallback(() => {
    if (!results || !currentCacheKey) {
      return;
    }

    setIsSaving(true);
    try {
      const cacheKey = saveWineLocally({
        currentCacheKey,
        currentOcrText,
        previewImage,
        remoteScanId,
        results,
      });
      setCurrentCacheKey(cacheKey);
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
  }, [currentCacheKey, currentOcrText, previewImage, remoteScanId, results, setCurrentCacheKey, toast, triggerHaptic]);

  const handleRemoveWine = useCallback(() => {
    if (!currentCacheKey) {
      return;
    }

    setIsRemoving(true);
    try {
      const updated = removeWineLocally({ currentCacheKey });
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
      persistRefinedAnalysis({
        currentOcrText,
        isSaved,
        previewImage,
        remoteScanId,
        results,
        updated,
      });
    },
    [currentOcrText, isSaved, previewImage, remoteScanId, results],
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
  }, [persistRefinedResult, refineGrape, refineStyle, refineVintage, results, setResults, toast]);

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
  const evidenceItems = results
    ? normalizeEvidenceItems({
      evidence: results.evidence,
      sourceStatus: results.källstatus,
      ocrText: results.originaltext ?? results.vin ?? null,
      sources: results.sources,
    })
    : [];
  const verifiedEvidenceCount = evidenceItems.filter((item) => item.type === "web" && item.url && HTTP_LINK_REGEX.test(item.url)).length;
  const isWebSource = sourceStatus?.source === "web";
  const metersFromTrustedSource = results?._meta?.meters_source === "web";
  // Always show meters if they exist - mark as estimated if not from trusted source
  const showVerifiedMeters = metersOk;
  const metersAreEstimated = !metersFromTrustedSource || !isWebSource || verifiedEvidenceCount < WEB_EVIDENCE_THRESHOLD;
  const sourceLabel = sourceStatus ? (isWebSource ? "Webb" : "Heuristik") : "Etikett";
  const sourceDescription = sourceStatus
    ? isWebSource
      ? verifiedEvidenceCount >= WEB_EVIDENCE_THRESHOLD
        ? `Bekräftad av ${verifiedEvidenceCount} webbkällor`
        : `Behöver fler källor (${verifiedEvidenceCount}/${WEB_EVIDENCE_THRESHOLD})`
      : "Baserad på etikett, druva och region"
    : "Baserad på etikettanalys";
  const sourceType: "label" | "web" = isWebSource ? "web" : "label";

  // --- spara historik (lokalt + supabase) när resultat finns ---
  useEffect(() => {
    if (!results || !isSaved) return;
    void saveScanToHistory(results);
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
    const confidenceValue = typeof results.confidence === "number" ? results.confidence : null;
    const needsRefinement = Boolean(
      results.mode === "label_only" || (confidenceValue !== null && confidenceValue < CONFIDENCE_THRESHOLD),
    );
    const refinementReason = results.mode === "label_only"
      ? "Det här bygger bara på etiketten – lägg till detaljer eller försök igen."
      : "Analysen är osäker – förbättra resultatet med fler detaljer.";
    const showDetailedSections = isPremium;
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
    const freeScansRemaining = Math.max(0, freeScanUsage.remaining);

    return (
      <>
        <input
          id="wineImageUpload"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <ScanResultView
          results={results}
          previewImage={previewImage}
          banner={banner ? <Banner {...banner} className="mb-4" /> : null}
          statusLabel={statusLabels[scanStatus].label}
          statusTone={statusLabels[scanStatus].tone}
          onRetryScan={handleRetryScan}
          onChangeImage={handleChangeImage}
          onSaveWine={handleSaveWine}
          onRemoveWine={handleRemoveWine}
          onStartNewScan={() => handleReset({ reopenPicker: true, useCamera: true })}
          onInstall={handleInstall}
          onNavigateHistory={() => navigate("/me/wines")}
          onNavigateProfile={() => navigate("/me")}
          showInstallCTA={showInstallCTA}
          isSaved={isSaved}
          isSaving={isSaving}
          isRemoving={isRemoving}
          currentCacheKey={currentCacheKey}
          isLoggedIn={Boolean(user)}
          onLogin={() => navigate("/login?redirectTo=/scan")}
          ensureRemoteScan={ensureRemoteScan}
          remoteScanId={remoteScanId}
          isPersistingScan={persistingScan}
          needsRefinement={needsRefinement}
          refinementReason={refinementReason}
          confidenceValue={confidenceValue}
          isProcessing={isProcessing}
          isRefineDialogOpen={isRefineDialogOpen}
          setIsRefineDialogOpen={setIsRefineDialogOpen}
          refineVintage={refineVintage}
          refineGrape={refineGrape}
          refineStyle={refineStyle}
          setRefineVintage={setRefineVintage}
          setRefineGrape={setRefineGrape}
          setRefineStyle={setRefineStyle}
          styleSuggestions={styleSuggestions}
          grapeSuggestions={grapeSuggestions}
          handleApplyRefinements={handleApplyRefinements}
          pairings={pairings}
          sourceLabel={sourceLabel}
          sourceDescription={sourceDescription}
          sourceType={sourceType}
          showVerifiedMeters={showVerifiedMeters}
          metersAreEstimated={metersAreEstimated}
          showDetailedSections={showDetailedSections}
          isPremium={isPremium}
          onUpgrade={() => navigate("/me")}
          freeScansRemaining={freeScansRemaining}
          ocrText={ocrText}
          evidenceLinks={evidenceItems}
          detectedLanguage={results.detekterat_språk}
        />
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

      <ScanEmptyState
        banner={banner ? <Banner {...banner} className="mb-4 w-full" /> : null}
        isInstallCTAVisible={isInstallable && !isInstalled}
        onInstall={handleInstall}
        onNavigateHome={() => navigate("/")}
        onNavigateProfile={() => navigate("/me")}
        onNavigateHistory={() => navigate("/me/wines")}
        statusLabel={statusLabels[scanStatus].label}
        statusTone={statusLabels[scanStatus].tone}
        onRetryScan={handleRetryScan}
        onChangeImage={handleChangeImage}
        onTakePhoto={handleTakePhoto}
        isProcessing={isProcessing}
        progressStep={progressStep}
        progressNote={progressNote}
        progressPercent={progressPercent}
        progressLabel={progressLabel}
        previewImage={previewImage}
        showError={scanStatus === "error" && !isProcessing && !results}
      />
    </div>
  );
};

export default WineSnap;
