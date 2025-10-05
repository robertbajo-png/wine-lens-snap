import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Wine, Loader2, Download, Grape, Wind, Thermometer, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getCachedAnalysis, setCachedAnalysis, type WineAnalysisResult } from "@/lib/wineCache";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const WineSnap = () => {
  const { toast } = useToast();
  const { isInstallable, isInstalled, handleInstall } = usePWAInstall();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<"vision" | null>(null);
  const [results, setResults] = useState<WineAnalysisResult | null>(null);

  const processWineImage = async (imageData: string) => {
    setIsProcessing(true);
    setProcessingStep("vision");
    
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

      // Call Vision API with direct fetch
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wine-vision`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({ 
          imageDataUrl: imageData,
          lang: "sv"
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data) {
        const result: WineAnalysisResult = {
          vin: data.vin || "Okänt",
          typ: data.typ || "Okänt",
          druva: data.druva || "Okänt",
          region: data.region || "Okänt",
          stil_smak: data.stil_smak || "Okänt",
          servering: data.servering || "Okänt",
          att_till: data.att_till || []
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
          <div className="space-y-4">
            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Wine className="h-5 w-5" />
                  Vin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground font-semibold text-lg">
                  {results.vin}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.typ} • {results.region}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Grape className="h-5 w-5" />
                  Druva
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground font-semibold text-lg">
                  {results.druva}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Wind className="h-5 w-5" />
                  Stil & smak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {results.stil_smak}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <Thermometer className="h-5 w-5" />
                  Servering
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground font-medium">
                  {results.servering}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                  <UtensilsCrossed className="h-5 w-5" />
                  Ät till
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.att_till.length > 0 ? (
                  <ul className="space-y-2">
                    {results.att_till.map((item, index) => (
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
                          Analyserar vinet...
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
