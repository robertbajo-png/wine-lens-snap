import { Button } from "@/components/ui/button";
import { Wine, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#FBF8FF] to-white">
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

        {/* Primary button */}
        <Button
          onClick={() => navigate("/winesnap")}
          className="w-full max-w-[320px] bg-[#7B3FE4] hover:bg-[#6A32D9] text-white rounded-2xl py-3 shadow-lg transition-all duration-300"
          size="lg"
        >
          <Camera className="mr-2 h-5 w-5" />
          📷 Fota vinflaska
        </Button>

        {/* Help text */}
        <p className="text-sm text-gray-500 text-center mt-3">
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
