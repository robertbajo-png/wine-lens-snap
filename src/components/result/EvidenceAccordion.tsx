import React from "react";
import type { EvidenceItem } from "@/lib/wineCache";

interface EvidenceAccordionProps {
  ocr?: string;
  hits?: EvidenceItem[];
  primary?: string;
}

const FIELD_LABELS: Record<string, string> = {
  vin: "Namn",
  land_region: "Region",
  region: "Region",
  producent: "Producent",
  druvor: "Druvor",
  grape: "Druva",
  grapes: "Druvor",
  årgång: "Årgång",
  typ: "Typ",
  färgtyp: "Färg/typ",
  klassificering: "Klassificering",
  alkoholhalt: "Alkohol",
  volym: "Volym",
  karaktär: "Karaktär",
  smak: "Smak",
  servering: "Servering",
  sources: "Källa",
  etiketttext: "Etiketttext",
  style: "Stil",
};

type EvidenceByType = {
  label: EvidenceItem[];
  web: EvidenceItem[];
  heuristic: EvidenceItem[];
};

const formatFieldLabel = (field: string) => {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const spaced = field.replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const groupByField = (items: EvidenceItem[]) => {
  return items.reduce<Record<string, EvidenceItem[]>>((acc, item) => {
    const key = item.field || "Övrigt";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

export default function EvidenceAccordion({ ocr, hits, primary }: EvidenceAccordionProps) {
  const hasOcr = Boolean(ocr && ocr !== "–");
  const validHits = Array.isArray(hits)
    ? (hits.filter((item): item is EvidenceItem => Boolean(item)) as EvidenceItem[])
    : [];
  const hasPrimary = Boolean(primary && primary !== "–");
  const [open, setOpen] = React.useState(false);

  const evidenceByType: EvidenceByType = {
    label: [],
    web: [],
    heuristic: [],
  };

  validHits.forEach((item) => {
    if (item.type === "web") {
      evidenceByType.web.push(item);
    } else if (item.type === "label") {
      evidenceByType.label.push(item);
    } else {
      evidenceByType.heuristic.push(item);
    }
  });

  if (hasOcr) {
    evidenceByType.label.unshift({
      field: "etiketttext",
      type: "label",
      title: "OCR",
      snippet: ocr,
    });
  }

  const hasEvidence =
    evidenceByType.label.length > 0 || evidenceByType.web.length > 0 || evidenceByType.heuristic.length > 0;

  if (!hasEvidence && !hasPrimary) return null;

  const sections: { type: keyof EvidenceByType; title: string; description?: string }[] = [
    { type: "label", title: "Etikett" },
    { type: "web", title: "Webb", description: "Länkar öppnas i ny flik" },
    { type: "heuristic", title: "Härlett" },
  ];

  return (
    <section className="rounded-2xl border border-theme-card bg-theme-elevated">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-theme-primary">Källa & evidens</span>
        <span className="text-xs text-theme-secondary">{open ? "Stäng" : "Visa"}</span>
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          {hasPrimary && (
            <p className="text-xs text-theme-secondary">
              Primär källa: <span className="underline">{primary}</span>
            </p>
          )}
          {sections.map(({ type, title, description }) => {
            const items = evidenceByType[type];
            if (items.length === 0) return null;
            const grouped = groupByField(items);

            return (
              <div key={type} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-theme-primary">{title}</p>
                  {description && <p className="text-xs text-theme-secondary">{description}</p>}
                </div>
                <div className="space-y-2">
                  {Object.entries(grouped).map(([field, fieldItems]) => (
                    <div
                      key={`${type}-${field}`}
                      className="rounded-xl border border-theme-card/70 bg-theme-canvas/30 p-3"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">
                        {formatFieldLabel(field)}
                      </p>
                      <ul className="mt-2 space-y-2 text-sm text-theme-secondary">
                        {fieldItems.map((hit, index) => {
                          const key = `${field}-${index}`;
                          const label = hit.title || hit.url;
                          if (hit.url) {
                            return (
                              <li key={key} className="leading-relaxed">
                                <a
                                  className="underline decoration-theme-primary/80 decoration-2 underline-offset-2 hover:no-underline"
                                  href={hit.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {label}
                                </a>
                                {hit.snippet && <p className="mt-1 text-xs opacity-80">{hit.snippet}</p>}
                              </li>
                            );
                          }

                          return (
                            <li key={key} className="space-y-1 leading-relaxed">
                              {label && <p className="font-medium text-theme-primary/90">{label}</p>}
                              {hit.snippet && <p className="whitespace-pre-wrap">{hit.snippet}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
