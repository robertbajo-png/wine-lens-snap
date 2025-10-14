import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Brain,
  Camera,
  Clock3,
  History as HistoryIcon,
  ShieldCheck,
  Sparkles,
  Utensils,
  Wine,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const heroStats = [
  {
    label: "Snittid till svar",
    value: "≈ 6 sek",
    hint: "Supabase Edge + GPT optimerar kedjan",
  },
  {
    label: "Matchade rätter",
    value: "3 rekommendationer",
    hint: "AI:n kopplar smakprofil till mat",
  },
  {
    label: "Lokalt sparat",
    value: "100% offline",
    hint: "Historiken bor i din enhet",
  },
];

const featureCards = [
  {
    title: "AI sommelier",
    description: "OCR, Supabase och GPT samarbetar för att förstå etiketten och dra slutsatser om smakprofilen.",
    icon: Brain,
  },
  {
    title: "Matmatchningar",
    description: "Få serverings- och pairingförslag så du vet exakt vad flaskan passar till.",
    icon: Utensils,
  },
  {
    title: "Historik som lär",
    description: "Snabb åtkomst till tidigare analyser gör varje ny skanning smartare och snabbare.",
    icon: HistoryIcon,
  },
  {
    title: "Integritet först",
    description: "Du bestämmer vad som sparas. Rensa lokalt eller i Supabase när du vill.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  {
    title: "Rikta kameran",
    description: "Fota etiketten i bra ljus – guiden visar exakt hur bilden ska linjera.",
  },
  {
    title: "AI-analys",
    description: "OCR + GPT identifierar druvor, smaknoter och kopplar samman med Supabase.",
  },
  {
    title: "Spara & dela",
    description: "Historiken ger dig favoritlistor, snabb åtkomst och smarta rekommendationer.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070311] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-36 top-24 h-72 w-72 rounded-full bg-[#8B5CF6]/30 blur-[140px]" />
        <div className="absolute right-[-80px] top-40 h-80 w-80 rounded-full bg-[#38BDF8]/15 blur-[150px]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <header className="py-8">
          <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-md sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 shadow-lg shadow-purple-900/40">
                <Wine className="h-6 w-6 text-purple-100" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">WineSnap</p>
                <p className="text-sm text-slate-200/80">Självlärande vinanalys med Supabase + AI</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-slate-200/70">
                <Sparkles className="h-3.5 w-3.5" />
                Beta
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-200 hover:text-white"
                onClick={() => navigate("/historik")}
              >
                Historik
              </Button>
              <Button
                size="sm"
                className="rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-white shadow-[0_18px_45px_-20px_rgba(123,63,228,1)]"
                onClick={() => navigate("/winesnap")}
              >
                Starta skanning
              </Button>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-24 pb-16">
          <section className="grid flex-1 items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-8">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-sm text-purple-100 shadow-sm">
                <Sparkles className="h-4 w-4" />
                Supersnabb vinanalys på svenska
              </span>

              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Fota etiketten. WineSnap skapar vinprofilen på sekunder.
                </h1>
                <p className="max-w-xl text-lg text-slate-200">
                  Kombinera kameran med GPT, Supabase och smart caching. Du får druvor, smakprofil, serveringstips och pairing-rekommendationer som sparas lokalt.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  onClick={() => navigate("/winesnap")}
                  className="h-14 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] px-8 text-base font-semibold shadow-[0_20px_40px_-22px_rgba(123,63,228,0.95)]"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Fota vinflaska
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate("/historik")}
                  className="h-14 rounded-full border-white/20 bg-white/10 px-8 text-base text-slate-100 hover:bg-white/15"
                >
                  Utforska historiken
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {heroStats.map(({ label, value, hint }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-purple-200/80">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                    <p className="text-sm text-slate-300">{hint}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden h-full min-h-[360px] rounded-[32px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-8 shadow-2xl shadow-purple-900/40 backdrop-blur lg:block">
              <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-white/5" />
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="space-y-4 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-200/70">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 uppercase tracking-[0.25em]">
                      <Clock3 className="h-3.5 w-3.5" />
                      Realtidsvy
                    </span>
                    <span>Supabase Edge • GPT-4o mini</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-white">Så här ser nästa skanning ut</h2>
                  <p className="text-sm text-slate-200/80">
                    WineSnap guidar dig från foto till klar analys med tydliga statussteg och sparar resultatet direkt i din historik.
                  </p>
                </div>

                <div className="space-y-3">
                  {["Fånga etiketten", "Läser text", "Bygger vinprofil"].map((step) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-[#7B3FE4] to-[#9C5CFF] text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      {step}
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200/80">
                  <p className="font-medium text-white">Tips för bästa resultat</p>
                  <p>Fota i mjukt ljus och fyll ut etiketten så mycket som möjligt i kamerarutan.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-10">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">Varför vinälskare väljer WineSnap</h2>
              <p className="max-w-2xl text-slate-200/80">
                Designad för spontana butiksbesök och planerade middagar. WineSnap gör researchen åt dig och bygger en privat vinbank.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {featureCards.map(({ title, description, icon: Icon }) => (
                <div key={title} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/5 blur-3xl" />
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-purple-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm text-slate-200/80">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-left text-slate-200">
              <h2 className="text-xl font-semibold text-white">Snabb överblick</h2>
              <p>
                Den här sektionen bevarar innehållet från den enklare startsidan så att användare som följer tidigare instruktioner känner igen sig och mergekonflikter minimeras.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 h-5 w-5 text-[#B095FF]" />
                  <div>
                    <h3 className="font-medium text-white">🤖 AI-analys</h3>
                    <p className="text-sm text-slate-300">Få detaljerad information om druvor, smak och servering.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Utensils className="mt-1 h-5 w-5 text-[#B095FF]" />
                  <div>
                    <h3 className="font-medium text-white">🍽️ Matparning</h3>
                    <p className="text-sm text-slate-300">Upptäck perfekta maträtter till ditt vin.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left text-sm text-slate-200">
              <h2 className="text-xl font-semibold text-white">Tips innan du börjar</h2>
              <p className="mb-4">
                Bäst resultat i bra ljus och rak etikett. Samma riktlinje som tidigare README och startsida – nu införd här för att reducera konflikter när olika grenar justerar copy.
              </p>
              <ul className="space-y-3">
                {["Ställ flaskan mot en neutral bakgrund.", "Låt etiketten fylla guiden i kameran.", "Vill du testa utan egen flaska? Öppna Testverktyget i historiken."]
                  .map((tip) => (
                    <li key={tip} className="flex items-start gap-3">
                      <ArrowRight className="mt-1 h-4 w-4 text-purple-200" />
                      <span>{tip}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </section>

          <section className="space-y-12">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">Så snabbt är du igång</h2>
              <p className="max-w-2xl text-slate-200/80">
                Följ tre enkla steg för att göra din första AI-drivna vinanalys – helt i mobilen.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/5 p-6"
                >
                  <div className="absolute -right-8 -top-6 h-20 w-20 rounded-full bg-white/5 blur-2xl" />
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-base font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="mt-4 text-sm font-semibold text-purple-100/90">{step.title}</p>
                  <p className="mt-3 text-sm text-slate-200/80">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#7B3FE4]/20 via-[#8451ED]/20 to-[#38BDF8]/20 px-8 py-10 backdrop-blur">
              <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-black/20 to-transparent" />
              <div className="relative flex flex-col items-start gap-6 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl space-y-3">
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-purple-100">
                    <Sparkles className="h-3.5 w-3.5" />
                    Klart på minuter
                  </p>
                  <h2 className="text-3xl font-semibold text-white">Bygg ditt vinbibliotek idag</h2>
                  <p className="text-sm text-slate-200/85">
                    Installera WineSnap som PWA eller kör direkt i webben. Nästa gång du står i butiken vet du om flaskan är värd att ta med hem.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-white/90 px-8 text-base font-semibold text-slate-900 transition hover:bg-white"
                  onClick={() => navigate("/winesnap")}
                >
                  Kom igång
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-auto border-t border-white/10 bg-black/20 py-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-400 sm:flex-row sm:px-6 lg:px-8">
            <span>© {new Date().getFullYear()} WineSnap. Byggd med Supabase, Vite och GPT.</span>
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Din digitala sommelier.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
