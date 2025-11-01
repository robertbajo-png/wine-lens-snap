import React from "react";

interface Props {
  vin?: string;
  ar?: string;
  producent?: string;
  land_region?: string;
  typ?: string;
}

export default function ResultHeader({ vin, ar, producent, land_region, typ }: Props) {
  const subtitleParts = [
    producent && producent !== "–" ? producent : null,
    land_region && land_region !== "–" ? land_region : null,
  ].filter(Boolean) as string[];

  return (
    <header className="space-y-2">
      <h1 className="text-2xl sm:text-3xl font-semibold leading-snug text-white line-clamp-2">
        {vin && vin !== "–" ? vin : "Okänt vin"}
        {ar && ar !== "–" ? ` ${ar}` : ""}
      </h1>
      {subtitleParts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-slate-200/80">
          {subtitleParts.map((part, index) => (
            <React.Fragment key={`${part}-${index}`}>
              {index > 0 && <span className="opacity-40">•</span>}
              <span className="truncate">{part}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      {typ && typ !== "–" && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200 uppercase tracking-wide">
            {typ}
          </span>
        </div>
      )}
    </header>
  );
}

