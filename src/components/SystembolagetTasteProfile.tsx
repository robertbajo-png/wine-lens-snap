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

function buildMeters(result: WineAnalysisResult): {
  headline: string;
  subline: string;
  meters: { label: string; value: number | null }[];
} {
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
  const profile = buildMeters(result);
  const allNull = profile.meters.every((meter) => meter.value === null);

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/80">
            Systembolagets smakprofil
          </p>
          <h2 className="text-lg font-semibold text-white">{profile.headline}</h2>
          <p className="text-sm text-slate-200/80">{profile.subline}</p>
          <p className="text-xs text-slate-400">
            Skala 0–5 enligt Systembolagets egna smakmätare.
          </p>
          {allNull && (
            <p className="text-xs text-slate-400">
              Systembolaget har inte publicerat värden för den här flaskan ännu. Komplettera gärna manuellt i historiken.
            </p>
          )}
        </div>
        <div className="grid w-full max-w-md grid-cols-3 gap-4">
          {profile.meters.map((meter) => (
            <div key={meter.label} className="flex flex-col items-center gap-2 text-slate-100">
              <GaugeCircleSB label={meter.label} value={meter.value ?? null} size={72} stroke={7} showValue />
              <span className="text-xs text-slate-300">
                {typeof meter.value === "number" ? `${meter.value.toFixed(1)}/5` : "–"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
