import { useId } from "react";
import { cn } from "@/lib/utils";

export interface GaugeRingsSBProps {
  meters?: {
    sötma?: number | null;
    fyllighet?: number | null;
    fruktighet?: number | null;
    fruktsyra?: number | null;
  };
}

interface GaugeRingProps {
  label: string;
  value?: number | null;
}

const meterConfig: GaugeRingProps[] = [
  { label: "Sötma" },
  { label: "Fyllighet" },
  { label: "Fruktighet" },
  { label: "Fruktsyra" },
];

function getValueForLabel(meters: GaugeRingsSBProps["meters"], label: string) {
  if (!meters) return null;
  switch (label) {
    case "Sötma":
      return meters.sötma ?? null;
    case "Fyllighet":
      return meters.fyllighet ?? null;
    case "Fruktighet":
      return meters.fruktighet ?? null;
    case "Fruktsyra":
      return meters.fruktsyra ?? null;
    default:
      return null;
  }
}

function GaugeRing({ label, value }: GaugeRingProps) {
  const gradientIdRaw = useId();
  const gradientId = `gauge-${gradientIdRaw.replace(/:/g, "")}`;
  const normalized = typeof value === "number" ? Math.max(0, Math.min(5, value)) : null;
  const radius = 28;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const dash = normalized === null ? 0 : (normalized / 5) * circumference;
  const gap = circumference - dash;
  const displayValue = normalized === null ? "–" : normalized.toFixed(1).replace(/\.0$/, "");

  return (
    <div
      role="img"
      aria-label={`${label}: ${normalized === null ? "saknas" : normalized.toFixed(1)} av 5`}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={(radius + stroke) * 2}
          height={(radius + stroke) * 2}
          viewBox={`0 0 ${(radius + stroke) * 2} ${(radius + stroke) * 2}`}
          className="text-slate-700"
        >
          <circle
            cx={radius + stroke}
            cy={radius + stroke}
            r={radius}
            strokeWidth={stroke}
            stroke="currentColor"
            fill="none"
            className="text-slate-700/60"
          />
          {normalized !== null ? (
            <g transform={`rotate(-90 ${(radius + stroke)} ${(radius + stroke)})`}>
              <circle
                cx={radius + stroke}
                cy={radius + stroke}
                r={radius}
                strokeWidth={stroke}
                strokeLinecap="round"
                stroke={`url(#${gradientId})`}
                fill="none"
                strokeDasharray={`${dash} ${gap}`}
              />
            </g>
          ) : (
            <g transform={`rotate(-90 ${(radius + stroke)} ${(radius + stroke)})`}>
              <circle
                cx={radius + stroke}
                cy={radius + stroke}
                r={radius}
                strokeWidth={stroke}
                strokeLinecap="round"
                stroke="currentColor"
                className="text-slate-600"
                fill="none"
                strokeDasharray={`0 ${circumference}`}
              />
            </g>
          )}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
        <span
          className={cn(
            "absolute text-sm font-semibold",
            normalized === null ? "text-slate-400" : "text-white"
          )}
        >
          {displayValue}
        </span>
      </div>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">
        {label}
      </span>
    </div>
  );
}

export function GaugeRingsSB({ meters }: GaugeRingsSBProps) {
  return (
    <div role="group" aria-label="Mätare för smakprofil" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {meterConfig.map((config) => (
        <GaugeRing key={config.label} label={config.label} value={getValueForLabel(meters, config.label)} />
      ))}
    </div>
  );
}
