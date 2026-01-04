import React from "react";
import type { EvidenceItem } from "@/lib/wineCache";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/lib/translations";

interface EvidenceAccordionProps {
  ocr?: string;
  hits?: EvidenceItem[];
  primary?: string;
}

const FIELD_LABEL_KEYS: Record<string, TranslationKey> = {
  vin: "evidence.fieldVin",
  land_region: "evidence.fieldRegion",
  region: "evidence.fieldRegion",
  producent: "evidence.fieldProducent",
  druvor: "evidence.fieldDruvor",
  grape: "evidence.fieldGrape",
  grapes: "evidence.fieldDruvor",
  årgång: "evidence.fieldVintage",
  typ: "evidence.fieldTyp",
  färgtyp: "evidence.fieldColorType",
  klassificering: "evidence.fieldClassification",
  alkoholhalt: "evidence.fieldAlcohol",
  volym: "evidence.fieldVolume",
  karaktär: "evidence.fieldCharacter",
  smak: "evidence.fieldTaste",
  servering: "evidence.fieldServing",
  sources: "evidence.fieldSources",
  etiketttext: "evidence.fieldLabelText",
  style: "evidence.fieldStyle",
};

type EvidenceByType = {
  label: EvidenceItem[];
  web: EvidenceItem[];
  heuristic: EvidenceItem[];
};

const groupByField = (items: EvidenceItem[]) => {
  return items.reduce<Record<string, EvidenceItem[]>>((acc, item) => {
    const key = item.field || "_other";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

export default function EvidenceAccordion({ ocr, hits, primary }: EvidenceAccordionProps) {
  const { t } = useTranslation();
  
  const formatFieldLabel = (field: string): string => {
    if (field === "_other") return t("evidence.other");
    const labelKey = FIELD_LABEL_KEYS[field];
    if (labelKey) return t(labelKey);
    const spaced = field.replace(/[_-]+/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

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

  const sections: { type: keyof EvidenceByType; titleKey: TranslationKey; descriptionKey?: TranslationKey }[] = [
    { type: "label", titleKey: "evidence.label" },
    { type: "web", titleKey: "evidence.web", descriptionKey: "evidence.webDesc" },
    { type: "heuristic", titleKey: "evidence.heuristic" },
  ];

  return (
    <section className="rounded-2xl border border-theme-card bg-theme-elevated">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-theme-primary">{t("evidence.title")}</span>
        <span className="text-xs text-theme-secondary">{open ? t("evidence.close") : t("evidence.show")}</span>
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-4">
          {hasPrimary && (
            <p className="text-xs text-theme-secondary">
              {t("evidence.primarySource")}: <span className="underline">{primary}</span>
            </p>
          )}
          {sections.map(({ type, titleKey, descriptionKey }) => {
            const items = evidenceByType[type];
            if (items.length === 0) return null;
            const grouped = groupByField(items);

            return (
              <div key={type} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-theme-primary">{t(titleKey)}</p>
                  {descriptionKey && <p className="text-xs text-theme-secondary">{t(descriptionKey)}</p>}
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
