import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ForYou = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-theme-card/60 bg-theme-elevated/80 px-8 py-12 backdrop-blur">
          <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/30 px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/80">
            <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
            För dig
          </span>
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Personliga rekommendationer</h1>
          <p className="max-w-md text-sm text-theme-secondary/80 sm:text-base">
            Vi bygger något magiskt här. Snart hittar du skräddarsydda vinrekommendationer baserade på dina analyser.
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <span className="text-sm font-medium uppercase tracking-[0.3em] text-theme-secondary/60">Kommer snart</span>
            <Button
              size="lg"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] px-6 text-theme-primary shadow-[0_18px_45px_-20px_rgba(123,63,228,1)] transition hover:opacity-90"
              onClick={() => navigate("/scan")}
            >
              <Camera className="h-4 w-4 transition group-hover:-translate-y-0.5" aria-hidden="true" />
              Fota vinflaska
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForYou;
