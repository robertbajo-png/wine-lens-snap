import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const ForYou = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface-alt)/0.9)] px-8 py-12 shadow-theme-card backdrop-blur">
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.6)] px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/80">
            <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
            {t("forYou.badge")}
          </span>
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">{t("forYou.title")}</h1>
          <p className="max-w-md text-sm text-theme-secondary/80 sm:text-base">
            {t("forYou.subtitle")}
          </p>
          <div className="mt-4 flex flex-col items-center gap-3">
            <span className="text-sm font-medium uppercase tracking-[0.3em] text-theme-secondary/60">{t("forYou.comingSoon")}</span>
            <Button
              size="lg"
              className="group inline-flex items-center gap-2 rounded-full bg-theme-accent px-6 text-theme-on-accent shadow-theme-card transition hover:opacity-90"
              onClick={() => navigate("/scan")}
            >
              <Camera className="h-4 w-4 transition group-hover:-translate-y-0.5" aria-hidden="true" />
              {t("forYou.scanWineBottle")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForYou;
