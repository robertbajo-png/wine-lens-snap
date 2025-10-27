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
      ? "grid gap-4 sm:grid-cols-2"
      : "grid gap-4";

  return (
    <section className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-slate-50 p-5 text-slate-800 shadow-sm">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-purple-700">{title}</p>
        {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
      </header>

      <dl className={`mt-4 text-sm text-slate-700 ${layoutClass}`}>
        {items.map((fact) => (
          <div key={fact.label} className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm shadow-purple-100/40">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-600">{fact.label}</dt>
            <dd className="mt-2 text-base font-semibold text-slate-900">{fact.value || "–"}</dd>
          </div>
        ))}
      </dl>

      {footnote && <p className="mt-4 text-xs text-slate-500">{footnote}</p>}
      {children}
    </section>
  );
}
