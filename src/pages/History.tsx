import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Separator } from "@/components/ui/separator";
import {
  clearCache,
  getAllCachedAnalyses,
  removeCachedAnalysis,
  seedDemoAnalyses,
  type CachedWineAnalysisEntry,
} from "@/lib/wineCache";
import WineCardSBFull from "@/components/WineCardSBFull";
import { GaugeCircleSB } from "@/components/WineMetersSB";
import { getSystembolagetTasteProfile } from "@/components/SystembolagetTasteProfile";
import { ArrowLeft, Camera, Copy, Eraser, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

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
  const [devDialogOpen, setDevDialogOpen] = useState(false);
  const [devStatus, setDevStatus] = useState<string | null>(null);

  useEffect(() => {
    setEntries(getAllCachedAnalyses());
  }, []);

  useEffect(() => {
    if (!devDialogOpen) {
      setDevStatus(null);
    }
  }, [devDialogOpen]);

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

  const handleRemove = (key: string) => {
    removeCachedAnalysis(key);
    setEntries(getAllCachedAnalyses());
  };

  const handleRefresh = () => {
    setEntries(getAllCachedAnalyses());
  };

  const handleSeedDemo = () => {
    const seeded = seedDemoAnalyses();
    setEntries(getAllCachedAnalyses());
    setDevStatus(
      seeded.length > 0
        ? `Lade till ${seeded.length} demoposter. Uppdatera historiken vid behov.`
        : "Kunde inte lägga till demodata. Försök igen."
    );
  };

  const handleClearAll = () => {
    clearCache();
    const updated = getAllCachedAnalyses();
    setEntries(updated);
    setDevStatus(updated.length === 0 ? "Historiken rensades." : "Vissa poster kunde inte tas bort.");
  };

  const handleCopyToClipboard = async (entry: CachedWineAnalysisEntry) => {
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

      toast({
        title: "Vinanalys kopierad",
        description: `${entry.result.vin || "Vinprofil"} finns nu i urklipp.`,
      });
    } catch (error) {
      console.error("Error copying wine analysis to clipboard:", error);
      toast({
        title: "Kunde inte kopiera",
        description: "Din webbläsare blockerade kopieringen. Försök igen.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-card/70 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 rounded-full border border-transparent bg-card/60 px-4 shadow-sm backdrop-blur">
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>
            <Badge variant="outline" className="rounded-full">
              {entries.length === 0 ? "Tom historik" : `${entries.length} sparade analyser`}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} className="rounded-full bg-card/70 backdrop-blur">
              Uppdatera
            </Button>
            <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-dashed bg-card/70 shadow-sm backdrop-blur transition"
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
                <div className="space-y-4">
                  <div className="rounded-xl border bg-secondary/60 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Tips</p>
                    <p>
                      Demoposterna sparas lokalt i din webbläsare. De påverkar inte riktiga analyser och kan tas bort när som helst.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={handleSeedDemo} className="gap-2 rounded-full shadow-md sm:flex-1">
                      <Wand2 className="h-4 w-4" />
                      Fyll med demodata
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleClearAll}
                      className="gap-2 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 sm:flex-1"
                    >
                      <Eraser className="h-4 w-4" />
                      Rensa historiken
                    </Button>
                  </div>
                  {devStatus && (
                    <p className="text-sm text-slate-500">{devStatus}</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => navigate("/winesnap")} className="gap-2 rounded-full shadow-lg">
              <Camera className="h-4 w-4" />
              Ny skanning
            </Button>
          </div>
        </div>

        <Card className="border-none bg-card/80 shadow-xl backdrop-blur">
          <CardHeader className="space-y-4 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-3xl font-semibold">
                  <Sparkles className="h-6 w-6 text-primary" />
                  Dina vinminnen
                </CardTitle>
                <CardDescription className="max-w-2xl text-base">
                  Utforska dina tidigare analyser, upptäck återkommande favoriter och hoppa snabbt tillbaka in i WineSnap när inspirationen slår till.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="grid gap-6 pt-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-secondary/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Totalt sparade</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{entries.length}</p>
                <p className="text-sm text-muted-foreground">Alla analyser finns sparade lokalt på din enhet.</p>
              </div>
              <div className="rounded-2xl border bg-accent/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Senaste analys</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {lastTimestamp ? formatRelativeTime(lastTimestamp) : "–"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastTimestamp ? formatDate(lastTimestamp) : "Gör en skanning för att komma igång."}
                </p>
              </div>
              <div className="rounded-2xl border bg-primary/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ursprung representerade</p>
                <p className="mt-2 text-3xl font-semibold text-primary">{regionsCount}</p>
                <p className="text-sm text-muted-foreground">Ett smakbibliotek fyllt av olika regioner.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {entries.length === 0 ? (
          <Card className="border-none bg-card/80 text-center shadow-lg backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Ingen historik ännu</CardTitle>
              <CardDescription className="text-base">
                Dina analyser sparas automatiskt här varje gång du fotar en vinflaska med WineSnap.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-10">
              <Button onClick={() => navigate("/winesnap")} className="gap-2 rounded-full shadow-md">
                <Camera className="h-4 w-4" />
                Starta första skanningen
              </Button>
              <Button
                variant="outline"
                onClick={() => setDevDialogOpen(true)}
                className="gap-2 rounded-full border-dashed"
              >
                <Wand2 className="h-4 w-4" />
                Visa testverktyg
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => {
              const pairings = entry.result.passar_till?.slice(0, 3) ?? [];
              const classificationTags = [
                { label: "Färg", value: entry.result.färgtyp },
                { label: "Smaktyp", value: entry.result.typ },
                { label: "Ursprungsangivelse", value: entry.result.klassificering },
              ]
                .map((tag) => ({ ...tag, value: tag.value?.trim() }))
                .filter((tag) => tag.value);

              const baseFacts = [
                { label: "Producent", value: entry.result.producent || "–" },
                { label: "Land/Region", value: entry.result.land_region || "–" },
                { label: "Årgång", value: entry.result.årgång || "–" },
                { label: "Druvor", value: entry.result.druvor || "–" },
              ];

              const tasteProfile = getSystembolagetTasteProfile(entry.result);
              const hasTasteData = tasteProfile.meters.some((meter) => meter.value !== null);

              return (
                <Card
                  key={entry.key}
                  className="border-none bg-card/80 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl backdrop-blur"
                >
                  <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:items-start">
                    <div className="relative w-full overflow-hidden rounded-3xl bg-muted shadow-sm md:max-w-[220px]">
                      {entry.imageData ? (
                        <img
                          src={entry.imageData}
                          alt={entry.result.vin || "Vin"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[180px] items-center justify-center text-muted-foreground">
                          Ingen bild
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-xs font-medium uppercase tracking-wide text-white/80">
                        {formatRelativeTime(entry.timestamp)}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h2 className="text-2xl font-semibold text-card-foreground">
                            {entry.result.vin || "Okänt vin"}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {entry.result.land_region || "–"}
                            {entry.result.årgång ? ` • Årgång ${entry.result.årgång}` : ""}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">{formatDate(entry.timestamp)}</p>
                      </div>

                      <div className="space-y-4">
                        {classificationTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {classificationTags.map((tag) => (
                              <span
                                key={tag.label}
                                className="inline-flex items-center gap-2 rounded-full border bg-primary/10 px-3 py-1 text-xs text-primary"
                              >
                                <span className="text-[10px] uppercase tracking-[0.25em] text-primary/70">{tag.label}</span>
                                <span className="font-semibold">{tag.value}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                          <div className="rounded-2xl border bg-muted/70 p-4 text-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Artikelinformation</p>
                            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                              {baseFacts.map((fact) => (
                                <div key={fact.label} className="space-y-1">
                                  <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{fact.label}</dt>
                                  <dd className="text-base font-semibold text-foreground">{fact.value}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>

                          <div className="rounded-2xl border bg-card p-4 text-sm shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Systembolagets smakprofil</p>
                            <p className="mt-1 text-xs text-muted-foreground">Skala 0–5. Hämtad från senaste analysen.</p>
                            <div className="mt-4 grid grid-cols-3 gap-3">
                              {tasteProfile.meters.map((meter) => (
                                <div key={meter.label} className="flex flex-col items-center gap-2">
                                  <GaugeCircleSB label={meter.label} value={meter.value ?? null} size={60} stroke={6} showValue />
                                  <span className="text-[11px] text-muted-foreground">
                                    {typeof meter.value === "number" ? `${meter.value.toFixed(1)}/5` : "–"}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {!hasTasteData && (
                              <p className="mt-3 text-xs text-amber-600">Systembolaget har inte publicerat värden för denna flaska.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-card/70 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Serveringsnotiser</p>
                          <div className="mt-2 text-sm">
                            <p>{entry.result.servering || "Systembolaget har inte publicerat serveringsråd."}</p>
                            {pairings.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {pairings.map((pairing) => (
                                  <li
                                    key={pairing}
                                    className="rounded-full border bg-muted px-3 py-1 text-xs"
                                  >
                                    {pairing}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex flex-wrap gap-3">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" className="gap-2 rounded-full">
                              Visa detaljer
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{entry.result.vin || "Vinprofil"}</DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[70vh] overflow-y-auto">
                              <WineCardSBFull data={entry.result} />
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyToClipboard(entry)}
                          className="gap-2 rounded-full"
                        >
                          <Copy className="h-4 w-4" />
                          Kopiera
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemove(entry.key)}
                          className="gap-2 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
