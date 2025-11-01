import React from "react";
import { Ring } from "./Ring";

interface Props {
  meters?: {
    sötma?: number | null;
    fyllighet?: number | null;
    fruktighet?: number | null;
    fruktsyra?: number | null;
  };
}

export default function MetersRow({ meters }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <Ring label="Sötma" value={meters?.sötma ?? null} />
        <Ring label="Fyllighet" value={meters?.fyllighet ?? null} />
        <Ring label="Fruktighet" value={meters?.fruktighet ?? null} />
        <Ring label="Fruktsyra" value={meters?.fruktsyra ?? null} />
      </div>
    </section>
  );
}

