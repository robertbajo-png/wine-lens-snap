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
  getAllCachedAnalyses,
  removeCachedAnalysis,
  seedDemoAnalyses,
  type CachedWineAnalysisEntry,
  markAnalysesReadyForSync,
} from "@/lib/wineCache";
import HistorySummary from "@/components/history/HistorySummary";
import WineCard, { WineCardSkeleton } from "@/components/history/WineCard";
import { readAuthState, subscribeToAuthState, type AuthState } from "@/lib/mockAuth";
import { ArrowLeft, Camera, Eraser, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Banner } from "@/components/Banner";
import { trackEvent } from "@/lib/telemetry";

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Okänd tid";
  return date.toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (iso: string) => {
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

  const rtf = new Intl.RelativeTimeFormat("sv", { numeric: "auto" });

  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs || unit === "minute") {
      const value = Math.round(diffMs / unitMs);
      return rtf.format(value, unit);
    }
  }

  return "";
};

const History = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CachedWineAnalysisEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>(() => readAuthState());
  const refreshTimeoutRef = useRef<number | null>(null);
  const openLoggedRef = useRef(false);

  const loadEntries = useCallback(() => {
    setEntries(getAllCachedAnalyses());
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
    if (!devDialogOpen) {
      setDevStatus(null);
    }
  }, [devDialogOpen]);

  useEffect(() => subscribeToAuthState(setAuthState), []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const updatedCount = markAnalysesReadyForSync();
    if (updatedCount > 0) {
      refreshEntries();
    }
  }, [authState, refreshEntries]);

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
        ? `Lade till ${seeded.length} demoposter. Uppdatera historiken vid behov.`
        : "Kunde inte lägga till demodata. Försök igen."
    );
  };

  const handleClearAll = () => {
    clearCache();
    refreshEntries();
    const updated = getAllCachedAnalyses();
    setDevStatus(updated.length === 0 ? "Historiken rensades." : "Vissa poster kunde inte tas bort.");
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
          title: "Vinanalys kopierad",
          description: `${entry.result.vin || "Vinprofil"} finns nu i urklipp.`,
        });
      }
    } catch (error) {
      console.error("Error copying wine analysis to clipboard:", error);
      if (!options.silent) {
        toast({
          title: "Kunde inte kopiera",
          description: "Din webbläsare blockerade kopieringen. Försök igen.",
          variant: "destructive",
        });
      }
    }
  };

  const handleShare = async (entry: CachedWineAnalysisEntry) => {
    const shareTitle = entry.result.vin || "WineSnap-analys";
    const shareLines = [
      entry.result.vin,
      entry.result.land_region,
      entry.result.typ,
      entry.result.årgång ? `Årgång ${entry.result.årgång}` : null,
      `Skannad ${formatDate(entry.timestamp)}`,
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
          title: "Delning öppnades",
          description: "Välj app för att dela din analys.",
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
      title: "Delning ej tillgänglig",
      description: "Analysen kopierades istället till urklipp.",
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="gap-2 rounded-full border border-theme-card bg-theme-elevated px-4 text-theme-primary shadow-lg shadow-purple-900/20 backdrop-blur transition hover:bg-theme-elevated"
              aria-label="Gå tillbaka"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>
            <Badge variant="outline" className="rounded-full border-theme-card bg-theme-elevated text-xs uppercase tracking-[0.25em] text-theme-secondary">
              {isLoading
                ? "Laddar historik"
                : entries.length === 0
                ? "Tom historik"
                : `${entries.length} sparade analyser`}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-[hsl(var(--surface-elevated)/0.85)]"
              aria-label="Uppdatera historiken"
            >
              Uppdatera
            </Button>
            <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-dashed border-theme-card bg-theme-elevated text-theme-primary shadow-sm backdrop-blur transition hover:bg-[hsl(var(--surface-elevated)/0.85)]"
                  aria-label="Öppna testverktyg"
                >
                  <Wand2 className="h-4 w-4" />
                  Testverktyg
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Testverktyg för historiken</DialogTitle>
                  <DialogDescription>
                    Fyll listan med färdiga demoposter eller rensa lagrade analyser när du förbereder manuell testning.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-theme-secondary">
                  <div className="rounded-xl border border-theme-card bg-theme-elevated p-4 text-sm">
                    <p className="font-medium text-theme-primary">Tips</p>
                    <p>
                      Demoposterna sparas lokalt i din webbläsare. De påverkar inte riktiga analyser och kan tas bort när som helst.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={handleSeedDemo}
                      className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-theme-primary shadow-[0_18px_45px_-20px_rgba(123,63,228,1)] sm:flex-1"
                      aria-label="Fyll listan med demodata"
                    >
                      <Wand2 className="h-4 w-4" />
                      Fyll med demodata
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClearAll}
                      className="gap-2 rounded-full border-destructive/60 bg-theme-elevated text-destructive hover:bg-destructive/10 sm:flex-1"
                      aria-label="Rensa historiken"
                    >
                      <Eraser className="h-4 w-4" />
                      Rensa historiken
                    </Button>
                  </div>
                  {devStatus && <Banner type="info" text={devStatus} className="text-left" />}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              onClick={() => navigate("/for-you")}
              className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
              aria-label="Öppna kameran för ny skanning"
            >
              <Camera className="h-4 w-4" />
              Ny skanning
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
              <CardTitle className="text-2xl text-theme-primary">Ingen historik ännu</CardTitle>
              <CardDescription className="text-base text-theme-secondary">
                Dina analyser sparas automatiskt här varje gång du fotar en vinflaska med WineSnap.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-10">
              <Button
                onClick={() => navigate("/for-you")}
                className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-theme-primary shadow-[0_18px_45px_-20px_rgba(123,63,228,1)]"
                aria-label="Starta din första skanning"
              >
                <Camera className="h-4 w-4" />
                Starta första skanningen
              </Button>
              <Button
                variant="outline"
                onClick={() => setDevDialogOpen(true)}
                className="gap-2 rounded-full border-dashed border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
                aria-label="Visa testverktyg"
              >
                <Wand2 className="h-4 w-4" />
                Visa testverktyg
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
