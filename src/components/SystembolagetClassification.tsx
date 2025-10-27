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
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 text-slate-800 shadow-sm">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          Systembolagets klassificering
        </div>
        <p className="text-xs text-slate-500">Grunden för smakprofilen och serveringsrekommendationerna.</p>
      </header>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
          >
            <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              <span className="text-slate-700">{ICONS[item.key]}</span>
              {LABELS[item.key]}
            </dt>
            <dd className="mt-2 space-y-1">
              <p className="text-base font-semibold text-slate-900">{item.value}</p>
              <span className="block text-xs text-slate-500">{DESCRIPTIONS[item.key]}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
