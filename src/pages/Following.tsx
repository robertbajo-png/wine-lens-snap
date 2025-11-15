import { AmbientBackground } from "@/components/AmbientBackground";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users2, Sparkles, BellRing } from "lucide-react";

const mockCreators = [
  { name: "Sommelier Sara", initials: "SS", focus: "Norditalienska pärlor" },
  { name: "Ferment Fred", initials: "FF", focus: "Naturliga orange-viner" },
  { name: "Bubbel-Berit", initials: "BB", focus: "Crémant som förtjänar hype" },
];

const Following = () => {
  return (
    <div className="relative min-h-full overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pb-28 pt-16 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-theme-elevated/80">
            <Users2 className="h-6 w-6 text-theme-primary" aria-hidden="true" />
          </div>
          <div>
            <Badge variant="outline" className="border-theme-primary/20 bg-theme-elevated/70 text-xs uppercase tracking-[0.2em]">
              Följer
            </Badge>
            <h1 className="mt-2 text-3xl font-semibold text-theme-primary sm:text-4xl">Bygg din vinsfär</h1>
            <p className="mt-2 max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
              Här dyker snart dina följda sommelierer, vänner och listor upp. Under tiden visar vi exempel på hur flödet kommer att se ut.
            </p>
          </div>
        </div>

        <Card className="border-theme-card/50 bg-theme-elevated/80 backdrop-blur">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-theme-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-theme-primary">Notifieringar på dina villkor</h2>
            </div>
            <p className="text-sm text-theme-secondary/80">
              Få push när någon du följer släpper en ny rekommendation eller uppdaterar en lista. Perfekt för att hålla koll på viner att prova nästa helg.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {mockCreators.map((creator) => (
            <Card key={creator.name} className="border-theme-card/50 bg-theme-elevated/80 backdrop-blur">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-theme-card/50">
                    <AvatarFallback className="bg-theme-card text-theme-primary">{creator.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{creator.name}</p>
                    <p className="text-xs text-theme-secondary/70">{creator.focus}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-theme-card/60 px-3 py-1 text-xs font-semibold text-theme-primary transition hover:bg-theme-card/80"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Följ snart
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Following;
