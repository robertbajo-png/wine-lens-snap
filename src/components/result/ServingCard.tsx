import React from "react";

export default function ServingCard({ servering }: { servering?: string }) {
  if (!servering || servering === "–") return null;

  return (
    <section className="rounded-2xl border border-theme-card bg-theme-elevated p-4">
      <h3 className="text-sm font-semibold text-theme-primary">Servering</h3>
      <p className="mt-2 text-sm text-theme-secondary">{servering}</p>
    </section>
  );
}

