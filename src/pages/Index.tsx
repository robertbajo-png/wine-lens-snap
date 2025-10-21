import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Sparkles,
  Utensils,
  Wand2,
  TimerReset,
  Wine,
  History as HistoryIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAllCachedAnalyses } from "@/lib/wineCache";

interface LandingStats {
  count: number;
  latestWine: string | null;
  latestTime: string | null;
}

const steps = [
  {
    icon: Camera,
    title: "Fota vinflaskan",
    description: "Sikta rakt mot etiketten i bra ljus för bästa OCR-resultat.",
  },
  {
    icon: Wand2,
    title: "AI tolkar etiketten",
    description: "Text och bild bearbetas för att hitta vin, årgång och producent.",
  },
  {
    icon: Utensils,
    title: "Få serveringsförslag",
    description: "Du får smakprofil, pairing-idéer och serveringstips direkt.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LandingStats>({ count: 0, latestWine: null, latestTime: null });

  useEffect(() => {
    const entries = getAllCachedAnalyses().filter(entry => !entry.key.startsWith("wine_analysis_demo_"));

    if (!entries.length) {
      setStats({ count: 0, latestWine: null, latestTime: null });
      return;
    }

    const latest = entries[0];
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    setStats({
      count: entries.length,
      latestWine: latest.result.vin || "Okänt vin",
      latestTime: formatter.format(new Date(latest.timestamp)),
    });
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070218] text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#7B3FE4]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#342A88]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-y-1/3 rounded-full bg-[#1B0D3F]/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-14 px-6 pb-16 pt-12 sm:px-10 lg:gap-24 lg:pt-16">
        <header className="flex flex-wrap items-center justify-between gap-4 text-sm text-white/70">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
              <Wine className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">WineSnap</p>
              <p className="text-base font-semibold text-white">Din digitala sommelier</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/historik")}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <HistoryIcon className="h-4 w-4" />
            Sparade analyser
          </button>
        </header>

        <section className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-white/70 backdrop-blur">
                <Sparkles className="h-4 w-4 text-[#C9A6FF]" />
                AI + Supabase minns dina tidigare flaskor
              </span>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Din digitala sommelier.
              </h1>
              <p className="max-w-xl text-lg text-white/70">
                Fota etiketten och få importör, smakprofil, druvor och serveringsförslag på sekunder. Appen lär sig av dina tidigare sökningar för att bli smartare.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={() => navigate("/winesnap")}
                className="group h-14 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] px-8 text-base font-semibold shadow-[0_35px_60px_-25px_rgba(123,63,228,0.65)] transition-transform hover:scale-[1.02]"
              >
                <Camera className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-px group-hover:scale-110" />
                Fota vinflaska
              </Button>

              <button
                type="button"
                onClick={() => navigate("/winesnap")}
                className="inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-medium text-white/70 transition hover:text-white"
              >
                eller ladda upp bild
              </button>
            </div>

            <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur lg:max-w-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/40">Snabbstatistik</p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-4xl font-bold text-white">{stats.count}</p>
                  <p className="text-sm text-white/60">sparade analyser på enheten</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <TimerReset className="mt-0.5 h-5 w-5 text-[#C9A6FF]" />
                  <div className="text-sm text-white/70">
                    {stats.latestTime ? (
                      <>
                        <p className="font-medium text-white">{stats.latestWine}</p>
                        <p>{stats.latestTime}</p>
                      </>
                    ) : (
                      <p>Ingen analys ännu – börja med din första skanning.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/40">Så funkar skanningen</p>
            <div className="space-y-4">
              {steps.map(step => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-[#0B0523]/70 p-5"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7B3FE4] to-[#4A1D86] text-white">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">{step.title}</p>
                    <p className="text-sm text-white/70">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40">Tips: håll flaskan rakt, fyll bilden med etiketten och undvik reflexer för bästa resultat.</p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Index;
