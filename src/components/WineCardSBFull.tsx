import React from "react";
import { WineMetersSB } from "./WineMetersSB";

type WineData = {
  vin?: string; 
  land_region?: string; 
  producent?: string; 
  druvor?: string;
  årgång?: string; 
  typ?: string; 
  färgtyp?: string; 
  klassificering?: string;
  alkoholhalt?: string; 
  volym?: string; 
  sockerhalt?: string; 
  syra?: string;
  karaktär?: string; 
  smak?: string; 
  passar_till?: string[]; 
  servering?: string;
  källa?: string; 
  meters?: { 
    sötma?: number|null; 
    fyllighet?: number|null; 
    fruktighet?: number|null; 
    fruktsyra?: number|null 
  };
  evidence?: { 
    etiketttext?: string; 
    webbträffar?: string[] 
  };
};

const Row = ({ label, value }: { label: string; value?: string }) => (
  <div className="grid grid-cols-12 gap-3 py-2">
    <div className="col-span-5 text-theme-secondary md:col-span-3">{label}</div>
    <div className="col-span-7 font-medium text-theme-primary md:col-span-9">{value && value.trim() !== "" ? value : "–"}</div>
  </div>
);

const joinArr = (arr?: string[]) => (Array.isArray(arr) && arr.length ? arr.join(", ") : "–");

export default function WineCardSBFull({ data }: { data: WineData }) {
  const title = data?.vin || "–";
  const subtitleParts = [
    data?.land_region || "",
    data?.årgång ? `Årgång ${data.årgång}` : ""
  ].filter(Boolean);
  
  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-3xl border border-theme-card bg-theme-elevated shadow-theme-elevated">
        {/* Header */}
        <div className="bg-theme-accent px-5 py-4 text-theme-primary">
          <h1 className="text-xl font-semibold text-theme-primary">{title}</h1>
          <div className="opacity-90">{subtitleParts.join(" • ") || " "}</div>
        </div>

        {/* Body */}
        <div className="p-5 text-theme-secondary">
          <Row label="Producent" value={data?.producent} />
          <Row label="Druvor" value={data?.druvor} />
          <Row label="Karaktär" value={data?.karaktär} />
          <Row label="Smak" value={data?.smak} />
          <Row label="Passar till" value={joinArr(data?.passar_till)} />
          <Row label="Servering" value={data?.servering} />

          <div className="my-3 h-px bg-[hsl(var(--card-border)/0.45)]" />

          <WineMetersSB meters={data?.meters} />

          <div className="my-3 h-px bg-[hsl(var(--card-border)/0.45)]" />

          <Row label="Typ" value={data?.typ} />
          <Row label="Färg" value={data?.färgtyp} />
          <Row label="Klassificering" value={data?.klassificering} />
          <Row label="Alkoholhalt" value={data?.alkoholhalt} />
          <Row label="Volym" value={data?.volym} />
          <Row label="Sockerhalt" value={data?.sockerhalt} />
          <Row label="Syra" value={data?.syra} />

          {/* Diskret källa */}
          <p className="mt-2 text-sm text-theme-secondary">Källa: {data?.källa || "–"}</p>

          {/* Valfri debug/transparens */}
          {data?.evidence?.etiketttext && (
            <p className="mt-1 text-[11px] text-theme-secondary">
              OCR: {String(data.evidence.etiketttext).slice(0, 200)}
              {data?.evidence?.webbträffar?.length ? ` • Webbkällor: ${data.evidence.webbträffar.join(", ")}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
