import React from "react";
import { Thermometer, Wine } from "lucide-react";

export default function ServingCard({
  servering,
  variant = "card",
  titleClassName,
}: {
  servering?: string;
  variant?: "card" | "embedded";
  titleClassName?: string;
}) {
  if (!servering || servering === "–") return null;

  const tempMatch = servering.match(/(\d{1,2})\s*[-–°]\s*(\d{1,2})?/);
  const hasTemp = tempMatch !== null;
  const isEmbedded = variant === "embedded";

  return (
    <section
      className={
        isEmbedded
          ? "space-y-3"
          : "rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10"
      }
    >
      <div
        className={
          isEmbedded
            ? "flex items-center gap-2 border-b border-theme-card/60 pb-3"
            : "mb-2 flex items-center gap-2"
        }
      >
        {hasTemp ? (
          <Thermometer className="h-4 w-4 text-primary" />
        ) : (
          <Wine className="h-4 w-4 text-primary" />
        )}
        <h3
          className={
            titleClassName ??
            (isEmbedded ? "text-xs font-semibold uppercase tracking-wide text-theme-primary" : "text-sm font-semibold text-white")
          }
        >
          Servering
        </h3>
      </div>
      <p className="text-sm text-white/70">{servering}</p>
    </section>
  );
}
