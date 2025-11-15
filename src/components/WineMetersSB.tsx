import React from "react";

/** SB-lik ring: bakgrundscirkel + fylld båge. Värde 0–5 (0..1 = 0–5/5). */
export function GaugeCircleSB({
  label,
  value,
  size = 56,
  stroke = 6,
  showValue = false,
}: {
  label: string;
  value?: number | null; // 0..5 (halvsteg ok); null = okänt
  size?: number;
  stroke?: number;
  showValue?: boolean;
}) {
  const val = typeof value === "number" ? Math.max(0, Math.min(5, value)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (val / 5);
  const gap = c - dash;
  const valueLabel = typeof value === "number" ? value.toFixed(1) : "–";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} aria-label={`${label} ${val}/5`}>
        <circle cx={size/2} cy={size/2} r={r} strokeWidth={stroke} stroke="currentColor" className="text-theme-secondary" fill="none" />
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          {typeof value === "number" && (
            <circle cx={size/2} cy={size/2} r={r} strokeWidth={stroke} stroke="currentColor"
              className="text-theme-primary" fill="none" strokeDasharray={`${dash} ${gap}`} />
          )}
        </g>
        {showValue && (
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            className="fill-current text-[11px] font-semibold"
          >
            {valueLabel}
          </text>
        )}
      </svg>
      <div className="mt-1 text-[10px] tracking-wide text-theme-secondary">{label.toUpperCase()}</div>
    </div>
  );
}

export function WineMetersSB({
  meters
}: {
  meters?: { sötma?: number|null; fyllighet?: number|null; fruktighet?: number|null; fruktsyra?: number|null };
}) {
  return (
    <div className="grid grid-cols-4 gap-4 py-2">
      <GaugeCircleSB label="Sötma" value={meters?.sötma ?? null} />
      <GaugeCircleSB label="Fyllighet" value={meters?.fyllighet ?? null} />
      <GaugeCircleSB label="Fruktighet" value={meters?.fruktighet ?? null} />
      <GaugeCircleSB label="Fruktsyra" value={meters?.fruktsyra ?? null} />
    </div>
  );
}
