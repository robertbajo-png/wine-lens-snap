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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-slate-800 shadow-sm">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </header>

      <dl className={`mt-4 text-sm text-slate-700 ${layoutClass}`}>
        {items.map((fact) => (
          <div key={fact.label} className="flex items-start justify-between gap-3">
            <dt className="text-slate-500">{fact.label}</dt>
            <dd className="text-right font-semibold text-slate-900">{fact.value || "–"}</dd>
          </div>
        ))}
      </dl>

      {footnote && <p className="mt-4 text-xs text-slate-500">{footnote}</p>}
      {children}
    </section>
  );
}
