import React from "react";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { Sparkles, Palette, LineChart, MapPin } from "lucide-react";

const INFO_COPY = {
  färgtyp: "Systembolagets färg anger vilken huvudkategori vinet tillhör.",
  typ: "Smaktypen samlar vinets stil enligt Systembolagets egen klassificering.",
  klassificering: "Ursprungsangivelsen visar officiell beteckning eller kategori.",
};

const LABELS = {
  färgtyp: "Färg",
  typ: "Smaktyp",
  klassificering: "Ursprungsangivelse",
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
    <section className="mt-6 rounded-3xl border border-white/10 bg-black/35 p-6 text-slate-200/90 sm:p-7">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-purple-200/80">
          <Sparkles className="h-4 w-4" />
          Systembolagets klassificering
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          Bas för smakprofil och rekommendationer.
        </div>
      </header>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.key}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-purple-200/70">
              <span className="text-purple-100">{ICONS[item.key]}</span>
              {LABELS[item.key]}
            </div>
            <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
            <p className="mt-2 text-xs text-slate-400">{INFO_COPY[item.key]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
