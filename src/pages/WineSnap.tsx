import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Wine, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCachedAnalysis, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import WineCardSBFull from "@/components/WineCardSBFull";
import { inferMetrics } from "@/lib/inferMetrics";
import { preprocessImage } from "@/lib/imagePrep";
import { createWorker } from "tesseract.js";

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
  const [banner, setBanner] = useState<{type:"info"|"error"|"success"; text:string}|null>(null);

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
      // Check cache first (using image data as key)
      const cached = getCachedAnalysis(imageData);
      if (cached) {
        setResults(cached);
        setBanner({ type: "info", text: "Hämtade sparad analys från din enhet." });
        toast({
          title: "Klart!",
          description: "Analys hämtad från cache."
        });
        setIsProcessing(false);
        setProcessingStep(null);
        return;
      }

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
        setBanner({ type:"error", text: "Tyvärr, ingen data tillgänglig för denna flaska – prova en annan bild eller kontrollera uppkopplingen." });
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
        setCachedAnalysis(imageData, result, imageData);
        
        // Show banner based on note
        if (note === "hit_memory" || note === "hit_supabase") {
          setBanner({ type:"info", text: "Hämtade sparad profil för snabbare upplevelse." });
        } else if (note === "perplexity_timeout") {
          setBanner({ type:"info", text: "Webbsökning tog för lång tid – använder endast etikett-info." });
        } else if (note === "perplexity_failed") {
          setBanner({ type:"info", text: "Kunde ej söka på webben – använder endast etikett-info. Kolla loggarna för detaljer." });
        } else {
          setBanner({ type:"success", text: "Klart! Din vinprofil är uppdaterad." });
        }
      }
    } catch (error) {
      console.error("Processing error:", error);
      setBanner({ 
        type:"error", 
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
      // User cancelled camera - go back to Index
      navigate("/");
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

    // Re-open the camera/input on the next tick so användaren slipper tom skärm
    setTimeout(() => {
      document.getElementById("wineImageUpload")?.click();
    }, 0);
  };

  // Show results view if we have results
  if (results && !isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in pb-24">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/historik")}
              className="text-muted-foreground hover:text-foreground"
            >
              Historik
            </Button>
          </div>
          {/* Banner */}
          {banner && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${
              banner.type === "error"
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : banner.type === "success" 
                ? "bg-primary/10 text-primary border-primary/20" 
                : "bg-accent/10 text-accent border-accent/20"
            }`}>
              {banner.text}
            </div>
          )}
          
          <WineCardSBFull data={results} />

          {/* Fixed Bottom Button */}
          <div className="fixed inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 bg-gradient-to-t from-white via-white to-transparent backdrop-blur">
            <div className="max-w-md mx-auto">
              <Button
                onClick={handleReset}
                size="lg"
                className="w-full flex items-center justify-center gap-2 h-14 text-base font-semibold rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-white shadow-[0_12px_30px_-12px_rgba(123,63,228,0.8)] hover:shadow-[0_18px_36px_-14px_rgba(123,63,228,0.9)] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#7B3FE4]/60"
              >
                <Camera className="h-5 w-5" />
                Fota ny flaska
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no image and no results, auto-open camera and render only the hidden input (no second screen)
  if (!previewImage && !results) {
    return (
      <div className="min-h-screen">
        <input
          id="wineImageUpload"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // Main landing page
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#FBF8FF] to-white">
      {/* Hidden file input */}
      <input
        id="wineImageUpload"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* PWA Install Button - Top Right */}
      {isInstallable && !isInstalled && (
        <div className="absolute top-4 right-4 z-10">
          <Button 
            onClick={handleInstall}
            variant="outline"
            size="sm"
            className="shadow-md"
          >
            <Download className="mr-2 h-4 w-4" />
            Installera app
          </Button>
        </div>
      )}

      <div className="flex flex-col items-center justify-center space-y-6 max-w-[480px] w-full px-4">
        {/* Icon in circle */}
        <div className="w-12 h-12 rounded-full bg-[#7B3FE4] flex items-center justify-center">
          <Wine className="h-6 w-6 text-white" />
        </div>

        {/* Title and description */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-[#333]">WineSnap</h1>
          <p className="text-base text-gray-600 leading-relaxed">
            Fota vinflaskan – få druva, smakprofil och matparning.
          </p>
        </div>

        {/* Image Preview with Processing Overlay */}
        {previewImage && (
          <Card className="relative overflow-hidden shadow-xl animate-fade-in w-full">
            <CardContent className="p-4">
              <div className="relative">
                <img 
                  src={previewImage} 
                  alt="Wine bottle" 
                  className="w-full rounded-lg max-h-80 object-contain bg-muted"
                />
                
                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center space-y-3">
                      <Loader2 className="h-12 w-12 animate-spin text-[#7B3FE4] mx-auto" />
                      <p className="text-lg font-semibold text-[#333]">
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

        {/* Primary button */}
        {!previewImage && (
          <div className="space-y-3 w-full flex flex-col items-center">
            <Button
              onClick={handleTakePhoto}
              className="w-full max-w-[320px] bg-[#7B3FE4] hover:bg-[#6A32D9] text-white rounded-2xl py-3 shadow-lg transition-all duration-300"
              size="lg"
              disabled={isProcessing}
            >
              <Camera className="mr-2 h-5 w-5" />
              📷 Fota vinflaska
            </Button>

            {/* Help text */}
            <p className="text-sm text-gray-500 text-center mt-3">
              Bäst resultat i bra ljus och rak etikett.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 w-full text-center">
        <p className="text-xs text-gray-400">
          Powered by AI • WineSnap 2025
        </p>
      </footer>
    </div>
  );
};

export default WineSnap;
