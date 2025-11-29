import React from "react";

interface RingProps {
  label: string;
  value?: number | null;
  estimated?: boolean;
}

export function Ring({ label, value, estimated }: RingProps) {
  const v = typeof value === "number" ? Math.max(0, Math.min(5, value)) : null;
  const pct = v === null ? 0 : (v / 5) * 100;
  
  // Use primary color for the ring
  const accent = estimated ? "hsl(var(--primary) / 0.7)" : "hsl(var(--primary))";
  const track = "hsl(var(--muted) / 0.3)";
  const backgroundImage =
    v === null
      ? `conic-gradient(${track} 0deg, ${track} 360deg)`
      : `conic-gradient(${accent} ${pct * 3.6}deg, ${track} ${pct * 3.6}deg)`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative h-16 w-16 rounded-full shadow-lg"
        style={{ 
          backgroundImage,
          boxShadow: v !== null ? '0 0 20px hsl(var(--primary) / 0.3)' : undefined
        }}
        aria-label={`${label} ${v ?? "–"} av 5`}
        title={`${label}: ${v ?? "–"} / 5`}
      >
        {/* Inner circle */}
        <div className="absolute inset-[5px] rounded-full bg-background/90 backdrop-blur-sm shadow-inner" />
        
        {/* Value display */}
        <div className="absolute inset-0 grid place-items-center">
          {v === null ? (
            <span className="text-sm font-medium text-muted-foreground">–</span>
          ) : (
            <span className={`text-base font-bold ${estimated ? "text-white/80" : "text-white"}`}>
              {estimated && <span className="text-xs">≈</span>}
              {v}
            </span>
          )}
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">{label}</span>
    </div>
  );
}
