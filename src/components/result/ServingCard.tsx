import React from "react";
import { Thermometer, Wine } from "lucide-react";

export default function ServingCard({ servering }: { servering?: string }) {
  if (!servering || servering === "–") return null;

  const tempMatch = servering.match(/(\d{1,2})\s*[-–°]\s*(\d{1,2})?/);
  const hasTemp = tempMatch !== null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10">
      <div className="mb-2 flex items-center gap-2">
        {hasTemp ? (
          <Thermometer className="h-4 w-4 text-primary" />
        ) : (
          <Wine className="h-4 w-4 text-primary" />
        )}
        <h3 className="text-sm font-semibold text-white">Servering</h3>
      </div>
      <p className="text-sm text-white/70">{servering}</p>
    </section>
  );
}