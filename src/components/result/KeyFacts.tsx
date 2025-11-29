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
  delay 
}: { 
  label: string; 
  value?: string; 
  icon: React.ElementType;
  delay: number;
}) => {
  if (!value || value === "–") return null;
  
  return (
    <div 
      className="group flex items-center gap-3 rounded-xl border border-theme-card bg-theme-elevated p-3 transition-all duration-200 hover:border-accent-primary/30 hover:shadow-theme-elevated animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary transition-colors group-hover:bg-accent-primary/20">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="text-[10px] font-medium uppercase tracking-wider text-theme-secondary">
          {label}
        </span>
        <span className="truncate text-sm font-medium text-theme-primary">
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
    <section className="rounded-2xl border border-theme-card bg-gradient-to-br from-theme-elevated to-theme-elevated/60 p-4">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-theme-primary">
        Fakta
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {visibleFacts.map((fact, index) => (
          <Row
            key={fact.key}
            label={fact.label}
            value={props[fact.key]}
            icon={fact.icon}
            delay={index * 50}
          />
        ))}
      </div>
    </section>
  );
}
