import React from "react";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { GaugeCircleSB } from "./WineMetersSB";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function deriveStravhet(result: WineAnalysisResult): number | null {
  const färg = result.färgtyp?.toLowerCase() ?? "";
  if (!färg.includes("rött")) {
    return null;
  }

  const textSources = [
    result.karaktär,
    result.smak,
    result.druvor,
    result.passar_till?.join(" "),
    result.servering,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 2.5;

  if (/mjuka tanniner|silkeslen|len|mjuk/i.test(textSources)) {
    score -= 0.8;
  }

  if (
    /tanniner|tanninrik|stramt|sträv|kraftfull|ekfat|fatlagrat|cabernet|nebbiolo|barolo|syrah|tempranillo|malbec/i.test(
      textSources
    )
  ) {
    score += 0.9;
  }

  if (/pinot noir|gamay|dolcetto|blaufränkisch|zweigelt|spätburgunder/i.test(textSources)) {
    score -= 0.5;
  }

  const alkoholMatch = result.alkoholhalt?.match(/([0-9]+(?:,[0-9]+)?)/);
  if (alkoholMatch) {
    const abv = parseFloat(alkoholMatch[1].replace(",", "."));
    if (!Number.isNaN(abv)) {
      if (abv >= 14.5) {
        score += 0.5;
      } else if (abv <= 12) {
        score -= 0.3;
      }
    }
  }

  return clamp(Math.round(score * 10) / 10, 0, 5);
}

function toFixedStep(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }
  return Math.round(value * 10) / 10;
}

export type SystembolagetTasteMeters = {
  headline: string;
  subline: string;
  meters: { label: string; value: number | null }[];
};

export function getSystembolagetTasteProfile(result: WineAnalysisResult): SystembolagetTasteMeters {
  const färg = result.färgtyp?.toLowerCase() ?? "";

  if (färg.includes("rött")) {
    return {
      headline: "Rött vin",
      subline: "Systembolaget visar fyllighet, strävhet och fruktsyra för röda viner.",
      meters: [
        { label: "Fyllighet", value: toFixedStep(result.meters?.fyllighet ?? null) },
        { label: "Strävhet", value: deriveStravhet(result) },
        { label: "Fruktsyra", value: toFixedStep(result.meters?.fruktsyra ?? null) },
      ],
    };
  }

  if (färg.includes("rosé")) {
    return {
      headline: "Rosévin",
      subline: "För rosé anger Systembolaget sötma, fyllighet och fruktsyra.",
      meters: [
        { label: "Sötma", value: toFixedStep(result.meters?.sötma ?? null) },
        { label: "Fyllighet", value: toFixedStep(result.meters?.fyllighet ?? null) },
        { label: "Fruktsyra", value: toFixedStep(result.meters?.fruktsyra ?? null) },
      ],
    };
  }

  if (färg.includes("mousserande") || färg.includes("champagne") || färg.includes("cava")) {
    return {
      headline: "Mousserande vin",
      subline: "Här följer Systembolaget samma skala: sötma, fyllighet och fruktsyra.",
      meters: [
        { label: "Sötma", value: toFixedStep(result.meters?.sötma ?? null) },
        { label: "Fyllighet", value: toFixedStep(result.meters?.fyllighet ?? null) },
        { label: "Fruktsyra", value: toFixedStep(result.meters?.fruktsyra ?? null) },
      ],
    };
  }

  if (färg.includes("dessert") || färg.includes("sött") || färg.includes("port") || färg.includes("sherry")) {
    return {
      headline: "Söta & starkviner",
      subline: "Skalan fokuserar på sötma, fyllighet och fruktsyra även för dessert- och starkviner.",
      meters: [
        { label: "Sötma", value: toFixedStep(result.meters?.sötma ?? null) },
        { label: "Fyllighet", value: toFixedStep(result.meters?.fyllighet ?? null) },
        { label: "Fruktsyra", value: toFixedStep(result.meters?.fruktsyra ?? null) },
      ],
    };
  }

  return {
    headline: "Vitt vin",
    subline: "För vita viner visar Systembolaget sötma, fyllighet och fruktsyra.",
    meters: [
      { label: "Sötma", value: toFixedStep(result.meters?.sötma ?? null) },
      { label: "Fyllighet", value: toFixedStep(result.meters?.fyllighet ?? null) },
      { label: "Fruktsyra", value: toFixedStep(result.meters?.fruktsyra ?? null) },
    ],
  };
}

export function SystembolagetTasteProfile({ result }: { result: WineAnalysisResult }) {
  const profile = getSystembolagetTasteProfile(result);
  const allNull = profile.meters.every((meter) => meter.value === null);

  return (
    <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-6 text-slate-800 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
            Systembolagets smakprofil
          </p>
          <h2 className="text-lg font-semibold text-emerald-900">{profile.headline}</h2>
          <p className="text-sm text-emerald-700">{profile.subline}</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
          Skala 0–5
        </span>
      </header>

      {allNull ? (
        <p className="mt-4 text-sm text-emerald-700">
          Systembolaget har inte publicerat några smakvärden för den här flaskan ännu.
        </p>
      ) : (
        <p className="mt-4 text-xs text-emerald-600">
          Värdena nedan kommer direkt från Systembolagets mätare.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {profile.meters.map((meter) => (
          <div
            key={meter.label}
            className="flex flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-4 text-slate-800 shadow-sm shadow-emerald-100/40"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
              {meter.label}
            </p>
            <GaugeCircleSB label={meter.label} value={meter.value ?? null} size={70} stroke={7} showValue />
            <span className="text-xs font-medium text-emerald-700">
              {typeof meter.value === "number" ? `${meter.value.toFixed(1)} / 5` : "Ingen data"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
