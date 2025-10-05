import { Button } from "@/components/ui/button";
import { Wine, Camera, Sparkles, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F5FC]">
      {/* Top bar */}
      <header className="w-full bg-[#7B3FE4] py-3 px-6">
        <h1 className="text-white text-center font-semibold text-lg">
          WineSnap – AI Wine Analysis
        </h1>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="flex flex-col items-center justify-center space-y-6 max-w-md w-full">
          {/* Logo and tagline */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Wine className="h-20 w-20 text-[#7B3FE4]" />
            </div>
            <h2 className="text-4xl font-bold text-[#333]">WineSnap</h2>
            <p className="text-lg text-[#333] leading-relaxed">
              Upptäck allt om ditt vin med AI-driven bildanalys.
            </p>
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-4 pt-4">
            <Button
              onClick={() => navigate("/winesnap")}
              className="w-full bg-[#7B3FE4] hover:bg-[#6B2FD4] text-white rounded-2xl py-6 text-lg font-medium shadow-lg"
              size="lg"
            >
              <Camera className="mr-3 h-6 w-6" />
              📷 Fota vinflaska
            </Button>

            <Button
              onClick={() => navigate("/winesnap")}
              className="w-full bg-[#B99DF2] hover:bg-[#A98DE2] text-white rounded-2xl py-6 text-lg font-medium shadow-md"
              size="lg"
            >
              <Sparkles className="mr-3 h-6 w-6" />
              🤖 AI-analys
            </Button>

            <Button
              onClick={() => navigate("/winesnap")}
              className="w-full bg-[#E5E7EB] hover:bg-[#D1D5DB] text-[#333] rounded-2xl py-6 text-lg font-medium shadow-sm"
              size="lg"
            >
              <Utensils className="mr-3 h-6 w-6" />
              🍽️ Matparning
            </Button>
          </div>

          {/* Tip text */}
          <p className="text-sm text-gray-500 text-center pt-2">
            Bäst resultat i bra ljus och rak etikett.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center">
        <p className="text-sm text-gray-500">
          Powered by AI • WineSnap 2025
        </p>
      </footer>
    </div>
  );
};

export default Index;
