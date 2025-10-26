import React from "react";

export type FactItem = {
  label: string;
  value: string;
};

export function SystembolagetFactList({
  title,
  subtitle,
  items,
  footnote,
  children,
  columns = 1,
}: {
  title: string;
  subtitle?: string;
  items: FactItem[];
  footnote?: string;
  children?: React.ReactNode;
  columns?: 1 | 2;
}) {
  if (!items.length) {
    return null;
  }

  const layoutClass =
    columns === 2
      ? "grid gap-x-6 gap-y-3 sm:grid-cols-2"
      : "space-y-3";

  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-purple-200/80">{title}</p>
        {subtitle && <p className="text-xs text-slate-300">{subtitle}</p>}
      </header>

      <dl className={`mt-4 text-sm text-slate-200/85 ${layoutClass}`}>
        {items.map((fact) => (
          <div key={fact.label} className="flex items-start justify-between gap-3">
            <dt className="text-slate-300">{fact.label}</dt>
            <dd className="text-right font-semibold text-white">{fact.value || "–"}</dd>
          </div>
        ))}
      </dl>

      {footnote && <p className="mt-4 text-xs text-slate-400">{footnote}</p>}
      {children}
    </section>
  );
}
