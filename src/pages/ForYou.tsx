import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, Camera, ArrowRight, RefreshCcw, MoonStar, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/auth/AuthProvider";
import { logEvent } from "@/lib/logger";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  ForYouScenarioMode,
  getCachedForYouCards,
  getForYouCards,
  getForYouScenarioCards,
  isForYouCacheStale,
  type ForYouCard,
} from "@/services/forYouAIService";
import { getSavedAnalyses, WINE_CACHE_UPDATED_EVENT, type CachedWineAnalysisEntry } from "@/lib/wineCache";

// formatDate is now created inside the component to use locale

const ForYou = () => {
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const [history, setHistory] = useState<CachedWineAnalysisEntry[]>([]);
  const [cards, setCards] = useState<ForYouCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [cardsUpdatedAt, setCardsUpdatedAt] = useState<string | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<ForYouScenarioMode | null>(null);
  const [scenarioCards, setScenarioCards] = useState<ForYouCard[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [scenarioGeneratedAt, setScenarioGeneratedAt] = useState<string | null>(null);
  const [scenarioNotes, setScenarioNotes] = useState<string[]>([]);
  const hasLoggedOpen = useRef(false);

  const refreshCards = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      const userId = user?.id;
      if (!userId) return;

      const cached = getCachedForYouCards(userId);
      const shouldFetch = force || !cached || isForYouCacheStale(cached);

      if (!shouldFetch && cached) {
        setCards(cached.cards);
        setCardsUpdatedAt(cached.updatedAt);
        void logEvent(force ? "for_you_refreshed" : "for_you_loaded", {
          source: "cache",
          card_count: cached.cards.length,
        });
        return;
      }

      setLoadingCards(true);
      try {
        const result = await getForYouCards(userId, { forceRefresh: true });
        const resolvedCards = result.cards.length > 0 || !cached ? result.cards : cached.cards ?? [];
        const resolvedUpdatedAt = result.updatedAt ?? cached?.updatedAt ?? null;

        setCards(resolvedCards);
        setCardsUpdatedAt(resolvedUpdatedAt);

        void logEvent(force ? "for_you_refreshed" : "for_you_loaded", {
          source: result.source,
          card_count: resolvedCards.length,
        });
      } catch (error) {
        void logEvent("for_you_error", {
          location: "cards_fetch",
          message: error instanceof Error ? error.message : "unknown_error",
        });
      } finally {
        setLoadingCards(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    setHistory(getSavedAnalyses());

    const handleUpdate = () => {
      setHistory(getSavedAnalyses());
      void refreshCards({ force: true });
    };

    window.addEventListener(WINE_CACHE_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(WINE_CACHE_UPDATED_EVENT, handleUpdate);
    };
  }, [refreshCards]);

  useEffect(() => {
    if (hasLoggedOpen.current) return;

    hasLoggedOpen.current = true;
    void logEvent("for_you_opened");
  }, []);

  useEffect(() => {
    let ignore = false;
    const hydrateCache = () => {
      if (!user?.id || ignore) return;
      const cached = getCachedForYouCards(user.id);
      if (cached) {
        setCards(cached.cards);
        setCardsUpdatedAt(cached.updatedAt);
      }
    };

    const refreshFromSource = async () => {
      if (!user?.id || ignore) {
        setCards([]);
        setCardsUpdatedAt(null);
        return;
      }

      const cached = getCachedForYouCards(user.id);
      const shouldForceRefresh = !cached || isForYouCacheStale(cached);

      await refreshCards({ force: shouldForceRefresh });
    };

    hydrateCache();
    void refreshFromSource();

    return () => {
      ignore = true;
    };
  }, [refreshCards, user?.id]);

  const handleCardClick = useCallback((card: ForYouCard) => {
    void logEvent("for_you_card_clicked", { cardId: card.id, type: card.type });
  }, []);

  const formattedCardsUpdatedAt = useMemo(() => {
    if (!cardsUpdatedAt) return null;
    const parsed = new Date(cardsUpdatedAt);
    if (Number.isNaN(parsed.getTime())) return null;

    const localeCode = locale === "sv" ? "sv-SE" : "en-US";
    return parsed.toLocaleString(localeCode, { dateStyle: "medium", timeStyle: "short" });
  }, [cardsUpdatedAt, locale]);

  const scenarioOptions = useMemo(
    () => ({
      tonight: {
        key: "tonight" as const,
        label: t("forYou.scenario.tonight"),
        description: t("forYou.scenario.tonightDescription"),
        icon: <MoonStar className="h-5 w-5" aria-hidden="true" />,
      },
      food: {
        key: "food" as const,
        label: t("forYou.scenario.food"),
        description: t("forYou.scenario.foodDescription"),
        icon: <Utensils className="h-5 w-5" aria-hidden="true" />,
      },
      similar: {
        key: "similar" as const,
        label: t("forYou.scenario.similar"),
        description: t("forYou.scenario.similarDescription"),
        icon: <Sparkles className="h-5 w-5" aria-hidden="true" />,
      },
    }),
    [t],
  );

  const scenarioUpdatedLabel = useMemo(() => {
    if (!scenarioGeneratedAt) return null;
    const parsed = new Date(scenarioGeneratedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    const localeCode = locale === "sv" ? "sv-SE" : "en-US";
    return parsed.toLocaleString(localeCode, { dateStyle: "medium", timeStyle: "short" });
  }, [locale, scenarioGeneratedAt]);

  const scenarioInfoNote = useMemo(() => {
    const cleanNote = scenarioNotes.find(
      (note) => typeof note === "string" && note.toLowerCase().includes("fallback") === false,
    );
    return cleanNote ?? null;
  }, [scenarioNotes]);

  const handleScenarioSelect = useCallback(
    async (mode: ForYouScenarioMode) => {
      setActiveScenario(mode);
      setScenarioOpen(true);
      setScenarioLoading(true);
      setScenarioError(null);
      setScenarioCards([]);
      setScenarioNotes([]);
      setScenarioGeneratedAt(null);

      void logEvent("scenario_clicked", { mode });

      if (!user?.id) {
        setScenarioLoading(false);
        setScenarioError(t("forYou.scenario.loginRequired"));
        void logEvent("scenario_fail", { mode, reason: "unauthenticated" });
        return;
      }

      try {
        const result = await getForYouScenarioCards(user.id, mode);
        setScenarioCards(result.cards);
        setScenarioGeneratedAt(result.generatedAt);
        setScenarioNotes(result.notes);
        void logEvent("scenario_success", { mode, card_count: result.cards.length });
      } catch (error) {
        console.error("Failed to fetch scenario cards", error);
        setScenarioError(t("forYou.scenario.error"));
        void logEvent("scenario_fail", {
          mode,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      } finally {
        setScenarioLoading(false);
      }
    },
    [t, user?.id],
  );

  const handleScenarioCardClick = useCallback(
    (card: ForYouCard) => {
      if (!activeScenario) return;
      void logEvent("for_you_scenario_card_clicked", { cardId: card.id, type: card.type, scenario: activeScenario });
    },
    [activeScenario],
  );

  const recentEntries = useMemo(() => history.slice(0, 4), [history]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-base text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-12 sm:px-6 lg:px-10">
        <AppHeader
          variant="hero"
          title={t("forYou.title")}
          subtitle={t("forYou.subtitle")}
          rightActions={(
            <div className="flex flex-col gap-4 sm:items-end">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-[hsl(var(--color-border)/0.4)] bg-surface-canvas px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/80 sm:self-end">
                <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
                {t("forYou.badge")}
              </span>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Button
                  size="lg"
                  className="group inline-flex items-center gap-2"
                  onClick={() => navigate("/scan")}
                >
                  <Camera className="h-4 w-4 transition group-hover:-translate-y-0.5" aria-hidden="true" />
                  {t("forYou.scanWineBottle")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate("/me/wines")}
                >
                  {t("forYou.viewHistory")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-3xl border border-theme-card bg-surface-canvas p-6 shadow-theme-card backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-theme-secondary/70">{t("forYou.latestScans")}</p>
                <h2 className="text-2xl font-semibold text-theme-primary">{t("forYou.latestScansTitle")}</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => navigate("/me/wines")}
              >
                {t("forYou.viewHistory")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {recentEntries.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentEntries.map((entry) => {
                  const title = entry.result.vin || t("wineDetail.unknownWine");
                  const subtitle = [entry.result.land_region, entry.result.årgång].filter(Boolean).join(" • ");
                  const formatDate = (iso: string) => {
                    const d = new Date(iso);
                    if (Number.isNaN(d.getTime())) return "";
                    return d.toLocaleDateString(locale === "en" ? "en-US" : "sv-SE", {
                      month: "short",
                      day: "numeric",
                    });
                  };
                  return (
                    <div
                      key={entry.key}
                      className="flex gap-4 rounded-2xl border border-theme-card bg-surface-card p-4 shadow-inner shadow-black/20"
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
                            className="gap-2"
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
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-theme-card bg-surface-card p-6 text-left">
                <p className="text-lg font-semibold text-theme-primary">{t("forYou.emptyHistoryTitle")}</p>
                <p className="text-sm text-theme-secondary">{t("forYou.emptyHistorySubtitle")}</p>
                <Button
                  className="mt-1"
                  onClick={() => navigate("/scan")}
                >
                  {t("forYou.tryScan")}
                </Button>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-theme-card bg-surface-canvas p-6 shadow-theme-card backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-theme-secondary/70">{t("forYou.suggestions")}</p>
                <h2 className="text-2xl font-semibold text-theme-primary">{t("forYou.suggestionsTitle")}</h2>
                {formattedCardsUpdatedAt ? (
                  <p className="text-xs text-theme-secondary/70">
                    {t("forYou.lastUpdated", { timestamp: formattedCardsUpdatedAt })}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => void refreshCards({ force: true })}
                disabled={loadingCards}
              >
                <RefreshCcw
                  className={`h-4 w-4 ${loadingCards ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {loadingCards ? t("forYou.refreshing") : t("forYou.refresh")}
              </Button>
            </div>

            <div className="rounded-2xl border border-dashed border-theme-card bg-surface-card p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-theme-secondary/70">
                    {t("forYou.scenario.badge")}
                  </p>
                  <h3 className="text-lg font-semibold text-theme-primary">{t("forYou.scenario.title")}</h3>
                  <p className="text-sm text-theme-secondary/80">{t("forYou.scenario.subtitle")}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {Object.values(scenarioOptions).map((action) => (
                  <Button
                    key={action.key}
                    variant="outline"
                    className="group flex h-full items-center justify-between gap-3 bg-surface-card px-4 py-3 text-left transition hover:border-theme-primary/60 hover:bg-surface-card"
                    onClick={() => void handleScenarioSelect(action.key)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-theme-accent/15 text-theme-primary">
                        {action.icon}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{action.label}</span>
                        <span className="text-xs text-theme-secondary/80">{action.description}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </div>

            {cards.length === 0 && loadingCards ? (
              <div className="rounded-2xl border border-theme-card bg-surface-card p-6 text-sm text-theme-secondary">
                {t("common.loading")}
              </div>
            ) : cards.length > 0 ? (
              <div className="space-y-3">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="flex min-h-[220px] flex-col justify-between gap-4 rounded-2xl border border-theme-card border-l-4 border-l-theme-primary/60 bg-surface-card p-5 shadow-inner shadow-black/20"
                    onClick={() => handleCardClick(card)}
                  >
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-theme-primary/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-theme-primary">
                          {card.type}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-theme-primary">{card.title}</p>
                        {card.subtitle && <p className="text-sm text-theme-secondary/80">{card.subtitle}</p>}
                        {card.items?.length ? (
                          <ul className="list-disc space-y-1 pl-5 text-sm text-theme-secondary/80">
                            {card.items.map((item, index) => (
                              <li key={`${card.id}-item-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="w-fit gap-2">
                      {t("forYou.cardCta")}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {loadingCards ? (
                  <p className="text-xs text-theme-secondary/70">{t("forYou.refreshing")}</p>
                ) : null}
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

      <Sheet open={scenarioOpen} onOpenChange={setScenarioOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] overflow-y-auto rounded-t-3xl border-theme-card bg-surface-canvas text-theme-primary sm:left-1/2 sm:max-w-3xl sm:-translate-x-1/2"
        >
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle className="flex items-center gap-2 text-xl">
              {activeScenario ? scenarioOptions[activeScenario].label : t("forYou.scenario.sheetTitle")}
            </SheetTitle>
            <SheetDescription className="text-sm text-theme-secondary">
              {activeScenario
                ? scenarioOptions[activeScenario].description
                : t("forYou.scenario.sheetSubtitle")}
            </SheetDescription>
            {scenarioUpdatedLabel ? (
              <p className="text-xs text-theme-secondary/70">
                {t("forYou.scenario.generatedAt", { timestamp: scenarioUpdatedLabel })}
              </p>
            ) : null}
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {scenarioError ? (
              <Banner type="error" title={t("forYou.scenario.errorTitle")} text={scenarioError} />
            ) : null}

            {scenarioInfoNote && !scenarioLoading ? (
              <Banner type="info" title={t("forYou.scenario.noteTitle")} text={scenarioInfoNote} />
            ) : null}

            {scenarioLoading ? (
              <div className="rounded-2xl border border-theme-card bg-surface-card p-5 text-sm text-theme-secondary">
                {t("forYou.scenario.loading")}
              </div>
            ) : scenarioCards.length > 0 ? (
              <div className="space-y-3">
                {scenarioCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex min-h-[220px] flex-col justify-between gap-4 rounded-2xl border border-theme-card border-l-4 border-l-theme-primary/60 bg-surface-card p-5 shadow-inner shadow-black/20 transition hover:border-theme-primary/60"
                    onClick={() => handleScenarioCardClick(card)}
                  >
                    <div className="flex flex-1 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-theme-primary/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-theme-primary">
                          {card.type}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-theme-primary">{card.title}</p>
                        {card.subtitle && <p className="text-sm text-theme-secondary/80">{card.subtitle}</p>}
                        {card.items?.length ? (
                          <ul className="list-disc space-y-1 pl-5 text-sm text-theme-secondary/80">
                            {card.items.map((item, index) => (
                              <li key={`${card.id}-item-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="w-fit gap-2">
                      {t("forYou.cardCta")}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-theme-card bg-surface-card p-5 text-sm text-theme-secondary">
                {t("forYou.scenario.empty")}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ForYou;
