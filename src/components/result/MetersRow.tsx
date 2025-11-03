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
  contextLabel?: string;
  children?: React.ReactNode;
}

export default function MetersRow({ meters, estimated, contextLabel, children }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Smakprofil</h3>
        <div className="flex items-center gap-2">
          {contextLabel && (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
              {contextLabel}
            </span>
          )}
          {estimated && (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
              Uppskattning
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <Ring label="Sötma" value={meters?.sötma ?? null} estimated={estimated} />
        <Ring label="Fyllighet" value={meters?.fyllighet ?? null} estimated={estimated} />
        <Ring label="Fruktighet" value={meters?.fruktighet ?? null} estimated={estimated} />
        <Ring label="Fruktsyra" value={meters?.fruktsyra ?? null} estimated={estimated} />
      </div>
      {children ? <div className="mt-4 space-y-3 text-sm text-slate-300">{children}</div> : null}
    </section>
  );
}

