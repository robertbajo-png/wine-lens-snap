import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Wine, Loader2, Download, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getCachedAnalysis, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
import { autoCropLabel } from "@/lib/autoCrop";
import { sha1Base64, getOcrCache, setOcrCache } from "@/lib/ocrCache";
import { ProgressBanner } from "@/components/ProgressBanner";
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
import { preprocessImage } from "@/lib/preprocess";
import { prewarmOcr, ocrRecognize } from "@/lib/ocrWorker";

const INTRO_ROUTE = "/";
type ProgressKey = "prep" | "ocr" | "analysis" | null;

const WineSnap = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressKey>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);
  const [banner, setBanner] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);

  // Auto-trigger camera on mount if no image/results
  const autoOpenedRef = useRef(false);
  const cameraOpenedRef = useRef(false);
  useEffect(() => {
    const lang = navigator.language || "sv-SE";
    prewarmOcr(lang).catch(() => {
      // ignorerad förladdningsfail
    });
  }, []);

  useEffect(() => {
    if (results || previewImage) return;
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const t = setTimeout(() => {
      cameraOpenedRef.current = true;
      document.getElementById("wineImageUpload")?.click();
    }, 0);
    return () => clearTimeout(t);
  }, [results, previewImage]);

  const processWineImage = async (imageData: string) => {
    const uiLang = navigator.language || "sv-SE";

    setIsProcessing(true);
    setBanner(null);
    setProgressStep("prep");
    setProgressNote("Förbereder bilden…");

    try {
      const croppedImage = await autoCropLabel(imageData);
      const processedImage = await preprocessImage(croppedImage, {
        maxSide: 1200,
        quality: 0.68,
        grayscale: true,
        contrast: 1.12,
      });

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
        toast({
          title: "Fortsätter utan etiketttext",
          description: "Kunde inte läsa etiketten – vi söker utifrån bild och heuristik.",
        });
      }

      const cacheLookupKey = !noTextFound && ocrText ? ocrText : processedImage;
      const cached = getCachedAnalysis(cacheLookupKey);
      if (cached) {
        setResults(cached);
        setBanner({ type: "info", text: "Hämtade sparad analys från din enhet." });
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
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Appen saknar Supabase-konfiguration – sätt VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY."
        );
      }

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const { ok, data, note, timings } = await response.json();
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
          // @ts-ignore – backend kan skicka _meta (proveniens)
          _meta: data._meta,
        };

        setResults(result);
        setCachedAnalysis(cacheLookupKey, result, processedImage);

        if (note === "hit_memory" || note === "hit_supabase") {
          setBanner({ type: "info", text: "Hämtade sparad profil för snabbare upplevelse." });
        } else if (note === "hit_analysis_cache" || note === "hit_analysis_cache_get") {
          setBanner({ type: "info", text: "⚡ Hämtade färdig vinprofil från global cache." });
        } else if (note === "perplexity_timeout") {
          setBanner({ type: "info", text: "Webbsökning tog för lång tid – använder endast etikett-info." });
        } else if (note === "perplexity_failed") {
          setBanner({ type: "info", text: "Kunde ej söka på webben – använder endast etikett-info." });
        } else if (note === "fastpath" || note === "fastpath_heuristic") {
          setBanner({ type: "info", text: "⚡ Snabbanalys – fyller profil utan webbsvar." });
        } else {
          setBanner({ type: "success", text: "Klart! Din vinprofil är uppdaterad." });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Kunde inte analysera bilden – försök igen i bättre ljus.";

      setBanner({ type: "error", text: errorMessage });

      toast({
        title: "Skanningen misslyckades",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgressStep(null);
      setProgressNote(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      cameraOpenedRef.current = false;
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setPreviewImage(imageData);
        await processWineImage(imageData);
      };
      reader.readAsDataURL(file);
    } else if (cameraOpenedRef.current) {
      // User cancelled camera - go back to the introduction page
      navigate(INTRO_ROUTE);
    }
  };

  const handleTakePhoto = () => {
    document.getElementById("wineImageUpload")?.click();
  };

  const handleReset = () => {
    setPreviewImage(null);
    setResults(null);
    setIsProcessing(false);
    setProgressStep(null);
    setBanner(null);
    setProgressNote(null);
    autoOpenedRef.current = false;
    cameraOpenedRef.current = false;

    // Re-open the camera/input on the next tick så användaren slipper tom skärm
    setTimeout(() => {
      document.getElementById("wineImageUpload")?.click();
    }, 0);
  };

  const handleRetryScan = () => {
    if (isProcessing) return;
    handleReset();
  };

  // --- helpers i komponenten, ovanför return ---
  const hasNumeric = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
  const metersOk = Boolean(
    results?.meters &&
      hasNumeric(results.meters.sötma) &&
      hasNumeric(results.meters.fyllighet) &&
      hasNumeric(results.meters.fruktighet) &&
      hasNumeric(results.meters.fruktsyra)
  );
  const hasWebEvidence = (results?.evidence?.webbträffar?.length ?? 0) > 0;
  const showVerifiedMeters = Boolean(metersOk && hasWebEvidence);

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
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#05020f] via-[#120c2b] to-[#030712] text-slate-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#8B5CF6]/25 blur-[150px]" />
          <div className="absolute right-[-120px] bottom-8 h-96 w-96 rounded-full bg-[#38BDF8]/10 blur-[170px]" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/70 to-transparent" />
        </div>

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
              <p className="text-sm text-slate-200/80">Din digitala sommelier</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-200 hover:text-white"
                onClick={() => navigate("/")}
              >
                Om WineSnap
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/20 bg-white/10 text-slate-100 hover:bg-white/20"
                onClick={() => navigate("/historik")}
              >
                Historik
              </Button>
              {showInstallCTA && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-white/20 bg-white/10 text-slate-100 hover:bg-white/20"
                  onClick={handleInstall}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Installera app
                </Button>
              )}
            </div>
          </header>

          {banner && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm transition ${
                banner.type === "error"
                  ? "border-red-500/40 bg-red-500/10 text-red-100"
                  : banner.type === "success"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                  : "border-sky-400/40 bg-sky-400/10 text-sky-100"
              }`}
            >
              {banner.text}
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-6">
              <ResultHeader
                vin={results.vin}
                ar={results.årgång}
                producent={results.producent}
                land_region={results.land_region}
                typ={results.typ}
              />

              {showVerifiedMeters ? (
                <MetersRow
                  meters={results.meters}
                  estimated={results?._meta?.meters_source === "derived"}
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-200">
                  <p className="mb-1 text-sm font-medium text-white">Smakprofil</p>
                  <p className="text-sm opacity-80">
                    Smakprofil kunde inte fastställas utan webbkällor.
                    {!hasWebEvidence &&
                      (results?.källa === "–" || results?.källa?.toLowerCase() === "etikett") && (
                        <> Prova igen när uppkoppling finns eller fota etiketten rakare.</>
                      )}
                  </p>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={handleRetryScan}>
                      Försök igen
                    </Button>
                  </div>
                </div>
              )}

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
                <p className="text-xs text-slate-300/80">
                  Upptäckt språk: {results.detekterat_språk.toUpperCase()}
                </p>
              )}

              <p className="text-xs text-slate-400/80">
                Resultatet sparas lokalt tillsammans med etikettbilden.
              </p>
            </div>

            {previewImage && (
              <aside className="lg:sticky lg:top-24">
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-xl backdrop-blur">
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#070311] via-[#12082A] to-[#0F172A] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#8B5CF6]/22 blur-[150px]" />
        <div className="absolute right-[-120px] bottom-8 h-96 w-96 rounded-full bg-[#38BDF8]/12 blur-[170px]" />
        <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/65 to-transparent" />
      </div>

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
            className="border-white/20 bg-white/10 text-slate-100 shadow-lg backdrop-blur hover:bg-white/20"
          >
            <Download className="mr-2 h-4 w-4" />
            Installera app
          </Button>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 pb-20 pt-12 text-center sm:px-8">
        <header className="mb-10 flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-lg shadow-purple-900/40">
              <Wine className="h-6 w-6 text-purple-100" />
            </div>
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">WineSnap</p>
              <p className="text-sm text-slate-200/80">Skanna vinetiketter med AI</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-200 hover:text-white"
              onClick={() => navigate("/")}
            >
              Om WineSnap
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-white/20 bg-white/10 text-slate-100 hover:bg-white/20"
              onClick={() => navigate("/historik")}
            >
              Historik
            </Button>
          </div>
        </header>

        {banner && (
          <div
            className={`mb-4 w-full rounded-2xl border px-4 py-3 text-sm transition ${
              banner.type === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-100"
                : banner.type === "success"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                : "border-sky-400/40 bg-sky-400/10 text-sky-100"
            }`}
          >
            {banner.text}
          </div>
        )}

        {isProcessing && !results && !previewImage && (
          <div className="mb-8 w-full rounded-3xl border border-white/10 bg-white/5 p-6 text-left">
            <ResultSkeleton />
          </div>
        )}

        {banner?.type === "error" && previewImage && (
          <div className="mb-6 flex w-full justify-center">
            <Button
              size="lg"
              onClick={() => processWineImage(previewImage)}
              className="h-12 rounded-full bg-gradient-to-r from-purple-600 to-indigo-500 text-white font-semibold shadow-lg hover:opacity-90 transition"
              disabled={isProcessing}
            >
              Försök igen
            </Button>
          </div>
        )}

        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-sm text-purple-100">
              <Sparkles className="h-4 w-4" />
              Klar för nästa skanning
            </p>
            <h1 className="text-3xl font-semibold text-white">Din digitala sommelier</h1>
            <p className="text-base text-slate-200/80">
              Fota etiketten och låt AI:n skapa en komplett vinprofil med smaknoter, serveringstips och matmatchningar – sparat lokalt för nästa gång.
            </p>
          </div>

          {previewImage && (
            <Card className="relative w-full overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-white/12 via-white/5 to-white/10 shadow-2xl shadow-purple-900/40">
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
                        <ProgressBanner step={progressStep} note={progressNote} />
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
              <p className="text-sm text-slate-300">
                Bäst resultat när etiketten fyller rutan och du fotar i mjukt ljus.
              </p>
            </div>
          )}

          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left text-sm text-slate-200/85">
            <p className="font-semibold text-white">Så funkar skanningen</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                "Justera flaskan tills guidelinjen blir grön.",
                "Vi kör OCR och AI-analys i bakgrunden.",
                "Resultatet sparas i historiken automatiskt.",
              ].map((tip, idx) => (
                <div key={tip} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
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
