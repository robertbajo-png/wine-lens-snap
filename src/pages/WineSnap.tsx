import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, Wine, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Tesseract from "tesseract.js";

const WineSnap = () => {
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [results, setResults] = useState({
    grape: "",
    style: "",
    serve: "",
    pairing: ""
  });

  const runOCR = async (imageData: string) => {
    setIsOcrRunning(true);
    setOcrProgress(0);
    setOcrText("");

    try {
      const languages = ['eng', 'fra', 'ita', 'spa', 'deu'];
      let allText = "";

      for (const lang of languages) {
        try {
          const { data } = await Tesseract.recognize(
            imageData,
            lang,
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  setOcrProgress(Math.round(m.progress * 100));
                }
              }
            }
          );
          if (data.text.trim()) {
            allText += data.text + "\n\n";
          }
        } catch (langError) {
          console.warn(`OCR failed for language ${lang}:`, langError);
        }
      }

      if (allText.trim()) {
        setOcrText(allText.trim());
      } else {
        throw new Error("No text recognized");
      }
    } catch (error) {
      console.error("OCR error:", error);
      toast({
        title: "OCR-fel",
        description: "Kunde inte läsa etiketten – försök fota rakare och i bra ljus.",
        variant: "destructive"
      });
      setOcrText("");
    } finally {
      setIsOcrRunning(false);
      setOcrProgress(0);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setPreviewImage(imageData);
        await runOCR(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTakePhoto = () => {
    document.getElementById("wineImageUpload")?.click();
  };

  const handleAnalyze = () => {
    // Placeholder for analysis logic
    setOcrText("Mock OCR text extracted from wine label...");
    setResults({
      grape: "Cabernet Sauvignon",
      style: "Full-bodied, dry red wine with notes of blackcurrant and oak",
      serve: "Serve at 16-18°C in a large bordeaux glass",
      pairing: "Perfect with grilled meats, aged cheeses, or hearty stews"
    });
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
        </div>

        {/* Photo Section */}
        <Card>
          <CardHeader>
            <CardTitle>Fota eller ladda upp vinflaska</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button 
                id="takePhotoBtn" 
                onClick={handleTakePhoto}
                className="flex-1"
                variant="default"
              >
                <Camera className="mr-2 h-4 w-4" />
                Öppna kamera
              </Button>
              <Button 
                variant="secondary"
                className="flex-1"
                onClick={() => document.getElementById("wineImageUpload")?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Ladda upp
              </Button>
            </div>
            
            <input
              id="wineImageUpload"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewImage && (
              <div id="wineImagePreview" className="mt-4">
                <img 
                  src={previewImage} 
                  alt="Wine bottle preview" 
                  className="w-full rounded-lg shadow-md max-h-96 object-contain bg-muted"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* OCR Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Extraherad text (OCR)</span>
              {isOcrRunning && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {ocrProgress}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="ocrText"
              readOnly
              value={ocrText}
              placeholder="Text från vinflaskans etikett visas här..."
              className="min-h-32 resize-none bg-muted"
            />
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Resultat</h2>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Druva</CardTitle>
            </CardHeader>
            <CardContent>
              <p id="resGrape" className="text-muted-foreground">
                {results.grape || "Väntar på analys..."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stil/smak</CardTitle>
            </CardHeader>
            <CardContent>
              <p id="resStyle" className="text-muted-foreground">
                {results.style || "Väntar på analys..."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Servering</CardTitle>
            </CardHeader>
            <CardContent>
              <p id="resServe" className="text-muted-foreground">
                {results.serve || "Väntar på analys..."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Matparning</CardTitle>
            </CardHeader>
            <CardContent>
              <p id="resPairing" className="text-muted-foreground">
                {results.pairing || "Väntar på analys..."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analyze Button */}
        <Button 
          id="analyzeBtn"
          onClick={handleAnalyze}
          className="w-full"
          size="lg"
          disabled={!previewImage}
        >
          Analysera vin
        </Button>
      </div>
    </div>
  );
};

export default WineSnap;
