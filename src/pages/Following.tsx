import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Following = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl border-theme-card/60 bg-theme-elevated/80 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-5 px-8 py-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/20 px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/70">
              <Users2 className="h-4 w-4 text-theme-primary" aria-hidden="true" />
              Följer
            </span>
            <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Följ dina favoriter</h1>
            <p className="max-w-md text-sm text-theme-secondary/80 sm:text-base">
              Snart kan du se uppdateringar från producenter, sommelierer och butiker du följer. Här dyker listor, tips och liveflöden upp så fort funktionen är redo.
            </p>
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm font-medium uppercase tracking-[0.3em] text-theme-secondary/60">Listan är tom</span>
              <Button
                size="lg"
                variant="outline"
                className="group inline-flex items-center gap-2 rounded-full border-theme-card/50 bg-theme-card/30 text-theme-primary hover:bg-theme-card/45"
                onClick={() => navigate("/explore")}
              >
                <Sparkles className="h-4 w-4 transition group-hover:scale-105" aria-hidden="true" />
                Utforska
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Following;
