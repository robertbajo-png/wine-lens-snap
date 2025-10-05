import { Button } from "@/components/ui/button";
import { Wine, Camera, Sparkles, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Camera,
      emoji: "📷",
      title: "Fota vinflaska",
      description: "Ta ett foto av din vinflaska direkt i appen."
    },
    {
      icon: Sparkles,
      emoji: "🤖",
      title: "AI-analys",
      description: "Få detaljerad information om druva, smak och servering."
    },
    {
      icon: Utensils,
      emoji: "🍽️",
      title: "Matparning",
      description: "Upptäck perfekta maträtter till ditt vin."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#FBF8FF] to-white px-4">
      <div className="flex flex-col items-center justify-center space-y-12 max-w-6xl w-full">
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

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isClickable = index === 0; // Only first card (camera) is clickable
            
            if (isClickable) {
              return (
                <button
                  key={index}
                  onClick={() => navigate("/winesnap")}
                  className="bg-white/80 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 w-full md:w-64 mx-auto text-center space-y-3 hover:scale-105 border-2 border-[#7B3FE4]"
                >
                  <div className="flex justify-center">
                    <div className="w-14 h-14 rounded-full bg-[#7B3FE4] flex items-center justify-center">
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-[#333] flex items-center justify-center gap-2">
                    <span>{feature.emoji}</span>
                    <span>{feature.title}</span>
                  </h3>
                  
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </button>
              );
            }
            
            return (
              <div
                key={index}
                className="bg-white/60 rounded-2xl shadow-md p-6 w-full md:w-64 mx-auto text-center space-y-3"
              >
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#F8F5FC] flex items-center justify-center">
                    <Icon className="h-7 w-7 text-[#7B3FE4]" />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-[#333] flex items-center justify-center gap-2">
                  <span>{feature.emoji}</span>
                  <span>{feature.title}</span>
                </h3>
                
                <p className="text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
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
