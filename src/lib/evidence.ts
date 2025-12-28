import type { EvidenceItem, EvidenceItemType, WineAnalysisResult } from "./wineCache";

const HTTP_URL_REGEX = /^https?:\/\//i;

type NormalizeEvidenceParams = {
  evidence?: WineAnalysisResult["evidence"];
  sourceStatus?: WineAnalysisResult["källstatus"];
  ocrText?: string | null;
  sources?: unknown;
};

const clampText = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "–") return null;
  return trimmed;
};

const sanitizeUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HTTP_URL_REGEX.test(trimmed) ? trimmed : null;
};

const coerceType = (value: unknown, fallback: EvidenceItemType): EvidenceItemType => {
  if (value === "label" || value === "web" || value === "heuristic") {
    return value;
  }
  return fallback;
};

const toEvidenceItem = (value: unknown, field: string): EvidenceItem | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const url = sanitizeUrl(value);
    if (url) {
      return {
        field,
        type: "web",
        title: url,
        url,
      };
    }
    const text = clampText(value);
    if (!text) return null;
    return {
      field,
      type: "heuristic",
      title: text,
    };
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const url = sanitizeUrl(record.url);
    const title = clampText(typeof record.title === "string" ? record.title : record.url as string);
    const snippet = clampText(typeof record.snippet === "string" ? record.snippet : undefined);
    const type = coerceType(record.type, url ? "web" : "heuristic");

    if (!url && !title && !snippet) {
      return null;
    }

    return {
      field,
      type,
      title: title ?? undefined,
      url: url ?? undefined,
      snippet: snippet ?? undefined,
    };
  }

  return null;
};

export function normalizeEvidenceItems({ evidence, sourceStatus, ocrText, sources }: NormalizeEvidenceParams): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const dedupe = new Set<string>();

  const pushItem = (item: EvidenceItem | null) => {
    if (!item) return;
    const key = `${item.type}|${item.field}|${item.url ?? item.title ?? item.snippet ?? ""}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    items.push(item);
  };

  (Array.isArray(sourceStatus?.evidence_links) ? sourceStatus?.evidence_links : []).forEach((entry) => {
    pushItem(toEvidenceItem(entry, "sources"));
  });

  (Array.isArray(evidence?.items) ? evidence?.items : []).forEach((entry) => {
    const field = typeof (entry as EvidenceItem).field === "string" ? (entry as EvidenceItem).field : "sources";
    pushItem(toEvidenceItem(entry, field));
  });

  (Array.isArray(evidence?.webbträffar) ? evidence.webbträffar : []).forEach((entry) => {
    pushItem(toEvidenceItem(entry, "sources"));
  });

  (Array.isArray(sources) ? sources : []).forEach((entry) => {
    pushItem(toEvidenceItem(entry, "sources"));
  });

  if (items.length === 0) {
    const labelText = clampText(evidence?.etiketttext ?? ocrText);
    if (labelText || ocrText) {
      items.push({
        field: "etiketttext",
        type: "heuristic",
        title: "Derived from label text",
        snippet: labelText ?? undefined,
      });
    }
  }

  return items;
}
