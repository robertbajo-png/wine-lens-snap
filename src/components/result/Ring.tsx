import React from "react";

interface RingProps {
  label: string;
  value?: number | null;
  estimated?: boolean;
  delay?: number;
}

export function Ring({ label, value, estimated, delay = 0 }: RingProps) {
  const v = typeof value === "number" ? Math.max(0, Math.min(5, value)) : null;
  const pct = v === null ? 0 : (v / 5) * 100;
  
  const accentColor = estimated 
    ? "hsl(var(--accent-primary) / 0.6)" 
    : "hsl(var(--accent-primary))";
  const trackColor = "hsl(var(--theme-card) / 0.5)";
  const glowColor = estimated
    ? "hsl(var(--accent-glow) / 0.2)"
    : "hsl(var(--accent-glow) / 0.35)";

  const backgroundImage =
    v === null
      ? `conic-gradient(${trackColor} 0deg, ${trackColor} 360deg)`
      : `conic-gradient(${accentColor} ${pct * 3.6}deg, ${trackColor} ${pct * 3.6}deg)`;

  return (
    <div 
      className="flex flex-col items-center gap-3 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="relative h-20 w-20 rounded-full transition-all duration-500"
        style={{ 
          backgroundImage,
          boxShadow: v !== null ? `0 0 24px ${glowColor}` : 'none',
        }}
        aria-label={`${label} ${v ?? "–"} av 5`}
        title={`${label}: ${v ?? "–"} / 5`}
      >
        {/* Inner circle */}
        <div className="absolute inset-[5px] rounded-full bg-theme-elevated backdrop-blur-sm" />
        
        {/* Value display */}
        <div className="absolute inset-0 grid place-items-center">
          {v === null ? (
            <span className="text-lg font-medium text-theme-secondary">–</span>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-bold ${estimated ? "opacity-80" : ""}`} style={{ color: accentColor }}>
                {estimated && <span className="text-sm">≈</span>}
                {v}
              </span>
              <span className="text-[10px] text-theme-secondary opacity-60">av 5</span>
            </div>
          )}
        </div>
      </div>
      
      <span className="text-xs font-medium uppercase tracking-wider text-theme-secondary">
        {label}
      </span>
    </div>
  );
}

