import { Button } from "@/components/ui/button";
import { Wine, Camera, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-8 px-4">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Wine className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-5xl font-bold text-foreground">WineSnap</h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Upptäck allt om ditt vin med AI-driven bildanalys
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <Button 
            size="lg" 
            onClick={() => navigate("/winesnap")}
            className="w-full text-lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Starta WineSnap
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12">
          <div className="space-y-2">
            <Camera className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">Fota vinflaska</h3>
            <p className="text-sm text-muted-foreground">Ta ett foto av din vinflaska direkt i appen</p>
          </div>
          <div className="space-y-2">
            <Sparkles className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">AI-analys</h3>
            <p className="text-sm text-muted-foreground">Få detaljerad information om druva, smak och servering</p>
          </div>
          <div className="space-y-2">
            <Wine className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">Matparning</h3>
            <p className="text-sm text-muted-foreground">Upptäck perfekta maträtter till ditt vin</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
