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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAllCachedAnalyses, removeCachedAnalysis, type CachedWineAnalysisEntry } from "@/lib/wineCache";
import WineCardSBFull from "@/components/WineCardSBFull";
import { ArrowLeft, Camera, Sparkles, Trash2 } from "lucide-react";

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

  useEffect(() => {
    setEntries(getAllCachedAnalyses());
  }, []);

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
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => {
              const pairings = entry.result.passar_till?.slice(0, 3) ?? [];

              return (
                <Card
                  key={entry.key}
                  className="border-none bg-white/80 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl backdrop-blur"
                >
                  <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:items-start">
                    <div className="relative w-full overflow-hidden rounded-3xl bg-slate-100 shadow-sm md:max-w-[220px]">
                      {entry.imageData ? (
                        <img
                          src={entry.imageData}
                          alt={entry.result.vin || "Vin"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[180px] items-center justify-center text-slate-400">
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
                          <h2 className="text-2xl font-semibold text-[#322152]">
                            {entry.result.vin || "Okänt vin"}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {entry.result.land_region || "–"}
                            {entry.result.årgång ? ` • Årgång ${entry.result.årgång}` : ""}
                          </p>
                        </div>
                        <p className="text-sm text-slate-400">{formatDate(entry.timestamp)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {entry.result.druvor && (
                          <Badge variant="outline" className="rounded-full border-purple-200 bg-purple-50 text-purple-700">
                            {entry.result.druvor}
                          </Badge>
                        )}
                        {entry.result.typ && (
                          <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                            {entry.result.typ}
                          </Badge>
                        )}
                        {pairings.map((pairing) => (
                          <Badge key={pairing} variant="outline" className="rounded-full border-slate-200 bg-white/80 text-slate-600">
                            {pairing}
                          </Badge>
                        ))}
                      </div>

                      <Separator className="bg-slate-100" />

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
