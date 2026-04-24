import React from "react";

type Step = "prep" | "ocr" | "analysis" | "done" | "error" | null;

interface ProgressBannerProps {
  step: Step;
  note?: string | null;
  progress?: number | null;
  label?: string | null;
}

const STEP_ORDER: Exclude<Step, null | "done" | "error">[] = ["prep", "ocr", "analysis"];

const STEP_LABELS: Record<Exclude<Step, null>, string> = {
  prep: "Förbereder bilden…",
  ocr: "Läser etiketten med OCR…",
  analysis: "AI analyserar vinet (kan ta upp till 90 sek)…",
  done: "Klart",
  error: "Något gick fel",
};

export const ProgressBanner: React.FC<ProgressBannerProps> = ({ step, note, progress, label }) => {
  const pct =
    typeof progress === "number"
      ? clampProgress(progress)
      : step === "prep"
      ? 20
      : step === "ocr"
      ? 55
      : step === "analysis"
      ? 90
      : step === "done" || step === "error"
      ? 100
      : 0;

  const defaultLabel = step ? STEP_LABELS[step] : "Startar…";

  const isError = step === "error";
  const progressClass = isError
    ? "h-1.5 rounded bg-red-400 transition-all"
    : "h-1.5 rounded bg-theme-accent transition-all";

  // Steg-indikator (1/3, 2/3, 3/3) – visas bara under aktiva pipeline-steg
  const stepIndicator = (() => {
    if (!step || step === "done" || step === "error") return null;
    const idx = STEP_ORDER.indexOf(step as typeof STEP_ORDER[number]);
    if (idx < 0) return null;
    return `Steg ${idx + 1} av ${STEP_ORDER.length}`;
  })();

  return (
    <div
      className="rounded-xl border border-theme-card bg-theme-elevated p-3 text-sm text-theme-primary"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {stepIndicator && (
            <span className="shrink-0 rounded-full bg-theme-accent/15 px-2 py-0.5 text-[11px] font-medium text-theme-accent">
              {stepIndicator}
            </span>
          )}
          <span className="opacity-90 truncate">{label ?? defaultLabel}</span>
        </div>
        <span className="opacity-70 shrink-0 tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-theme-elevated">
        <div
          className={progressClass}
          style={{ width: `${pct}%` }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        />
      </div>
      {note && (
        <div className={`mt-2 text-xs ${isError ? "text-red-400" : "text-theme-secondary"}`}>
          {note}
        </div>
      )}
    </div>
  );
};

function clampProgress(value: number) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}
