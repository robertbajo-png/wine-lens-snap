import React from "react";

interface Props {
  druvor?: string;
  fargtyp?: string;
  klassificering?: string;
  alkoholhalt?: string;
  volym?: string;
  sockerhalt?: string;
  syra?: string;
}

const Row = ({ label, value }: { label: string; value?: string }) => {
  if (!value || value === "–") return null;
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-theme-card bg-theme-elevated p-3">
      <span className="text-xs uppercase tracking-wide text-theme-secondary opacity-80">{label}</span>
      <span className="text-sm text-right text-theme-primary">{value}</span>
    </div>
  );
};

export default function KeyFacts({ druvor, fargtyp, klassificering, alkoholhalt, volym, sockerhalt, syra }: Props) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <Row label="Druvor" value={druvor} />
      <Row label="Färg/typ" value={fargtyp} />
      <Row label="Klassificering" value={klassificering} />
      <Row label="Alkohol" value={alkoholhalt} />
      <Row label="Volym" value={volym} />
      <Row label="Sockerhalt" value={sockerhalt} />
      <Row label="Syra" value={syra} />
    </section>
  );
}

