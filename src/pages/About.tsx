import type { ReactNode } from "react";
import { Camera, Brain, Database, Shield, Wine } from "lucide-react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0B0714] via-[#0E0A1A] to-[#0B0714] text-slate-100">
      {/* Page container */}
      <div className="mx-auto max-w-4xl px-5 py-12 md:py-16">
        {/* Header */}
        <header className="mb-10 md:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs tracking-wide text-purple-200/80 ring-1 ring-white/10">
            <Wine className="h-3.5 w-3.5" />
            OM WINESNAP
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-white md:text-4xl">
            Din digitala sommelier
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-300">
            WineSnap känner igen vinetiketter med AI och skapar automatiskt din
            vinprofil – smak, stil och serveringstips på sekunder. Skanna, få
            svar och spara resultaten till nästa gång.
          </p>
        </header>

        {/* Why section */}
        <section className="mb-10 md:mb-14">
          <h2 className="text-2xl font-semibold text-white">Varför WineSnap?</h2>
          <p className="mt-3 text-slate-300">
            Vinetiketter kan vara svåra att tolka – språk, druvor, regioner och
            klassificeringar varierar. WineSnap översätter etiketterna till en
            tydlig vinprofil så att du snabbt förstår vad du håller i handen.
          </p>
        </section>

        {/* How it works */}
        <section className="mb-10 md:mb-14">
          <h2 className="text-2xl font-semibold text-white">Så fungerar det</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<Camera className="h-5 w-5" />}
              title="Fotografera etiketten"
              text="Fyll sökramen och ta en tydlig bild – helst i mjukt ljus."
            />
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              title="AI läser och tolkar"
              text="Bildigenkänning (OCR) och AI plockar ut namn, druvor, region och årgång."
            />
            <FeatureCard
              icon={<Wine className="h-5 w-5" />}
              title="Vinprofil skapas"
              text="Du får smakprofil, serveringstips och matchningar på sekunder."
            />
            <FeatureCard
              icon={<Database className="h-5 w-5" />}
              title="Sparas i historiken"
              text="Resultat lagras lokalt och kan öppnas igen vid nästa tillfälle."
            />
          </ul>
        </section>

        {/* Tech & privacy */}
        <section className="mb-10 md:mb-14">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-purple-200/90">
              <Shield className="h-4 w-4" />
              Teknik & integritet
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                WineSnap använder bildigenkänning (OCR) och AI för att analysera
                etiketter och bygga vinprofilen.
              </li>
              <li>
                Bilder hanteras i första hand lokalt på enheten. Vid behov görs
                säkra anrop till vår backend för att förbättra träffsäkerheten.
              </li>
              <li>
                Historiken sparas på din enhet så att du snabbt kan återbesöka
                tidigare skanningar och jämföra viner.
              </li>
            </ul>
          </div>
        </section>

        {/* Vision / team (optional short note) */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white">Vision</h2>
          <p className="mt-3 text-slate-300">
            Vi bygger WineSnap för att göra vinvärlden mer lättillgänglig –
            nyfikenhet först, jargong sen. En smart hjälpreda i fickan som gör
            det roligare att hitta dina favoriter.
          </p>
        </section>

        {/* CTA */}
        <footer className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] px-6 font-semibold text-white shadow-[0_20px_40px_-22px_rgba(123,63,228,0.95)] hover:opacity-95"
          >
            Starta skanning
          </Link>
          <Link
            to="/historik"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 font-medium text-slate-100 hover:bg-white/10"
          >
            Öppna historiken
          </Link>
        </footer>
      </div>
    </main>
  );
}

/** --- Small presentational card --- */
function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="mb-2 inline-flex items-center gap-2 text-sm text-purple-200/90">
        <span className="grid h-7 w-7 place-content-center rounded-full bg-purple-500/15 ring-1 ring-purple-400/20">
          {icon}
        </span>
        <span className="font-semibold text-white">{title}</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-300">{text}</p>
    </li>
  );
}
