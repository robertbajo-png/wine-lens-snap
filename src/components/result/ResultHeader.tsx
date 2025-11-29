import React from "react";
import { Wine, MapPin, Building2 } from "lucide-react";

interface Props {
  vin?: string;
  ar?: string;
  producent?: string;
  land_region?: string;
  typ?: string;
}

export default function ResultHeader({ vin, ar, producent, land_region, typ }: Props) {
  const hasVin = vin && vin !== "–";
  const hasYear = ar && ar !== "–";
  const hasProducent = producent && producent !== "–";
  const hasRegion = land_region && land_region !== "–";
  const hasTyp = typ && typ !== "–";

  return (
    <header className="space-y-4 animate-fade-in">
      {/* Wine name with gradient */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
          <span className="bg-gradient-to-r from-theme-primary via-accent-primary to-theme-primary bg-clip-text text-transparent">
            {hasVin ? vin : "Okänt vin"}
          </span>
          {hasYear && (
            <span className="ml-2 text-xl font-normal text-theme-secondary sm:text-2xl">
              {ar}
            </span>
          )}
        </h1>
      </div>

      {/* Metadata row */}
      {(hasProducent || hasRegion) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-theme-secondary">
          {hasProducent && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-accent-primary" />
              <span>{producent}</span>
            </div>
          )}
          {hasProducent && hasRegion && (
            <span className="h-1 w-1 rounded-full bg-theme-secondary/40" />
          )}
          {hasRegion && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-accent-primary" />
              <span>{land_region}</span>
            </div>
          )}
        </div>
      )}

      {/* Wine type badge */}
      {hasTyp && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-primary">
            <Wine className="h-3.5 w-3.5" />
            {typ}
          </span>
        </div>
      )}
    </header>
  );
}
