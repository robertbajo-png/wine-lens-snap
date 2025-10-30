import React from "react";

type Step = "prep" | "ocr" | "analysis" | "done" | null;

export const ProgressBanner: React.FC<{ step: Step; note?: string | null }> = ({ step, note }) => {
  const pct = step === "prep" ? 20 : step === "ocr" ? 55 : step === "analysis" ? 90 : step === "done" ? 100 : 0;
  const label = step === "prep" ? "Förbereder bild"
    : step === "ocr" ? "Läser etiketten"
    : step === "analysis" ? "Bygger vinprofil"
    : step === "done" ? "Klart"
    : "Startar…";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100">
      <div className="flex items-center justify-between">
        <span className="opacity-90">{label}</span>
        <span className="opacity-70">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-white/10">
        <div
          className="h-1.5 rounded bg-white/80 transition-all"
          style={{ width: `${pct}%` }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        />
      </div>
      {note && <div className="mt-2 text-xs text-slate-300">{note}</div>}
    </div>
  );
};
