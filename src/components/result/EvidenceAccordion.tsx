import React from "react";

type WebHit = string | { url: string; källa?: string };

interface EvidenceAccordionProps {
  ocr?: string;
  hits?: WebHit[];
  primary?: string;
}

export default function EvidenceAccordion({ ocr, hits, primary }: EvidenceAccordionProps) {
  const hasOcr = Boolean(ocr && ocr !== "–");
  const validHits = Array.isArray(hits) ? (hits.filter(Boolean) as WebHit[]) : [];
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
          {validHits.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-theme-primary">Webbkällor</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-theme-secondary">
                {validHits.slice(0, 5).map((hit, index) => {
                  const url = typeof hit === "string" ? hit : hit.url;
                  const label = typeof hit === "string" ? hit : hit.källa || hit.url;
                  if (!url) return null;
                  return (
                    <li key={`${url}-${index}`}>
                      <a className="underline hover:no-underline" href={url} target="_blank" rel="noreferrer">
                        {label}
                      </a>
                    </li>
                  );
                })}
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

