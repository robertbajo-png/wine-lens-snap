import React from "react";

/** SB-lik ring: bakgrundscirkel + fylld båge. Värde 0–5 (0..1 = 0–5/5). */
export function GaugeCircleSB({
  label,
  value,
  size = 56,
  stroke = 6,
}: {
  label: string;
  value: number; // 0..5 (halva steg ok)
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(5, value)) / 5; // 0..1
  const dash = c * pct;
  const gap = c - dash;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} aria-label={`${label} ${value}/5`}>
        {/* Bakgrundsring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="currentColor"
          className="text-gray-300"
          fill="none"
        />
        {/* Fylld båge (start uppåt som SB) */}
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            stroke="currentColor"
            className="text-gray-900"
            fill="none"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
          />
        </g>
      </svg>
      <div className="text-[10px] tracking-wide mt-1 text-gray-500">
        {label.toUpperCase()}
      </div>
    </div>
  );
}

/** Rad med fyra mätare i SB-stil */
export function WineMetersSB({
  meters,
}: {
  meters: { sötma?: number | null; fyllighet?: number | null; fruktighet?: number | null; fruktsyra?: number | null };
}) {
  // visa 0 som tom ring om värde saknas (null/undefined) -> lämna null => grå bakgrundsbåge only
  const safe = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

  return (
    <div className="grid grid-cols-4 gap-4 py-2">
      <GaugeCircleSB label="Sötma" value={safe(meters?.sötma)} />
      <GaugeCircleSB label="Fyllighet" value={safe(meters?.fyllighet)} />
      <GaugeCircleSB label="Fruktighet" value={safe(meters?.fruktighet)} />
      <GaugeCircleSB label="Fruktsyra" value={safe(meters?.fruktsyra)} />
    </div>
  );
}
