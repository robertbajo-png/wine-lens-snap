import React from "react";

interface RingProps {
  label: string;
  value?: number | null;
  estimated?: boolean;
}

export function Ring({ label, value, estimated }: RingProps) {
  const v = typeof value === "number" ? Math.max(0, Math.min(5, value)) : null;
  const pct = v === null ? 0 : (v / 5) * 100;
  const accent = estimated ? "rgba(167,139,250,0.6)" : "rgb(167 139 250)";
  const track = "rgba(255,255,255,0.12)";
  const backgroundImage =
    v === null
      ? `conic-gradient(${track} 0deg, ${track} 360deg)`
      : `conic-gradient(${accent} ${pct * 3.6}deg, ${track} ${pct * 3.6}deg)`;

  return (
    <div className="flex flex-col items-center gap-2 text-slate-200">
      <div
        className="relative h-14 w-14 rounded-full"
        style={{ backgroundImage }}
        aria-label={`${label} ${v ?? "–"} av 5`}
        title={`${label}: ${v ?? "–"} / 5`}
      >
        <div className="absolute inset-[4px] rounded-full bg-black/40 backdrop-blur" />
        <div className="absolute inset-0 grid place-items-center text-sm font-semibold">
          {v === null ? (
            "–"
          ) : (
            <span className={estimated ? "opacity-80" : ""}>
              {estimated ? "≈" : ""}
              {v}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

