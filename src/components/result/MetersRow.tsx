import React from "react";
import { Ring } from "./Ring";
import { Sparkles } from "lucide-react";

interface Props {
  meters?: {
    sötma?: number | null;
    fyllighet?: number | null;
    fruktighet?: number | null;
    fruktsyra?: number | null;
  };
  estimated?: boolean;
}

const meterLabels = [
  { key: "sötma", label: "Sötma" },
  { key: "fyllighet", label: "Fyllighet" },
  { key: "fruktighet", label: "Fruktighet" },
  { key: "fruktsyra", label: "Fruktsyra" },
] as const;

export default function MetersRow({ meters, estimated }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-2 sm:justify-between">
      {meterLabels.map((item, index) => (
        <Ring
          key={item.key}
          label={item.label}
          value={meters?.[item.key] ?? null}
          estimated={estimated}
          delay={index * 100}
        />
      ))}
    </div>
  );
}
