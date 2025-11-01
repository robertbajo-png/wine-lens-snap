import React from "react";

export default function Pairings({ items }: { items?: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const chips = items.filter(Boolean).slice(0, 8);
  if (chips.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">Passar till</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

