import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Compass, Grip, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const categories = ["Druvor", "Regioner", "Stilar", "Matmatchning", "Prisnivåer", "Butiker"];

const Explore = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="absolute right-4 top-6 z-20">
        <Button
          className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
          onClick={() => navigate("/scan")}
          aria-label="Starta ny skanning"
        >
          <Camera className="h-4 w-4" />
          Ny skanning
        </Button>
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/20 px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/70">
            <Compass className="h-4 w-4 text-theme-primary" aria-hidden="true" />
            Utforska
          </span>
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Snart öppnar vinbiblioteket</h1>
          <p className="mx-auto max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
            Här kommer du kunna söka efter etiketter, filtrera på stilar och följa kategorier som matchar din smak.
            Vi förbereder gränssnittet – under tiden kan du planera vad du vill upptäcka först.
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-3xl border border-theme-card/60 bg-theme-elevated/80 p-8 backdrop-blur">
          <label className="flex flex-col gap-2 text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-theme-secondary/60">Sök i vinarkivet</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-secondary/50" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Sök snart bland tusentals etiketter"
                disabled
                className="h-12 rounded-full border-theme-card/60 bg-theme-card/20 pl-10 text-theme-secondary/70 placeholder:text-theme-secondary/50"
              />
            </div>
          </label>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-theme-secondary/60">
              <Grip className="h-4 w-4" aria-hidden="true" />
              Kategorier
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant="outline"
                  disabled
                  className="cursor-not-allowed rounded-full border-theme-card/50 bg-theme-card/20 px-4 text-sm font-medium text-theme-secondary/70"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explore;
