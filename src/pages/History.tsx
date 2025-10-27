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
import {
  SystembolagetClassification,
} from "@/components/SystembolagetClassification";
import {
  SystembolagetFactList,
  type FactItem,
} from "@/components/SystembolagetFactList";
import { SystembolagetTasteProfile } from "@/components/SystembolagetTasteProfile";
import { ArrowLeft, Camera, Eraser, Sparkles, Trash2, Wand2 } from "lucide-react";

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F9F5FF] via-white to-[#F2F9FF]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-24 h-72 w-72 rounded-full bg-[#D6C3FF]/40 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-[#BDE0FE]/30 blur-[120px]" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/70 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 rounded-full border border-transparent bg-white/60 px-4 shadow-sm backdrop-blur">
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>
            <Badge variant="outline" className="rounded-full border-purple-200 bg-purple-50 text-purple-700">
              {entries.length === 0 ? "Tom historik" : `${entries.length} sparade analyser`}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} className="rounded-full border-slate-200 bg-white/70 backdrop-blur">
              Uppdatera
            </Button>
            <Dialog open={devDialogOpen} onOpenChange={setDevDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full border-dashed border-purple-200 bg-white/70 text-purple-600 shadow-sm backdrop-blur transition hover:border-purple-300 hover:bg-purple-50"
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
                  <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 text-sm text-slate-600">
                    <p className="font-medium text-purple-700">Tips</p>
                    <p>
                      Demoposterna sparas lokalt i din webbläsare. De påverkar inte riktiga analyser och kan tas bort när som helst.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={handleSeedDemo} className="gap-2 rounded-full shadow-md shadow-purple-400/30 sm:flex-1">
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
            <Button onClick={() => navigate("/winesnap")} className="gap-2 rounded-full shadow-lg shadow-purple-500/20">
              <Camera className="h-4 w-4" />
              Ny skanning
            </Button>
          </div>
        </div>

        <Card className="border-none bg-white/80 shadow-xl backdrop-blur">
          <CardHeader className="space-y-4 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-3xl font-semibold text-[#332244]">
                  <Sparkles className="h-6 w-6 text-purple-500" />
                  Dina vinminnen
                </CardTitle>
                <CardDescription className="max-w-2xl text-base text-slate-600">
                  Utforska dina tidigare analyser, upptäck återkommande favoriter och hoppa snabbt tillbaka in i WineSnap när inspirationen slår till.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="grid gap-6 pt-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Totalt sparade</p>
                <p className="mt-2 text-3xl font-semibold text-[#322152]">{entries.length}</p>
                <p className="text-sm text-purple-500/80">Alla analyser finns sparade lokalt på din enhet.</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Senaste analys</p>
                <p className="mt-2 text-lg font-semibold text-[#23395B]">
                  {lastTimestamp ? formatRelativeTime(lastTimestamp) : "–"}
                </p>
                <p className="text-sm text-blue-500/80">
                  {lastTimestamp ? formatDate(lastTimestamp) : "Gör en skanning för att komma igång."}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Ursprung representerade</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-700">{regionsCount}</p>
                <p className="text-sm text-emerald-600/80">Ett smakbibliotek fyllt av olika regioner.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {entries.length === 0 ? (
          <Card className="border-none bg-white/80 text-center shadow-lg backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-[#332244]">Ingen historik ännu</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Dina analyser sparas automatiskt här varje gång du fotar en vinflaska med WineSnap.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-10">
              <Button onClick={() => navigate("/winesnap")} className="gap-2 rounded-full shadow-md shadow-purple-400/30">
                <Camera className="h-4 w-4" />
                Starta första skanningen
              </Button>
              <Button
                variant="outline"
                onClick={() => setDevDialogOpen(true)}
                className="gap-2 rounded-full border-dashed border-purple-200 text-purple-600 hover:border-purple-300 hover:bg-purple-50"
              >
                <Wand2 className="h-4 w-4" />
                Visa testverktyg
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => {
              const pairings = entry.result.passar_till?.slice(0, 4) ?? [];

              const articleFacts: FactItem[] = [
                { label: "Producent", value: entry.result.producent || "–" },
                { label: "Druvor", value: entry.result.druvor || "–" },
                { label: "Årgång", value: entry.result.årgång || "–" },
                { label: "Land/Region", value: entry.result.land_region || "–" },
              ];

              const analysisFacts: FactItem[] = [
                { label: "Alkoholhalt", value: entry.result.alkoholhalt || "–" },
                { label: "Volym", value: entry.result.volym || "–" },
                { label: "Sockerhalt", value: entry.result.sockerhalt || "–" },
                { label: "Syra", value: entry.result.syra || "–" },
              ];

              const descriptionBlocks = [
                { label: "Karaktär", value: entry.result.karaktär },
                { label: "Smak", value: entry.result.smak },
              ].filter((block) => block.value && block.value.trim().length > 0);

              const relativeTime = formatRelativeTime(entry.timestamp);

              return (
                <Card
                  key={entry.key}
                  className="border-none bg-white/95 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-xl backdrop-blur"
                >
                  <CardContent className="space-y-8 p-6">
                    <header className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex gap-4">
                          <div className="relative h-28 w-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm">
                            {entry.imageData ? (
                              <img
                                src={entry.imageData}
                                alt={entry.result.vin || "Vin"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.32em] text-slate-400">
                                Ingen bild
                              </div>
                            )}
                            {relativeTime && (
                              <div className="absolute inset-x-2 bottom-2 rounded-full bg-slate-900/70 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-white/90">
                                {relativeTime}
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Systembolaget</p>
                              <h2 className="text-2xl font-semibold text-[#322152]">
                                {entry.result.vin || "Okänt vin"}
                              </h2>
                              <p className="text-sm text-slate-600">
                                {entry.result.land_region || "–"}
                                {entry.result.årgång ? ` • Årgång ${entry.result.årgång}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="rounded-full border border-purple-200 bg-purple-50 text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-700">
                                {entry.result.typ || "Smaktyp saknas"}
                              </Badge>
                              <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                                {entry.result.färgtyp || "Färg saknas"}
                              </Badge>
                              {entry.result.klassificering && (
                                <Badge className="rounded-full border border-slate-200 bg-white text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                                  {entry.result.klassificering}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 text-sm text-slate-500 md:items-end md:text-right">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                            {entry.result.producent || "Okänd producent"}
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Sparad</p>
                            <p className="text-sm font-medium text-slate-700">{formatDate(entry.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    </header>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                      <div className="space-y-5">
                        <SystembolagetClassification result={entry.result} />

                        {descriptionBlocks.length > 0 && (
                          <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                            <header className="space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                                Systembolagets beskrivning
                              </p>
                              <p className="text-xs text-slate-500">Karaktär och smak enligt Systembolagets text.</p>
                            </header>
                            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
                              {descriptionBlocks.map((block) => (
                                <div key={block.label} className="space-y-1">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {block.label}
                                  </p>
                                  <p>{block.value}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                          <header className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                              Servering enligt Systembolaget
                            </p>
                            <p className="text-xs text-slate-500">Serveringsråd och matmatchningar från Systembolaget.</p>
                          </header>
                          <div className="mt-4 space-y-3 text-sm text-slate-700">
                            <p>{entry.result.servering || "Systembolaget har inte publicerat serveringsråd."}</p>
                            {pairings.length > 0 && (
                              <ul className="flex flex-wrap gap-2">
                                {pairings.map((pairing) => (
                                  <li
                                    key={pairing}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600"
                                  >
                                    {pairing}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </section>
                      </div>

                      <div className="space-y-5">
                        <SystembolagetTasteProfile result={entry.result} />

                        <SystembolagetFactList
                          title="Artikelfakta"
                          subtitle="Nyckeluppgifter från Systembolaget."
                          items={articleFacts}
                          columns={2}
                        />

                        <SystembolagetFactList
                          title="Analysdata"
                          subtitle="Alkoholhalt och kemiska nyckeltal."
                          items={analysisFacts.filter((fact) => fact.value && fact.value.trim() !== "–")}
                          columns={2}
                          footnote="Hämtat från den senast sparade analysen."
                        />
                      </div>
                    </div>

                    <Separator className="h-px bg-slate-200/70" />

                    <footer className="flex flex-wrap gap-3">
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
                        onClick={() => handleRemove(entry.key)}
                        className="gap-2 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Ta bort
                      </Button>
                    </footer>
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
