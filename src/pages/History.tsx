import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  clearCache,
  getSavedAnalyses,
  removeCachedAnalysis,
  seedDemoAnalyses,
  type CachedWineAnalysisEntry,
  markAnalysesReadyForSync,
  WINE_CACHE_UPDATED_EVENT,
} from "@/lib/wineCache";
import WineCard, { WineCardSkeleton } from "@/components/history/WineCard";
import { useAuth } from "@/auth/AuthProvider";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { Camera, Eraser, Search, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Banner } from "@/components/Banner";
import { trackEvent } from "@/lib/telemetry";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

const History = () => {
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const [entries, setEntries] = useState<CachedWineAnalysisEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const { user } = useAuth();
  const refreshTimeoutRef = useRef<number | null>(null);
  const openLoggedRef = useRef(false);
  const { isOffline } = useNetworkStatus();

  const formatDate = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return t("history.unknownTime");
      return date.toLocaleString(locale === "en" ? "en-US" : "sv-SE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [locale, t],
  );

  const formatRelativeTime = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";

      const diffMs = date.getTime() - Date.now();
      const absMs = Math.abs(diffMs);
      const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ["year", 1000 * 60 * 60 * 24 * 365],
        ["month", 1000 * 60 * 60 * 24 * 30],
        ["week", 1000 * 60 * 60 * 24 * 7],
        ["day", 1000 * 60 * 60 * 24],
        ["hour", 1000 * 60 * 60],
        ["minute", 1000 * 60],
      ];

      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

      for (const [unit, unitMs] of units) {
        if (absMs >= unitMs || unit === "minute") {
          const value = Math.round(diffMs / unitMs);
          return rtf.format(value, unit);
        }
      }

      return "";
    },
    [locale],
  );

  const loadEntries = useCallback(() => {
    setEntries(getSavedAnalyses());
  }, []);

  const refreshEntries = useCallback(
    (showSkeleton = false) => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      if (showSkeleton) {
        setIsLoading(true);
        refreshTimeoutRef.current = window.setTimeout(() => {
          loadEntries();
          setIsLoading(false);
          refreshTimeoutRef.current = null;
        }, 160);
      } else {
        loadEntries();
        setIsLoading(false);
      }
    },
    [loadEntries],
  );

  useEffect(() => {
    refreshEntries(true);
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [refreshEntries]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleCacheUpdate = () => {
      refreshEntries();
    };

    window.addEventListener(WINE_CACHE_UPDATED_EVENT, handleCacheUpdate);
    return () => {
      window.removeEventListener(WINE_CACHE_UPDATED_EVENT, handleCacheUpdate);
    };
  }, [refreshEntries]);

  useEffect(() => {
    if (!devDialogOpen) {
      setDevStatus(null);
    }
  }, [devDialogOpen]);

  useEffect(() => {
    if (!user) return;
    const updatedCount = markAnalysesReadyForSync();
    if (updatedCount > 0) {
      refreshEntries();
    }
  }, [refreshEntries, user]);

  useEffect(() => {
    if (openLoggedRef.current || isLoading) {
      return;
    }

    trackEvent("history_open", { entries: entries.length });
    openLoggedRef.current = true;
  }, [entries.length, isLoading]);

  const { regionsCount, lastTimestamp, topRegions } = useMemo(() => {
    const regions = new Map<string, number>();
    let latest: string | undefined;

    for (const entry of entries) {
      if (entry.result.land_region) {
        regions.set(entry.result.land_region, (regions.get(entry.result.land_region) ?? 0) + 1);
      }
      if (!latest || entry.timestamp.localeCompare(latest) > 0) {
        latest = entry.timestamp;
      }
    }

    const top = [...regions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    return {
      regionsCount: regions.size,
      lastTimestamp: latest,
      topRegions: top,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (regionFilter && entry.result.land_region !== regionFilter) return false;
      if (!query.trim()) return true;
      const haystack = `${entry.result.vin ?? ""} ${entry.result.land_region ?? ""} ${entry.result.typ ?? ""} ${entry.result.producent ?? ""}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });
  }, [entries, query, regionFilter]);

  const skeletonCount = entries.length > 0 ? Math.min(entries.length, 6) : 3;

  const handleRemove = (key: string) => {
    removeCachedAnalysis(key);
    refreshEntries();
  };

  const handleRefresh = () => {
    refreshEntries(true);
  };

  const handleSeedDemo = () => {
    const seeded = seedDemoAnalyses();
    refreshEntries(true);
    setDevStatus(
      seeded.length > 0
        ? t("history.added", { count: seeded.length })
        : t("history.couldNotAdd"),
    );
  };

  const handleClearAll = () => {
    clearCache();
    refreshEntries();
    const updated = getSavedAnalyses();
    setDevStatus(
      updated.length === 0 ? t("history.historyCleared") : t("history.someNotRemoved"),
    );
  };

  const handleCopyToClipboard = async (
    entry: CachedWineAnalysisEntry,
    options: { silent?: boolean } = {},
  ) => {
    const payload = JSON.stringify(
      {
        key: entry.key,
        timestamp: entry.timestamp,
        result: entry.result,
      },
      null,
      2,
    );

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = payload;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard API not available");
      }

      if (!options.silent) {
        toast({
          title: t("history.wineAnalysisCopied"),
          description: t("history.copiedToClipboard", {
            wine: entry.result.vin || t("wineCard.unknownWine"),
          }),
        });
      }
    } catch (error) {
      console.error("Error copying wine analysis to clipboard:", error);
      if (!options.silent) {
        toast({
          title: t("history.couldNotCopy"),
          description: t("history.browserBlocked"),
          variant: "destructive",
        });
      }
    }
  };

  const handleShare = async (entry: CachedWineAnalysisEntry) => {
    const shareTitle = entry.result.vin || t("wineCard.unknownWine");
    const shareLines = [
      entry.result.vin,
      entry.result.land_region,
      entry.result.typ,
      entry.result.årgång ? `${t("history.vintage")} ${entry.result.årgång}` : null,
      `${t("history.scanned")} ${formatDate(entry.timestamp)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const shareData = {
      title: shareTitle,
      text: shareLines,
    };

    const canShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare(shareData));

    if (canShare) {
      try {
        await navigator.share(shareData);
        toast({
          title: t("history.sharingOpened"),
          description: t("history.chooseApp"),
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Error sharing wine analysis:", error);
      }
    }

    await handleCopyToClipboard(entry, { silent: true });
    toast({
      title: t("history.sharingNotAvailable"),
      description: t("history.copiedInstead"),
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-6.5rem)] bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[60vh] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--gold) / 0.15) 0%, transparent 70%)",
        }}
      />
      <main className="mx-auto w-full max-w-md px-5 pt-6">
        {isOffline && (
          <Banner
            type="warning"
            title={t("history.offlineTitle")}
            text={t("history.offlineText")}
            className="mb-4"
          />
        )}

        {/* Rubrik */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight text-foreground">
              {locale === "en" ? "History" : "Historik"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? t("history.loadingHistory")
                : entries.length === 0
                ? t("history.emptyHistory")
                : t("history.savedWines", { count: entries.length })}
              {lastTimestamp && ` · ${formatRelativeTime(lastTimestamp)}`}
              {regionsCount > 0 && ` · ${regionsCount} regioner`}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/scan")}
            className="flex-none rounded-full bg-gradient-luxe text-primary-foreground shadow-soft hover:opacity-90"
            aria-label={t("history.newScan")}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            {t("history.newScan")}
          </Button>
        </div>

        {/* Sökfält */}
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === "en" ? "Search wine, region, grape..." : "Sök vin, region, druva..."}
            className="h-12 rounded-2xl border-border bg-card/60 pl-11 backdrop-blur"
          />
        </div>

        {/* Region-chips */}
        {topRegions.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setRegionFilter(null)}
              className={cn(
                "flex-none rounded-full px-3 py-1 text-[11px] uppercase tracking-wider transition",
                regionFilter === null
                  ? "bg-gold/15 text-gold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Alla regioner
            </button>
            {topRegions.map((region) => (
              <button
                key={region}
                onClick={() => setRegionFilter(regionFilter === region ? null : region)}
                className={cn(
                  "flex-none rounded-full px-3 py-1 text-[11px] uppercase tracking-wider transition",
                  regionFilter === region
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {region}
              </button>
            ))}
          </div>
        )}

        {/* Dev tools + refresh (diskret rad) */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
          >
            {t("history.refresh")}
          </button>
          <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
                aria-label={t("history.testTools")}
              >
                <Wand2 className="h-3 w-3" />
                {t("history.testTools")}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{t("history.testToolsTitle")}</DialogTitle>
                <DialogDescription>{t("history.testToolsSubtitle")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card/60 p-4 text-sm">
                  <p className="font-medium text-foreground">{t("history.tip")}</p>
                  <p className="text-muted-foreground">{t("history.tipText")}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleSeedDemo} className="gap-2 rounded-2xl sm:flex-1">
                    <Wand2 className="h-4 w-4" />
                    {t("history.fillWithDemo")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearAll}
                    className="gap-2 rounded-2xl border-destructive/60 text-destructive hover:bg-destructive/10 sm:flex-1"
                  >
                    <Eraser className="h-4 w-4" />
                    {t("history.clearHistory")}
                  </Button>
                </div>
                {devStatus && <Banner type="info" text={devStatus} className="text-left" />}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista */}
        <div className="mt-5 space-y-4">
          {isLoading ? (
            Array.from({ length: skeletonCount }).map((_, i) => <WineCardSkeleton key={i} />)
          ) : filteredEntries.length === 0 ? (
            <Card className="rounded-3xl border border-dashed border-border bg-card/50 text-center backdrop-blur">
              <CardHeader className="space-y-2">
                <CardTitle className="font-display text-2xl text-foreground">
                  {entries.length === 0
                    ? t("history.noSavedWines")
                    : (locale === "en" ? "No matches with filters" : "Inga träffar med filtren")}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {entries.length === 0 ? t("history.scanAndSave") : "Prova att rensa sök eller region-chips."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3 pb-8">
                {entries.length === 0 ? (
                  <Button
                    onClick={() => navigate("/scan")}
                    className="gap-2 rounded-2xl bg-gradient-luxe text-primary-foreground shadow-elegant"
                  >
                    <Camera className="h-4 w-4" />
                    {t("history.scanWine")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("");
                      setRegionFilter(null);
                    }}
                    className="gap-2 rounded-2xl"
                  >
                    Rensa filter
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map((entry) => (
              <WineCard
                key={entry.key}
                entry={entry}
                formatDate={formatDate}
                formatRelativeTime={formatRelativeTime}
                onShare={handleShare}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
