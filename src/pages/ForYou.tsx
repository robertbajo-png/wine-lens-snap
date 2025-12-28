import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/auth/AuthProvider";
import { logEvent } from "@/lib/logger";
import { getForYouCards, type ForYouCard } from "@/services/forYouService";
import { getSavedAnalyses, WINE_CACHE_UPDATED_EVENT, type CachedWineAnalysisEntry } from "@/lib/wineCache";

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("sv-SE", {
    month: "short",
    day: "numeric",
  });
};

const ForYou = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [history, setHistory] = useState<CachedWineAnalysisEntry[]>([]);
  const [cards, setCards] = useState<ForYouCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const hasLoggedOpen = useRef(false);

  useEffect(() => {
    setHistory(getSavedAnalyses());

    const handleUpdate = () => {
      setHistory(getSavedAnalyses());
    };

    window.addEventListener(WINE_CACHE_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(WINE_CACHE_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (hasLoggedOpen.current) return;

    hasLoggedOpen.current = true;
    void logEvent("for_you_opened");
  }, []);

  useEffect(() => {
    let ignore = false;
    const fetchCards = async () => {
      setLoadingCards(true);
      try {
        const nextCards = await getForYouCards(user?.id ?? "");
        if (!ignore) {
          setCards(nextCards);
        }
      } finally {
        if (!ignore) {
          setLoadingCards(false);
        }
      }
    };

    void fetchCards();
    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const handleCardClick = useCallback((card: ForYouCard) => {
    void logEvent("for_you_card_clicked", { cardId: card.id, type: card.type });
  }, []);

  const recentEntries = useMemo(() => history.slice(0, 4), [history]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-4 rounded-3xl border border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface-alt)/0.9)] px-6 py-8 shadow-theme-card backdrop-blur sm:px-10 sm:py-12">
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <span className="inline-flex items-center gap-2 self-center rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.6)] px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/80 sm:self-start">
              <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
              {t("forYou.badge")}
            </span>
            <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">{t("forYou.title")}</h1>
            <p className="max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
              {t("forYou.subtitle")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button
                size="lg"
                className="group inline-flex items-center gap-2 rounded-full bg-theme-accent px-6 text-theme-on-accent shadow-theme-card transition hover:opacity-90"
                onClick={() => navigate("/scan")}
              >
                <Camera className="h-4 w-4 transition group-hover:-translate-y-0.5" aria-hidden="true" />
                {t("forYou.scanWineBottle")}
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-full border-theme-card bg-theme-elevated px-5 py-2 text-sm font-semibold text-theme-primary hover:bg-[hsl(var(--surface-elevated)/0.85)]"
                onClick={() => navigate("/history")}
              >
                {t("forYou.viewHistory")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-3xl border border-theme-card bg-[hsl(var(--color-surface-alt)/0.8)] p-6 shadow-theme-card backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-theme-secondary/70">{t("forYou.latestScans")}</p>
                <h2 className="text-2xl font-semibold text-theme-primary">{t("forYou.latestScansTitle")}</h2>
              </div>
              <Button
                variant="ghost"
                className="gap-2 rounded-full px-3 py-2 text-theme-primary hover:bg-[hsl(var(--color-surface)/0.6)]"
                onClick={() => navigate("/history")}
              >
                {t("forYou.viewHistory")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {recentEntries.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentEntries.map((entry) => {
                  const title = entry.result.vin || "Okänt vin";
                  const subtitle = [entry.result.land_region, entry.result.årgång].filter(Boolean).join(" • ");
                  return (
                    <div
                      key={entry.key}
                      className="flex gap-4 rounded-2xl border border-theme-card bg-theme-elevated/70 p-4 shadow-inner shadow-black/20"
                    >
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-theme-card bg-black/30 text-xs text-theme-secondary">
                        {entry.imageData ? (
                          <img src={entry.imageData} alt={title} className="h-full w-full object-cover" />
                        ) : (
                          <span>{t("forYou.noImage")}</span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div className="space-y-1">
                          <p className="text-sm uppercase tracking-[0.2em] text-theme-secondary/70">
                            {formatDate(entry.timestamp)}
                          </p>
                          <h3 className="text-lg font-semibold text-theme-primary">{title}</h3>
                          {subtitle && <p className="text-sm text-theme-secondary">{subtitle}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 rounded-full px-3 text-theme-primary hover:bg-[hsl(var(--color-surface)/0.7)]"
                            onClick={() => navigate(`/wine/${entry.key}`)}
                          >
                            {t("forYou.viewWine")}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-theme-card bg-theme-elevated/70 p-6 text-left">
                <p className="text-lg font-semibold text-theme-primary">{t("forYou.emptyHistoryTitle")}</p>
                <p className="text-sm text-theme-secondary">{t("forYou.emptyHistorySubtitle")}</p>
                <Button
                  className="mt-1 rounded-full bg-theme-accent text-theme-on-accent"
                  onClick={() => navigate("/scan")}
                >
                  {t("forYou.tryScan")}
                </Button>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-theme-card bg-[hsl(var(--color-surface-alt)/0.8)] p-6 shadow-theme-card backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-theme-secondary/70">{t("forYou.suggestions")}</p>
                <h2 className="text-2xl font-semibold text-theme-primary">{t("forYou.suggestionsTitle")}</h2>
              </div>
            </div>

            {loadingCards ? (
              <div className="rounded-2xl border border-theme-card bg-theme-elevated/70 p-6 text-sm text-theme-secondary">
                {t("common.loading")}
              </div>
            ) : cards.length > 0 ? (
              <div className="space-y-3">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="flex flex-col gap-3 rounded-2xl border border-theme-card bg-theme-elevated/70 p-5 shadow-inner shadow-black/20"
                    onClick={() => handleCardClick(card)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-theme-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-theme-primary">
                        {card.basis === "grape" ? t("forYou.ruleGrape") : t("forYou.ruleRegion")}
                      </span>
                      <span className="text-sm text-theme-secondary/80">{card.matchValue}</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm uppercase tracking-[0.25em] text-theme-secondary/70">
                        {t("forYou.suggestionHeading")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {card.suggestions.map((suggestion) => (
                          <span
                            key={suggestion}
                            className="rounded-full border border-theme-card bg-theme-elevated px-3 py-1 text-sm font-semibold text-theme-primary"
                          >
                            {suggestion}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Banner
                type="info"
                title={t("forYou.emptySuggestionsTitle")}
                text={t("forYou.emptySuggestionsSubtitle")}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ForYou;
