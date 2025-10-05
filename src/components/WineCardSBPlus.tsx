import React from "react";
import { WineMetersSB } from "./WineMetersSB";


type WineSB = {
  vin: string;
  land_region: string;
  producent: string;
  druvor: string;
  karaktär: string;
  smak: string;
  passar_till: string[];
  servering: string;
  årgång: string;
  alkoholhalt: string;
  volym: string;
  sockerhalt: string;
  syra: string;
  källa?: string;
};

export default function WineCardSBPlus({
  data,
  metrics
}: {
  data: WineSB;
  metrics: {
    sötma: number;       // 0..5
    fyllighet: number;   // 0..5
    fruktighet: number;  // 0..5
    fruktsyra: number;   // 0..5
  };
}) {
  const Row = ({ label, value }: { label: string; value?: string }) => (
    <div className="grid grid-cols-12 gap-3 py-2">
      <div className="col-span-5 md:col-span-3 text-gray-500">{label}</div>
      <div className="col-span-7 md:col-span-9 font-medium">
        {value && value.trim() !== "" ? value : "–"}
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl shadow-sm ring-1 ring-gray-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="bg-purple-700 text-white px-5 py-4">
          <h1 className="text-xl font-semibold">{data.vin || "–"}</h1>
          <div className="opacity-90">
            {data.land_region || "–"}
            {data.årgång && data.årgång !== "–" ? ` • Årgång ${data.årgång}` : ""}
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <Row label="Producent" value={data.producent} />
          <Row label="Druvor" value={data.druvor} />
          <Row label="Karaktär" value={data.karaktär} />
          <Row label="Smak" value={data.smak} />
          <Row label="Passar till" value={(data.passar_till || []).join(", ")} />
          <Row label="Servering" value={data.servering} />

          <div className="h-px bg-gray-200 my-3" />

          {/* Mätare – som Systembolaget */}
          <WineMetersSB meters={metrics} />

          <div className="h-px bg-gray-200 my-3" />


          <Row label="Alkoholhalt" value={data.alkoholhalt} />
          <Row label="Volym" value={data.volym} />
          <Row label="Sockerhalt" value={data.sockerhalt} />
          <Row label="Syra" value={data.syra} />

          <p className="text-sm text-gray-400 mt-2">
            Källa: {data.källa || "–"}
          </p>
        </div>
      </div>
    </div>
  );
}
