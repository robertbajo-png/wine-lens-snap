import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Wine, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<"prep" | "ocr" | "analysis" | null>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);

  const processWineImage = async (imageData: string) => {
    // Get user's language from browser
    const uiLang = navigator.language || "sv-SE";
    console.log("UI Language:", uiLang);
    
    setIsProcessing(true);
    setProcessingStep("prep");
    
    try {
      // Check cache first (using image data as key)
      const cached = getCachedAnalysis(imageData);
      if (cached) {
        setResults(cached);
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

      const data = await response.json();
      console.log("Received data from vision API:", data);

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
        setCachedAnalysis(imageData, result);
        
        toast({
          title: "Klart!",
          description: "Vinanalys slutförd."
        });
      }
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Kunde inte analysera bilden – försök fota rakare och i bra ljus.",
        variant: "destructive"
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
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setPreviewImage(imageData);
        await processWineImage(imageData);
      };
      reader.readAsDataURL(file);
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
  };

  // Show results view if we have results
  if (results && !isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-[#F6F3F9] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 animate-fade-in pb-24">
          <WineCardSBFull data={results} />

          {/* Fixed Bottom Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
            <div className="max-w-md mx-auto">
              <Button 
                onClick={handleReset}
                className="w-full max-w-[320px] mx-auto block h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                Fota ny flaska
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main landing page
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[#F6F3F9] flex flex-col">
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

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Logo & Header */}
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Wine className="h-10 w-10 text-white" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-5xl font-bold text-accent tracking-wide" style={{ letterSpacing: '0.5px' }}>
                WineSnap
              </h1>
              <h3 className="text-muted-foreground text-base max-w-[280px] mx-auto leading-relaxed">
                Fota vinflaskan – få druva, smakprofil och matparning.
              </h3>
            </div>
          </div>

          {/* Image Preview with Processing Overlay */}
          {previewImage && (
            <Card className="relative overflow-hidden shadow-xl animate-fade-in">
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
                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                        <p className="text-lg font-semibold text-foreground">
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

          {/* Main CTA Button */}
          {!previewImage && (
            <div className="space-y-3 animate-fade-in" style={{ animationDelay: '150ms' }}>
              <Button 
                id="takePhotoBtn"
                onClick={handleTakePhoto}
                className="w-full max-w-[320px] h-14 text-lg font-semibold shadow-[0_4px_12px_rgba(123,31,162,0.3)] hover:shadow-[0_6px_20px_rgba(123,31,162,0.4)] transition-all duration-300 hover:scale-[1.02]"
                size="lg"
                disabled={isProcessing}
              >
                <Camera className="mr-2 h-5 w-5" />
                Fota vinflaska
              </Button>
              
              <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                Bäst resultat i bra ljus och rak etikett.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by AI • WineSnap 2025
        </p>
      </footer>
    </div>
  );
};

export default WineSnap;
