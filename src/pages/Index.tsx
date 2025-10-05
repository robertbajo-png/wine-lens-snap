import { Button } from "@/components/ui/button";
import { Wine, Camera, Sparkles, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#FBF8FF] to-white px-4">
      <div className="flex flex-col items-center justify-center space-y-12 max-w-2xl w-full">
        {/* Header section */}
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#7B3FE4] flex items-center justify-center mx-auto">
            <Wine className="h-6 w-6 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-[#333]">WineSnap</h1>
          
          <p className="text-lg text-gray-600 leading-relaxed max-w-lg">
            Upptäck allt om ditt vin med AI-driven bildanalys.
          </p>
        </div>

        {/* Main CTA - Photo button */}
        <button
          onClick={() => navigate("/winesnap")}
          className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 w-full max-w-sm text-center space-y-4 hover:scale-105 border-2 border-[#7B3FE4]"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#7B3FE4] flex items-center justify-center">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-[#333]">
            📷 Fota vinflaska
          </h2>
          
          <p className="text-sm text-gray-600 leading-relaxed">
            Ta ett foto av din vinflaska direkt i appen
          </p>
        </button>

        {/* Info features - non-clickable */}
        <div className="space-y-4 w-full max-w-md">
          <div className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0 mt-1">
              <Sparkles className="h-5 w-5 text-[#7B3FE4]" />
            </div>
            <div>
              <h3 className="font-medium text-[#333] mb-1">🤖 AI-analys</h3>
              <p className="text-sm text-gray-600">
                Få detaljerad information om druva, smak och servering
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-left">
            <div className="flex-shrink-0 mt-1">
              <Utensils className="h-5 w-5 text-[#7B3FE4]" />
            </div>
            <div>
              <h3 className="font-medium text-[#333] mb-1">🍽️ Matparning</h3>
              <p className="text-sm text-gray-600">
                Upptäck perfekta maträtter till ditt vin
              </p>
            </div>
          </div>
        </div>

        {/* Help text */}
        <p className="text-sm text-gray-500 text-center">
          Bäst resultat i bra ljus och rak etikett.
        </p>
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

export default Index;
