import type { ReactNode } from "react";
import { Camera, Brain, Database, Shield, Wine } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { AppShell } from "@/components/layout/AppShell";

export default function About() {
  return (
    <AppShell>
      <div className="space-y-12 pb-16">
        {/* Header */}
        <header className="space-y-5 text-center">
          <Logo size="md" className="justify-center" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Wine className="h-3.5 w-3.5 text-gold" />
            Om WineSnap
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Din digitala sommelier
          </h1>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            WineSnap känner igen vinetiketter med AI och skapar automatiskt din
            vinprofil – smak, stil och serveringstips på sekunder.
          </p>
        </header>

        {/* Why */}
        <section className="rounded-3xl border border-border bg-card/60 p-6 shadow-soft backdrop-blur">
          <h2 className="font-display text-2xl font-semibold text-foreground">Varför WineSnap?</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Vinetiketter kan vara svåra att tolka – språk, druvor, regioner och
            klassificeringar varierar. WineSnap översätter etiketterna till en
            tydlig vinprofil så att du snabbt förstår vad du håller i handen.
          </p>
        </section>

        {/* How it works */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-foreground">Så fungerar det</h2>
          <ul className="grid gap-3">
            <FeatureCard
              icon={<Camera className="h-5 w-5" />}
              step="01"
              title="Fotografera etiketten"
              text="Fyll sökramen och ta en tydlig bild – helst i mjukt ljus."
            />
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              step="02"
              title="AI läser och tolkar"
              text="Bildigenkänning och AI plockar ut namn, druvor, region och årgång."
            />
            <FeatureCard
              icon={<Wine className="h-5 w-5" />}
              step="03"
              title="Vinprofil skapas"
              text="Smakprofil, serveringstips och matchningar på sekunder."
            />
            <FeatureCard
              icon={<Database className="h-5 w-5" />}
              step="04"
              title="Sparas i historiken"
              text="Resultat lagras lokalt och kan öppnas igen vid nästa tillfälle."
            />
          </ul>
        </section>

        {/* Privacy */}
        <section className="rounded-3xl border border-border bg-gradient-luxe p-6 text-primary-foreground shadow-elegant">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4 text-gold" />
            Teknik & integritet
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed opacity-90">
            <li>
              WineSnap använder bildigenkänning (OCR) och AI för att analysera
              etiketter och bygga vinprofilen.
            </li>
            <li>
              Bilder hanteras i första hand lokalt på enheten. Vid behov görs
              säkra anrop till vår backend för att förbättra träffsäkerheten.
            </li>
            <li>
              Historiken sparas på din enhet och, om du är inloggad, synkroniseras
              till ditt konto så att du kan komma åt den från andra enheter.
            </li>
            <li>
              <strong>Data vi sparar:</strong> skanningsresultat, ett anonymt
              enhets-ID och, om du loggar in, din e-postadress och profilinfo.
              Vi säljer aldrig din data till tredje part.
            </li>
          </ul>
        </section>

        {/* Vision */}
        <section className="space-y-3 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground">Vision</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Vi bygger WineSnap för att göra vinvärlden mer lättillgänglig –
            nyfikenhet först, jargong sen. En smart hjälpreda i fickan.
          </p>
        </section>

        {/* CTA */}
        <footer className="flex flex-col gap-3">
          <Button asChild size="lg" className="h-12 rounded-2xl bg-gradient-luxe shadow-elegant">
            <Link to="/">Starta skanning</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl border-border bg-card/60">
            <Link to="/me/wines">Öppna historiken</Link>
          </Button>
        </footer>
      </div>
    </AppShell>
  );
}

function FeatureCard({
  icon,
  step,
  title,
  text,
}: {
  icon: ReactNode;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-border bg-card/60 p-4 shadow-soft backdrop-blur">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-gold text-primary-foreground shadow-soft">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-xs tracking-[0.2em] text-gold">{step}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}
