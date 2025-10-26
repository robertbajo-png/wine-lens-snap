import React from "react";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { Sparkles, Palette, LineChart, MapPin } from "lucide-react";

const LABELS = {
  färgtyp: "Färg",
  typ: "Smaktyp",
  klassificering: "Ursprungsangivelse",
};

const DESCRIPTIONS = {
  färgtyp: "Huvudkategori i Systembolagets sortiment.",
  typ: "Systembolagets egna smaktyp för vinstilen.",
  klassificering: "Officiell ursprungsangivelse enligt etiketten.",
};

type ClassificationKey = keyof typeof LABELS;

const ORDER: ClassificationKey[] = ["färgtyp", "typ", "klassificering"];

const ICONS: Record<ClassificationKey, React.ReactNode> = {
  färgtyp: <Palette className="h-4 w-4" />,
  typ: <LineChart className="h-4 w-4" />,
  klassificering: <MapPin className="h-4 w-4" />,
};

export function SystembolagetClassification({ result }: { result: WineAnalysisResult }) {
  const items = ORDER.map((key) => ({
    key,
    value: (result[key] as string | undefined)?.trim() || "–",
  }));

  const hasRealValue = items.some((item) => item.value !== "–");

  if (!hasRealValue) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-black/30 p-6 text-slate-200/90 sm:p-7">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-purple-200/80">
          <Sparkles className="h-4 w-4" />
          Systembolagets klassificering
        </div>
        <p className="text-xs text-slate-300">Grunden för smakprofilen och serveringsrekommendationerna.</p>
      </header>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20"
          >
            <dt className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-purple-200/70">
              <span className="text-purple-100">{ICONS[item.key]}</span>
              {LABELS[item.key]}
            </dt>
            <dd className="mt-2 space-y-1">
              <p className="text-base font-semibold text-white">{item.value}</p>
              <span className="block text-xs text-slate-400">{DESCRIPTIONS[item.key]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
