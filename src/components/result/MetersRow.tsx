import React from "react";
import { Ring } from "./Ring";

interface Props {
  meters?: {
    sötma?: number | null;
    fyllighet?: number | null;
    fruktighet?: number | null;
    fruktsyra?: number | null;
  };
  estimated?: boolean;
}

export default function MetersRow({ meters, estimated }: Props) {
  return (
    <section className="rounded-2xl border border-theme-card bg-theme-elevated p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-theme-primary">Smakprofil</h3>
        {estimated && (
          <span className="rounded-full border border-theme-card bg-theme-elevated px-2 py-0.5 text-[10px] uppercase tracking-wide text-theme-secondary">
            Uppskattning
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <Ring label="Sötma" value={meters?.sötma ?? null} estimated={estimated} />
        <Ring label="Fyllighet" value={meters?.fyllighet ?? null} estimated={estimated} />
        <Ring label="Fruktighet" value={meters?.fruktighet ?? null} estimated={estimated} />
        <Ring label="Fruktsyra" value={meters?.fruktsyra ?? null} estimated={estimated} />
      </div>
    </section>
  );
}

