import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Wine, Loader2, Download, Grape, Wind, Thermometer, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Tesseract from "tesseract.js";
import { supabase } from "@/integrations/supabase/client";
import { getCachedAnalysis, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const WineSnap = () => {
  const { toast } = useToast();
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<"ocr" | "ai" | null>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);

  const processWineImage = async (imageData: string) => {
    setIsProcessing(true);
    setProcessingStep("ocr");
    
    try {
      // Step 1: Run OCR
      const languages = ['eng', 'fra', 'ita', 'spa', 'deu'];
      let allText = "";

      for (const lang of languages) {
        try {
          const { data } = await Tesseract.recognize(imageData, lang);
          if (data.text.trim()) {
            allText += data.text + "\n\n";
          }
        } catch (langError) {
          console.warn(`OCR failed for language ${lang}:`, langError);
        }
      }

      if (!allText.trim()) {
        throw new Error("No text recognized");
      }

      const ocrText = allText.trim();

      // Step 2: Check cache
      const cached = getCachedAnalysis(ocrText);
      if (cached) {
        setResults(cached);
        toast({
          title: "Klart!",
          description: "Analys hämtad från cache."
        });
        return;
      }

      // Step 3: Call AI
      setProcessingStep("ai");

      const { data, error } = await supabase.functions.invoke('analyzeWineAI', {
        body: { 
          ocrText,
          lang: "sv"
        }
      });

      if (error) throw error;

      if (data) {
        const result: WineAnalysisResult = {
          grape: data.grape || "",
          style: data.style || "",
          serve_temp_c: data.serve_temp_c || "",
          pairing: data.pairing || []
        };
        
        setResults(result);
        setCachedAnalysis(ocrText, result);
        
        toast({
          title: "Klart!",
          description: "Vinanalys slutförd."
        });
      }
    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Fel",
        description: "Kunde inte läsa etiketten – försök fota rakare och i bra ljus.",
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wine className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">WineSnap</h1>
          </div>
          <p className="text-muted-foreground">Analysera din vinflaska med AI</p>
          
          {/* PWA Install Button */}
          {isInstallable && !isInstalled && (
            <Button 
              onClick={handleInstall}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <Download className="mr-2 h-4 w-4" />
              Installera app
            </Button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          id="wineImageUpload"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Image Preview with Processing Overlay */}
        {previewImage && (
          <Card className="relative overflow-hidden animate-fade-in">
            <CardContent className="p-4">
              <div className="relative">
                <img 
                  src={previewImage} 
                  alt="Wine bottle" 
                  className="w-full rounded-lg shadow-md max-h-96 object-contain bg-muted"
                />
                
                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg animate-fade-in">
                    <div className="text-center space-y-3">
                      <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                      <p className="text-lg font-medium">
                        {processingStep === "ocr" && "Läser etikett..."}
                        {processingStep === "ai" && "Analyserar vinet..."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {results && !isProcessing && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-2xl font-semibold text-center">Analys</h2>
            
            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Grape className="h-5 w-5 text-primary" />
                  Druva
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground font-medium">
                  {results.grape}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wind className="h-5 w-5 text-primary" />
                  Stil & smak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {results.style}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-primary" />
                  Servering
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {results.serve_temp_c}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  Ät till
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.pairing.length > 0 ? (
                  <ul className="space-y-2">
                    {results.pairing.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Inga förslag tillgängliga</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main CTA Button */}
        <div className="fixed bottom-8 left-0 right-0 px-4 max-w-2xl mx-auto">
          <Button 
            onClick={results ? handleReset : handleTakePhoto}
            className="w-full"
            size="lg"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Bearbetar...
              </>
            ) : results ? (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Fota ny flaska
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Fota vinflaska
              </>
            )}
          </Button>
        </div>

        {/* Spacer for fixed button */}
        <div className="h-20" />
      </div>
    </div>
  );
};

export default WineSnap;
