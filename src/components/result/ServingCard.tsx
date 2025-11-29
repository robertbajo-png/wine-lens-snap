import React from "react";
import { Thermometer, Wine } from "lucide-react";

export default function ServingCard({ servering }: { servering?: string }) {
  if (!servering || servering === "–") return null;

  // Try to extract temperature if present
  const tempMatch = servering.match(/(\d{1,2})\s*[-–°]\s*(\d{1,2})?/);
  const hasTemp = tempMatch !== null;

  return (
    <section className="rounded-2xl border border-theme-card bg-gradient-to-br from-theme-elevated via-theme-elevated/90 to-theme-elevated/70 p-4 animate-fade-in">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
          {hasTemp ? <Thermometer className="h-4 w-4" /> : <Wine className="h-4 w-4" />}
        </div>
        <h3 className="text-sm font-semibold text-theme-primary">Servering</h3>
      </div>
      
      <p className="text-sm leading-relaxed text-theme-secondary">{servering}</p>
    </section>
  );
}

