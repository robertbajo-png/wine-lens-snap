import React from "react";

export default function ServingCard({ servering }: { servering?: string }) {
  if (!servering || servering === "–") return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">Servering</h3>
      <p className="mt-2 text-sm text-slate-200">{servering}</p>
    </section>
  );
}

