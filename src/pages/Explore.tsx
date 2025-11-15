import { AmbientBackground } from "@/components/AmbientBackground";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Search, Globe2 } from "lucide-react";

const highlightCards = [
  {
    title: "Trendande regioner",
    description: "Se vilka regioner som sticker ut just nu baserat på WineSnap-communityn.",
    icon: Globe2,
  },
  {
    title: "Populära stilar",
    description: "Filtrera fram druvor och smakprofiler som matchar dina preferenser.",
    icon: Compass,
  },
  {
    title: "Snabbfiltrering",
    description: "Sök bland tusentals etiketter med smarta filter för pris, omdömen och mer.",
    icon: Search,
  },
];

const Explore = () => {
  return (
    <div className="relative min-h-full overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-28 pt-16 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-theme-elevated/80">
            <Compass className="h-6 w-6 text-theme-primary" aria-hidden="true" />
          </div>
          <div>
            <Badge variant="outline" className="border-theme-primary/20 bg-theme-elevated/70 text-xs uppercase tracking-[0.2em]">
              Utforska
            </Badge>
            <h1 className="mt-2 text-3xl font-semibold text-theme-primary sm:text-4xl">Utforska vinvärlden</h1>
            <p className="mt-2 max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
              Hitta nya favoriter genom att dyka ned i trender, regioner och rekommendationer.
              Snart kan du också följa curated listor och se live-uppdateringar från communityn.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlightCards.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border-theme-card/50 bg-theme-elevated/80 backdrop-blur">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <Icon className="h-6 w-6 text-theme-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-lg font-semibold text-theme-primary">{title}</h2>
                  <p className="mt-1 text-sm text-theme-secondary/80">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Explore;

