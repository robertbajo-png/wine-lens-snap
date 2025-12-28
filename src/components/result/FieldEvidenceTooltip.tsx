import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { EvidenceItem } from "@/lib/wineCache";
import { CircleHelp } from "lucide-react";

type SourceKind = "label" | "web";

const FIELD_ALIASES: Record<string, string[]> = {
  druvor: ["grape", "grapes"],
  land_region: ["region"],
  typ: ["style", "färgtyp", "color"],
  fargtyp: ["typ", "style", "färgtyp", "color"],
};

const normalizeField = (value?: string) => value?.toLowerCase().trim() ?? "";

const matchesField = (field: string | undefined, target: string) => {
  const normalizedField = normalizeField(field);
  const normalizedTarget = normalizeField(target);
  if (!normalizedField || !normalizedTarget) return false;

  const aliases = new Set([normalizedTarget, ...(FIELD_ALIASES[normalizedTarget] ?? [])]);
  return aliases.has(normalizedField);
};

const pickEvidenceForField = (field: string, evidence: EvidenceItem[]) => {
  const relevant = evidence.filter((item) => matchesField(item.field, field));
  if (relevant.length > 0) return relevant;

  const fallback = evidence.filter((item) => matchesField(item.field, "sources") || matchesField(item.field, "etiketttext"));
  return fallback;
};

const resolveSource = (items: EvidenceItem[], fallback: SourceKind): SourceKind => {
  if (items.some((item) => item.type === "web")) return "web";
  if (items.some((item) => item.type === "label")) return "label";
  return fallback;
};

const readableSourceLabel = (source: SourceKind) => (source === "web" ? "webbsök" : "etikett");

const normalizeEvidence = (value?: EvidenceItem[] | null): EvidenceItem[] =>
  Array.isArray(value) ? value.filter((item): item is EvidenceItem => Boolean(item)) : [];

type FieldEvidenceTooltipProps = {
  field: string;
  label: string;
  evidence?: EvidenceItem[] | null;
  fallbackSource?: SourceKind;
};

export function FieldEvidenceTooltip({ field, label, evidence, fallbackSource = "label" }: FieldEvidenceTooltipProps) {
  const normalizedEvidence = normalizeEvidence(evidence);
  const fieldEvidence = pickEvidenceForField(field, normalizedEvidence);
  const displayEvidence = fieldEvidence.slice(0, 2);
  const source = resolveSource(fieldEvidence, fallbackSource);
  const sourceLabel = readableSourceLabel(source);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
          aria-label={`Var kommer ${label.toLowerCase()} ifrån?`}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 border-theme-card bg-theme-elevated text-theme-primary shadow-xl">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-secondary">Var kommer detta ifrån?</p>
          <p className="text-sm font-semibold text-theme-primary">{label}</p>
          <p className="text-xs text-theme-secondary">Källa: {sourceLabel}</p>
        </div>
        {displayEvidence.length > 0 ? (
          <ul className="space-y-2 text-xs text-theme-secondary">
            {displayEvidence.map((item, index) => {
              const key = item.url ?? item.title ?? `${item.field}-${index}`;
              const headline = item.title ?? item.url ?? "Källa";

              if (item.url) {
                return (
                  <li key={key} className="space-y-1 leading-relaxed">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-theme-primary underline decoration-theme-primary/70 decoration-2 underline-offset-2 hover:no-underline"
                    >
                      {headline}
                    </a>
                    {item.snippet && <p className="text-[11px] opacity-80">{item.snippet}</p>}
                  </li>
                );
              }

              return (
                <li key={key} className="space-y-1 leading-relaxed">
                  <p className="font-semibold text-theme-primary/90">{headline}</p>
                  {item.snippet && <p className="text-[11px] opacity-80">{item.snippet}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-theme-secondary">
            Ingen specifik källa listad. Uppgiften baseras på {sourceLabel}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
