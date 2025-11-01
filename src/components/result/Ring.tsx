import React from "react";

interface RingProps {
  label: string;
  value?: number | null;
}

export function Ring({ label, value }: RingProps) {
  const normalized = typeof value === "number" && !Number.isNaN(value)
    ? Math.max(0, Math.min(5, value))
    : null;
  const pct = normalized === null ? 0 : (normalized / 5) * 100;
  const degrees = pct * 3.6;
  const backgroundImage = normalized === null
    ? "conic-gradient(rgba(255,255,255,0.12) 0deg, rgba(255,255,255,0.12) 360deg)"
    : `conic-gradient(currentColor ${degrees}deg, rgba(255,255,255,0.12) ${degrees}deg)`;

  return (
    <div className="flex flex-col items-center gap-2 text-slate-200">
      <div
        className="relative h-14 w-14 rounded-full"
        style={{ backgroundImage, color: "rgb(167 139 250)" }}
        aria-label={`${label} ${normalized ?? "–"} av 5`}
        title={`${label}: ${normalized ?? "–"} / 5`}
      >
        <div className="absolute inset-[4px] rounded-full bg-black/40 backdrop-blur" />
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold">
          {normalized ?? "–"}
        </div>
      </div>
      <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

