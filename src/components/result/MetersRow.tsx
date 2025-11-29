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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="mb-5 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">Smakprofil</h3>
        {estimated && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
            Uppskattning
          </span>
        )}
      </div>
      <div className="flex items-start justify-between px-2">
        <Ring label="Sötma" value={meters?.sötma ?? null} estimated={estimated} delay={0} />
        <Ring label="Fyllighet" value={meters?.fyllighet ?? null} estimated={estimated} delay={100} />
        <Ring label="Fruktighet" value={meters?.fruktighet ?? null} estimated={estimated} delay={200} />
        <Ring label="Fruktsyra" value={meters?.fruktsyra ?? null} estimated={estimated} delay={300} />
      </div>
    </section>
  );
}