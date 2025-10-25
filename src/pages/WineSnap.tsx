import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  Wine,
  Loader2,
  Download,
  Sparkles,
  ChefHat,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getCachedAnalysis, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { SystembolagetTasteProfile } from "@/components/SystembolagetTasteProfile";
import { SystembolagetClassification } from "@/components/SystembolagetClassification";
import { SystembolagetFactList } from "@/components/SystembolagetFactList";
import { preprocessImage } from "@/lib/imagePrep";
import { createWorker } from "tesseract.js";

const INTRO_ROUTE = "/";

// OCR language support - comprehensive wine label coverage
const OLANGS = [
  // Europa (latinskt)
  "eng","swe","hun","deu","fra","spa","ita","por","nld","nor","dan","fin",
  "pol","ces","slk","slv","ron","hrv","srp_latn",
  // Central/öst
  "tur","ell","bul","ukr","rus","mkd","lav","lit","est",
  // RTL/CJK/SEA
  "heb","ara","fas","urd",
  "chi_sim","chi_tra","jpn","kor",
  "tha","vie","ind","msa"
].join("+");

const WineSnap = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<"prep" | "ocr" | "analysis" | null>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);
  const [banner, setBanner] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);

  // Auto-trigger camera on mount if no image/results
  const autoOpenedRef = useRef(false);
  const cameraOpenedRef = useRef(false);

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
    // Get user's language from browser
    const uiLang = navigator.language || "sv-SE";
    console.log("UI Language:", uiLang);

    setIsProcessing(true);
    setProcessingStep("prep");
    setBanner(null);

    try {
      // Step 1: Preprocess image
      console.log("Step 1: Preprocessing image...");
      const processedImage = await preprocessImage(imageData);
      console.log("Image preprocessed, size:", processedImage.length);

      // Step 2: OCR with Tesseract.js (multi-language support)
      setProcessingStep("ocr");
      console.log("Step 2: Running OCR with Tesseract.js...");
      console.log("OCR languages:", OLANGS);

      const worker = await createWorker(OLANGS);
      const { data: { text } } = await worker.recognize(processedImage);
      await worker.terminate();

      // Normalize text: NFC normalization + whitespace cleanup
      const ocrText = text.normalize("NFC").replace(/\s{2,}/g, " ").trim();
      console.log("OCR text length:", ocrText.length);
      console.log("OCR text preview:", ocrText.substring(0, 200));

      const noTextFound = ocrText.length < 10;
      console.log("No text found flag:", noTextFound);

      const cacheLookupKey = !noTextFound && ocrText ? ocrText : imageData;
      const cached = getCachedAnalysis(cacheLookupKey);
      if (cached) {
        setResults(cached);
        setBanner({ type: "info", text: "Hämtade sparad analys från din enhet." });
        toast({
          title: "Klart!",
          description: "Analys hämtad från cache.",
        });
        setIsProcessing(false);
        setProcessingStep(null);
        return;
      }

      // Step 3: GPT Analysis with OCR text
      setProcessingStep("analysis");
      console.log("Step 3: Analyzing with GPT...");

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wine-vision`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          ocrText,
          imageBase64: processedImage,
          noTextFound,
          uiLang
        })
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Edge function error:", errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      console.log("Received data from vision API:", responseData);

      // Handle new response format: { ok, data, note }
      if (!responseData.ok) {
        setBanner({ type: "error", text: "Tyvärr, ingen data tillgänglig för denna flaska – prova en annan bild eller kontrollera uppkopplingen." });
        setResults(responseData.data || {
          vin: "–", land_region: "–", producent: "–", druvor: "–", årgång: "–",
          typ: "–", färgtyp: "–", klassificering: "–", alkoholhalt: "–", volym: "–",
          karaktär: "–", smak: "–", passar_till: [], servering: "–", sockerhalt: "–",
          syra: "–", källa: "–",
          meters: { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null },
          evidence: { etiketttext: "", webbträffar: [] }
        });
        setIsProcessing(false);
        setProcessingStep(null);
        return;
      }

      const data = responseData.data;
      const note = responseData.note;

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
          meters: data.meters || { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null },
          evidence: data.evidence || { etiketttext: "", webbträffar: [] },
          detekterat_språk: data.detekterat_språk,
          originaltext: data.originaltext
        };

        setResults(result);
        setCachedAnalysis(cacheLookupKey, result, imageData);

        // Show banner based on note
        if (note === "hit_memory" || note === "hit_supabase") {
          setBanner({ type: "info", text: "Hämtade sparad profil för snabbare upplevelse." });
        } else if (note === "perplexity_timeout") {
          setBanner({ type: "info", text: "Webbsökning tog för lång tid – använder endast etikett-info." });
        } else if (note === "perplexity_failed") {
          setBanner({ type: "info", text: "Kunde ej söka på webben – använder endast etikett-info. Kolla loggarna för detaljer." });
        } else {
          setBanner({ type: "success", text: "Klart! Din vinprofil är uppdaterad." });
        }
      }
    } catch (error) {
      console.error("Processing error:", error);
      setBanner({
        type: "error",
        text: error instanceof Error ? error.message : "Kunde inte analysera bilden – försök fota rakare och i bra ljus."
      });
      setPreviewImage(null);
    } finally {
      setIsProcessing(false);
      setProcessingStep(null);
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
    setProcessingStep(null);
    setBanner(null);
    autoOpenedRef.current = false;
    cameraOpenedRef.current = false;

    // Re-open the camera/input on the next tick så användaren slipper tom skärm
    setTimeout(() => {
      document.getElementById("wineImageUpload")?.click();
    }, 0);
  };

  // Show results view if we have results
  if (results && !isProcessing) {
    const pairings = Array.isArray(results.passar_till)
      ? results.passar_till.filter(Boolean)
      : [];

    const classificationSummary = Array.from(
      new Set(
        [results.färgtyp, results.typ, results.klassificering]
          .map((value) => value?.trim())
          .filter(Boolean) as string[]
      )
    );

    const baseFacts = [
      { label: "Producent", value: results.producent || "–" },
      { label: "Land/Region", value: results.land_region || "–" },
      { label: "Årgång", value: results.årgång || "–" },
      { label: "Druvor", value: results.druvor || "–" },
    ];

    const technicalFacts = [
      { label: "Alkoholhalt", value: results.alkoholhalt || "–" },
      { label: "Volym", value: results.volym || "–" },
      { label: "Sockerhalt", value: results.sockerhalt || "–" },
      { label: "Syra", value: results.syra || "–" },
    ];

    const classificationTags = [
      { label: "Färg", value: results.färgtyp },
      { label: "Smaktyp", value: results.typ },
      { label: "Ursprungsangivelse", value: results.klassificering },
    ]
      .map((tag) => ({ ...tag, value: tag.value?.trim() }))
      .filter((tag) => tag.value);

    const evidenceText = results.evidence?.etiketttext?.trim();
    const webSources = results.evidence?.webbträffar?.filter(Boolean) ?? [];
    const showInstallCTA = isInstallable && !isInstalled;

    const subtitleParts = [
      results.producent || undefined,
      results.land_region || undefined,
      results.årgång ? `Årgång ${results.årgång}` : undefined,
    ].filter(Boolean);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <input
          id="wineImageUpload"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-20 pt-10 sm:px-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-lg shadow-purple-900/30">
                <Wine className="h-6 w-6 text-purple-100" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">WineSnap</p>
                <p className="text-sm text-slate-200/80">Analys enligt Systembolagets modell</p>
              </div>
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
                Öppna historiken
              </Button>
            </div>
          </header>

          {banner && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm backdrop-blur transition ${
                banner.type === "error"
                  ? "border-destructive/40 bg-destructive/20 text-red-100"
                  : banner.type === "success"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                  : "border-sky-400/30 bg-sky-400/10 text-sky-100"
              }`}
            >
              {banner.text}
            </div>
          )}

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-purple-900/20 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-purple-200/80">
                  <Sparkles className="h-3.5 w-3.5" />
                  Systembolagets analys
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold text-white">{results.vin || "Okänt vin"}</h1>
                  <p className="text-sm text-slate-200/80">{subtitleParts.join(" • ")}</p>
                  {classificationTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {classificationTags.map((tag) => (
                        <span
                          key={tag.label}
                          className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-100"
                        >
                          <span className="text-[10px] uppercase tracking-[0.25em] text-purple-200/70">{tag.label}</span>
                          <span className="font-semibold text-white">{tag.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {classificationSummary.length > 0 && (
                  <p className="text-xs text-slate-300/90">
                    Systembolaget placerar vinet i {classificationSummary.join(" • ")}.
                  </p>
                )}
              </div>
              {previewImage && (
                <div className="w-full max-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <img src={previewImage} alt="Skannad vinetikett" className="w-full object-cover" />
                </div>
              )}
            </div>

            <SystembolagetClassification result={results} />

            <SystembolagetTasteProfile result={results} />

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-slate-200/85">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Sparkles className="h-4 w-4 text-purple-200" />
                  Systembolagets smakbeskrivning
                </h2>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-purple-200/60">Karaktär</p>
                <p className="mt-2 leading-relaxed">
                  {results.karaktär || "Systembolagets karaktärstext saknas för den här flaskan."}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.25em] text-purple-200/60">Smaknoter</p>
                <p className="mt-2 leading-relaxed">
                  {results.smak || "Smaknoter saknas för den här flaskan."}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-sm text-slate-200/85">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <ChefHat className="h-4 w-4 text-emerald-200" />
                  Servering enligt Systembolaget
                </h2>
                <p className="mt-3 leading-relaxed">
                  {results.servering || "Systembolaget har inte publicerat serveringsråd för den här flaskan."}
                </p>
                {pairings.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Passar till</p>
                    <ul className="list-inside list-disc space-y-1 text-slate-200/85">
                      {pairings.slice(0, 6).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-slate-300">Inga matmatchningar är registrerade.</p>
                )}
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <SystembolagetFactList
                title="Systembolagets nyckelfakta"
                subtitle="Från artikelinformationen."
                items={baseFacts}
              />

              <SystembolagetFactList
                title="Analysdata"
                subtitle="Tekniska värden från Systembolaget."
                items={technicalFacts}
                footnote={`Källa: ${results.källa || "–"}`}
              >
                {(evidenceText || webSources.length > 0) && (
                  <div className="mt-4 text-xs text-slate-400">
                    <p className="font-semibold text-slate-300">Transparens</p>
                    {evidenceText && (
                      <p className="mt-2 leading-relaxed">
                        OCR: {evidenceText.slice(0, 240)}
                        {evidenceText.length > 240 ? "…" : ""}
                      </p>
                    )}
                    {webSources.length > 0 && (
                      <ul className="mt-2 list-disc pl-4">
                        {webSources.map((source) => (
                          <li key={source}>{source}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </SystembolagetFactList>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-slate-200/85">
                <h3 className="text-base font-semibold text-white">Detekterad etiketttext</h3>
                {results.originaltext ? (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {results.originaltext}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">Ingen OCR-text sparad för etiketten.</p>
                )}
                {results.detekterat_språk && (
                  <p className="mt-3 text-xs text-slate-400">
                    Upptäckt språk: {results.detekterat_språk.toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
              <Button
                onClick={handleReset}
                size="lg"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-base font-semibold text-white shadow-[0_18px_45px_-20px_rgba(123,63,228,1)] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#9C5CFF]/70 sm:w-auto"
              >
                <Camera className="h-5 w-5" />
                Fota ny flaska
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full border-white/20 bg-white/10 text-slate-100 hover:bg-white/20 sm:w-auto"
                onClick={() => navigate("/historik")}
              >
                Öppna historiken
              </Button>
              {showInstallCTA && (
                <Button
                  variant="outline"
                  className="w-full rounded-full border-white/25 bg-white/10 text-slate-100 hover:bg-white/20 sm:w-auto"
                  onClick={handleInstall}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Installera app
                </Button>
              )}
            </div>
          </section>

          <div className="pb-6 text-center text-xs text-slate-500">
            Resultatet sparas lokalt i historiken tillsammans med etikettbilden.
          </div>
        </div>
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
                      <div className="space-y-3 text-center">
                        <Loader2 className="mx-auto h-10 w-10 animate-spin text-purple-200" />
                        <p className="text-lg font-semibold text-white">
                          {processingStep === "prep" && "Förbereder bild..."}
                          {processingStep === "ocr" && "Läser etikett..."}
                          {processingStep === "analysis" && "Analyserar vin..."}
                        </p>
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
