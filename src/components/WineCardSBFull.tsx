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
    <div className="col-span-5 md:col-span-3 text-gray-500">{label}</div>
    <div className="col-span-7 md:col-span-9 font-medium">{value && value.trim() !== "" ? value : "–"}</div>
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
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl shadow-sm ring-1 ring-gray-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="bg-purple-700 text-white px-5 py-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="opacity-90">{subtitleParts.join(" • ") || " "}</div>
        </div>

        {/* Body */}
        <div className="p-5">
          <Row label="Producent" value={data?.producent} />
          <Row label="Druvor" value={data?.druvor} />
          <Row label="Karaktär" value={data?.karaktär} />
          <Row label="Smak" value={data?.smak} />
          <Row label="Passar till" value={joinArr(data?.passar_till)} />
          <Row label="Servering" value={data?.servering} />

          <div className="h-px bg-gray-200 my-3" />

          <WineMetersSB meters={data?.meters} />

          <div className="h-px bg-gray-200 my-3" />

          <Row label="Typ" value={data?.typ} />
          <Row label="Färg" value={data?.färgtyp} />
          <Row label="Klassificering" value={data?.klassificering} />
          <Row label="Alkoholhalt" value={data?.alkoholhalt} />
          <Row label="Volym" value={data?.volym} />
          <Row label="Sockerhalt" value={data?.sockerhalt} />
          <Row label="Syra" value={data?.syra} />

          {/* Diskret källa */}
          <p className="text-sm text-gray-400 mt-2">Källa: {data?.källa || "–"}</p>

          {/* Valfri debug/transparens */}
          {data?.evidence?.etiketttext && (
            <p className="text-[11px] text-gray-400 mt-1">
              OCR: {String(data.evidence.etiketttext).slice(0, 200)}
              {data?.evidence?.webbträffar?.length ? ` • Webbkällor: ${data.evidence.webbträffar.join(", ")}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
