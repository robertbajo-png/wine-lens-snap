import React from "react";
import { Grape, Palette, Award, Percent, FlaskConical, Droplets, Beaker } from "lucide-react";

interface Props {
  druvor?: string;
  fargtyp?: string;
  klassificering?: string;
  alkoholhalt?: string;
  volym?: string;
  sockerhalt?: string;
  syra?: string;
}

type FactConfig = {
  key: keyof Props;
  label: string;
  icon: React.ElementType;
};

const facts: FactConfig[] = [
  { key: "druvor", label: "Druvor", icon: Grape },
  { key: "fargtyp", label: "Färg/typ", icon: Palette },
  { key: "klassificering", label: "Klassificering", icon: Award },
  { key: "alkoholhalt", label: "Alkohol", icon: Percent },
  { key: "volym", label: "Volym", icon: FlaskConical },
  { key: "sockerhalt", label: "Socker", icon: Droplets },
  { key: "syra", label: "Syra", icon: Beaker },
];

const Row = ({ 
  label, 
  value, 
  icon: Icon,
}: { 
  label: string; 
  value?: string; 
  icon: React.ElementType;
}) => {
  if (!value || value === "–") return null;
  
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">
          {label}
        </span>
        <span className="truncate text-sm font-medium text-white">
          {value}
        </span>
      </div>
    </div>
  );
};

export default function KeyFacts(props: Props) {
  const visibleFacts = facts.filter(f => props[f.key] && props[f.key] !== "–");
  
  if (visibleFacts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Fakta</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleFacts.map((fact) => (
          <Row
            key={fact.key}
            label={fact.label}
            value={props[fact.key]}
            icon={fact.icon}
          />
        ))}
      </div>
    </section>
  );
}