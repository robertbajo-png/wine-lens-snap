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
import { Badge } from "@/components/ui/badge";
import {
  clearCache,
  getSavedAnalyses,
  removeCachedAnalysis,
  seedDemoAnalyses,
  type CachedWineAnalysisEntry,
  markAnalysesReadyForSync,
  WINE_CACHE_UPDATED_EVENT,
} from "@/lib/wineCache";
import HistorySummary from "@/components/history/HistorySummary";
import WineCard, { WineCardSkeleton } from "@/components/history/WineCard";
import { useAuth } from "@/auth/AuthProvider";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { ArrowLeft, Camera, Eraser, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Banner } from "@/components/Banner";
import { trackEvent } from "@/lib/telemetry";
import { useTranslation } from "@/hooks/useTranslation";

const History = () => {
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const [entries, setEntries] = useState<CachedWineAnalysisEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);
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

  const { regionsCount, lastTimestamp } = useMemo(() => {
    const regions = new Set<string>();
    let latest: string | undefined;

    for (const entry of entries) {
      if (entry.result.land_region) {
        regions.add(entry.result.land_region);
      }
      if (!latest || entry.timestamp.localeCompare(latest) > 0) {
        latest = entry.timestamp;
      }
    }

    return {
      regionsCount: regions.size,
      lastTimestamp: latest,
    };
  }, [entries]);

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
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        {isOffline && (
          <Banner
            type="warning"
            title={t("history.offlineTitle")}
            text={t("history.offlineText")}
          />
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate(-1)}
              className="gap-2 shadow-lg shadow-purple-900/20 backdrop-blur"
              aria-label={t("common.goBack")}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("history.back")}
            </Button>
            <Badge variant="outline" className="rounded-full border-theme-card bg-theme-elevated text-xs uppercase tracking-[0.25em] text-theme-secondary">
              {isLoading
                ? t("history.loadingHistory")
                : entries.length === 0
                ? t("history.emptyHistory")
                : t("history.savedWines", { count: entries.length })}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleRefresh}
              aria-label={t("history.refresh")}
            >
              {t("history.refresh")}
            </Button>
            <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-dashed bg-theme-elevated shadow-sm backdrop-blur transition hover:bg-[hsl(var(--surface-elevated)/0.85)]"
                  aria-label={t("history.testTools")}
                >
                  <Wand2 className="h-4 w-4" />
                  {t("history.testTools")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t("history.testToolsTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("history.testToolsSubtitle")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-theme-secondary">
                  <div className="rounded-xl border border-theme-card bg-theme-elevated p-4 text-sm">
                    <p className="font-medium text-theme-primary">{t("history.tip")}</p>
                    <p>{t("history.tipText")}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={handleSeedDemo}
                      className="gap-2 sm:flex-1"
                      aria-label={t("history.fillWithDemo")}
                    >
                      <Wand2 className="h-4 w-4" />
                      {t("history.fillWithDemo")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClearAll}
                      className="gap-2 border-destructive/60 text-destructive hover:bg-destructive/10 sm:flex-1"
                      aria-label={t("history.clearHistory")}
                    >
                      <Eraser className="h-4 w-4" />
                      {t("history.clearHistory")}
                    </Button>
                  </div>
                  {devStatus && <Banner type="info" text={devStatus} className="text-left" />}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={() => navigate("/scan")}
              className="gap-2"
              aria-label={t("history.newScan")}
            >
              <Camera className="h-4 w-4" />
              {t("history.newScan")}
            </Button>
          </div>
        </div>

        <HistorySummary
          total={entries.length}
          lastRelative={lastTimestamp ? formatRelativeTime(lastTimestamp) : undefined}
          lastAbsolute={lastTimestamp ? formatDate(lastTimestamp) : undefined}
          regionsCount={regionsCount}
          isLoading={isLoading}
        />

        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <WineCardSkeleton key={index} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card className="border border-dashed border-theme-card bg-theme-elevated text-center text-theme-primary shadow-xl backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-theme-primary">
                {t("history.noSavedWines")}
              </CardTitle>
              <CardDescription className="text-base text-theme-secondary">
                {t("history.scanAndSave")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-10">
              <Button
                onClick={() => navigate("/scan")}
                className="gap-2"
                aria-label={t("history.scanWine")}
              >
                <Camera className="h-4 w-4" />
                {t("history.scanWine")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDevDialogOpen(true)}
                className="gap-2 border-dashed bg-theme-elevated"
                aria-label={t("history.showTestTools")}
              >
                <Wand2 className="h-4 w-4" />
                {t("history.showTestTools")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <WineCard
                key={entry.key}
                entry={entry}
                formatDate={formatDate}
                formatRelativeTime={formatRelativeTime}
                onShare={handleShare}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
