import React from "react";
import type { EvidenceItem } from "@/lib/wineCache";

interface EvidenceAccordionProps {
  ocr?: string;
  hits?: EvidenceItem[];
  primary?: string;
}

export default function EvidenceAccordion({ ocr, hits, primary }: EvidenceAccordionProps) {
  const hasOcr = Boolean(ocr && ocr !== "–");
  const validHits = Array.isArray(hits)
    ? (hits.filter((item): item is EvidenceItem => Boolean(item)) as EvidenceItem[])
    : [];
  const webSources = validHits.filter((item) => item.type === "web" && item.url);
  const heuristics = validHits.filter((item) => item.type !== "web");
  const hasPrimary = Boolean(primary && primary !== "–");
  const [open, setOpen] = React.useState(false);

  if (!hasOcr && validHits.length === 0 && !hasPrimary) return null;

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
          {webSources.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-theme-primary">Webbkällor</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-theme-secondary">
                {webSources.slice(0, 5).map((hit, index) => {
                  if (!hit.url) return null;
                  const label = hit.title ?? hit.url;
                  return (
                    <li key={`${hit.url}-${index}`}>
                      <a className="underline hover:no-underline" href={hit.url} target="_blank" rel="noreferrer">
                        {label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {heuristics.length > 0 && (
            <div className="space-y-1 rounded-xl border border-theme-card/70 bg-theme-canvas/30 p-3">
              <p className="text-sm font-semibold text-theme-primary">Härlett</p>
              <ul className="space-y-2 text-sm text-theme-secondary">
                {heuristics.slice(0, 5).map((hit, index) => (
                  <li key={`${hit.field}-${index}`} className="space-y-1">
                    {hit.title && <p className="font-medium text-theme-primary/90">{hit.title}</p>}
                    {hit.snippet && <p className="whitespace-pre-wrap">{hit.snippet}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasOcr && (
            <div>
              <p className="text-sm font-semibold text-theme-primary">Etikett (OCR)</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-theme-secondary">{ocr}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
