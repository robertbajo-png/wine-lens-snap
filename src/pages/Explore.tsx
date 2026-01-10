import { memo, useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Compass, Filter, Flame, Grip, Search, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/integrations/supabase/types";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { normalizeAnalysisJson } from "@/lib/analysisSchema";
import { useAuth } from "@/auth/AuthProvider";
import { trackEvent } from "@/lib/telemetry";
import { logEvent } from "@/lib/logger";
import { withTimeoutFallback } from "@/lib/fallback";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/lib/translations";
import { AppHeader } from "@/components/layout/AppHeader";

type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

const TREND_LIMIT = 3;
const STYLE_LIMIT = 4;
const MAX_SCANS_FETCH = 120;
const TREND_WINDOW_DAYS = 42;
const TREND_MIN_SCANS = 5;
const POPULAR_STYLE_RECENT_WINDOW = 20;
const STYLE_MIN_SCANS = 5;

const FILTER_EMPTY_VALUE = "__all__";

type QuickFilterField = "grape" | "style" | "region";

type SearchFilterField = QuickFilterField | "label";

type SearchFilters = Partial<Record<SearchFilterField, string>>;

const SUPPORTED_FILTER_FIELDS: SearchFilterField[] = ["label", "grape", "style", "region"];
const serializeFilters = (filters: SearchFilters) =>
  SUPPORTED_FILTER_FIELDS.map((field) => `${field}:${filters[field]?.toLowerCase() ?? ""}`).join("|");

const countActiveFilters = (filters: SearchFilters): number =>
  Object.values(filters).filter((value) => typeof value === "string" && value.trim().length > 0).length;

const createExploreSessionId = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (error) {
    // ignore and fall back
  }
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

type QuickFilter = {
  id: string;
  label: string;
  description: string;
  field: QuickFilterField;
  value: string;
};

const FALLBACK_QUICK_FILTERS: QuickFilter[] = [
  {
    id: "furmint",
    label: "Furmint",
    description: "Tokaj & Somló",
    field: "grape",
    value: "Furmint",
  },
  {
    id: "orange",
    label: "Orangevin",
    description: "Lång skalkontakt",
    field: "style",
    value: "orange",
  },
  {
    id: "riesling",
    label: "Riesling",
    description: "Kyligt & mineraliskt",
    field: "grape",
    value: "Riesling",
  },
  {
    id: "nebbiolo",
    label: "Nebbiolo",
    description: "Piemontes röda",
    field: "grape",
    value: "Nebbiolo",
  },
  {
    id: "norra-rhone",
    label: "Nordrhône",
    description: "Pepprig Syrah",
    field: "region",
    value: "rhône",
  },
];

type AggregationItem = {
  label: string;
  detail: string;
  count: number;
};

type ExploreScan = {
  id: string;
  title: string;
  producer?: string | null;
  region?: string | null;
  grapesRaw?: string | null;
  grapesList: string[];
  style?: string | null;
  color?: string | null;
  notes?: string | null;
  image?: string | null;
  createdAt: string;
  createdAtMs: number;
  source: "mine" | "curated";
};

type ScanRow = Pick<Tables<"scans">, "id" | "created_at" | "analysis_json" | "image_thumb">;
type ExploreCardRow = Tables<"explore_cards">;
// Use explore_cards schema for wine library display
type WineIndexRow = ExploreCardRow;

const cleanFilterValue = (value?: string | null) => value?.trim() ?? "";
const escapeIlikePattern = (value: string) => value.replace(/[%_]/g, "\\$&");
const buildIlikePattern = (value: string) => `%${escapeIlikePattern(value)}%`;

const parseSearchFilters = (params: URLSearchParams): SearchFilters => {
  const filters: SearchFilters = {};
  for (const field of SUPPORTED_FILTER_FIELDS) {
    const value = cleanFilterValue(params.get(field));
    if (value) {
      filters[field] = value;
    }
  }
  return filters;
};

const hasExplicitFilters = (filters: SearchFilters): boolean =>
  SUPPORTED_FILTER_FIELDS.some((field) => Boolean(filters[field]?.trim()));

const matchesSearchFilters = (scan: ExploreScan, filters: SearchFilters): boolean => {
  const normalizedLabel = `${scan.title} ${scan.producer ?? ""} ${scan.notes ?? ""}`.toLowerCase();
  const normalizedRegion = cleanFilterValue(scan.region?.toLowerCase());
  const normalizedStyle = cleanFilterValue(scan.style?.toLowerCase());
  const grapeSet = scan.grapesList.map((grape) => grape.toLowerCase());

  if (filters.label) {
    const query = filters.label.toLowerCase();
    if (!normalizedLabel.includes(query)) {
      return false;
    }
  }

  if (filters.region) {
    if (!normalizedRegion.includes(filters.region.toLowerCase())) {
      return false;
    }
  }

  if (filters.style) {
    if (!normalizedStyle.includes(filters.style.toLowerCase())) {
      return false;
    }
  }

  if (filters.grape) {
    const target = filters.grape.toLowerCase();
    const hasMatch = grapeSet.some((grape) => grape.includes(target));
    if (!hasMatch) {
      return false;
    }
  }

  return true;
};

const uniqueSortedValues = (values: (string | null | undefined)[]): string[] => {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = cleanFilterValue(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, trimmed);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));
};

const syncQuickFilterParam = (params: URLSearchParams, filters: QuickFilter[]) => {
  const filterId = params.get("filter");
  if (!filterId) return;
  const quickFilter = filters.find((filter) => filter.id === filterId);
  if (!quickFilter) {
    params.delete("filter");
    return;
  }
  const activeValue = cleanFilterValue(params.get(quickFilter.field));
  if (!activeValue || activeValue.toLowerCase() !== quickFilter.value.toLowerCase()) {
    params.delete("filter");
  }
};

const buildWineIndex = (personal: ExploreScan[], curated: ExploreScan[]): ExploreScan[] => [...personal, ...curated];

const FALLBACK_TRENDS: AggregationItem[] = [
  { label: "Furmint", detail: "Tokajs vulkaner", count: 14 },
  { label: "Pinot Noir", detail: "Småsläpp från Bourgogne", count: 11 },
  { label: "Orangevin", detail: "Macererat & matvänligt", count: 9 },
];

const FALLBACK_STYLES: AggregationItem[] = [
  { label: "Mineraliskt vitt", detail: "Salt sten & citrus", count: 12 },
  { label: "Nordisk cider", detail: "Bärnstensglöd", count: 8 },
  { label: "Orangevin", detail: "Aprikos & teblad", count: 7 },
  { label: "Svala röda", detail: "Syrliga bär", count: 6 },
];

type CuratedSeed = {
  id: string;
  title: string;
  producer?: string;
  region?: string;
  grapes?: string;
  style?: string;
  notes?: string;
  createdAt: string;
};

const FALLBACK_CURATED_SEEDS: CuratedSeed[] = [
  {
    id: "curated-furmint-barta",
    title: "Barta Öreg Király-dűlő",
    producer: "Barta Pince",
    region: "Tokaj, Ungern",
    grapes: "Furmint",
    style: "Vitt stilla vin",
    notes: "Salt sten, bivax och aprikos från terrasserad vulkansluttning.",
    createdAt: "2024-10-12T08:00:00Z",
  },
  {
    id: "curated-furmint-abbey",
    title: "Kreinbacher Brut Nature",
    producer: "Somló Abbey Wines",
    region: "Somló, Ungern",
    grapes: "Furmint, Hárslevelű",
    style: "Traditionell metod",
    notes: "Rökig kalk, citruszest och stram mousse.",
    createdAt: "2024-09-18T15:20:00Z",
  },
  {
    id: "curated-orange-georgia",
    title: "Pheasant's Tears Rkatsiteli",
    producer: "Pheasant's Tears",
    region: "Kakheti, Georgien",
    grapes: "Rkatsiteli",
    style: "Orangevin",
    notes: "Bärnstenstoner, teblad och granatäppelskal.",
    createdAt: "2024-08-01T11:00:00Z",
  },
  {
    id: "curated-riesling-mosel",
    title: "Clemens Busch Marienburg GG",
    producer: "Clemens Busch",
    region: "Mosel, Tyskland",
    grapes: "Riesling",
    style: "Torr Riesling",
    notes: "Rökig skiffer, lime och vildörter.",
    createdAt: "2024-07-22T18:00:00Z",
  },
  {
    id: "curated-nebbiolo-langhe",
    title: "Trediberri Langhe Nebbiolo",
    producer: "Trediberri",
    region: "La Morra, Piemonte",
    grapes: "Nebbiolo",
    style: "Svalt rött",
    notes: "Rosenblad, granatäpple och finstämda tanniner.",
    createdAt: "2024-06-30T12:30:00Z",
  },
  {
    id: "curated-syrah-rhone",
    title: "Domaine Jamet Côte-Rôtie",
    producer: "Domaine Jamet",
    region: "Côte-Rôtie, Frankrike",
    grapes: "Syrah",
    style: "Nordrhône",
    notes: "Viol, svartpeppar och oliver från skifferterrasser.",
    createdAt: "2024-06-12T10:10:00Z",
  },
];

const pluralize = (count: number, singularKey: TranslationKey, pluralKey: TranslationKey, t: TranslateFn) =>
  count === 1 ? t(singularKey) : t(pluralKey);

const parseGrapes = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/[,/&+]| och /gi)
    .map((part) => part.replace(/\d+%/g, "").replace(/[()]/g, "").trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
};

const FALLBACK_CURATED_LIBRARY: ExploreScan[] = FALLBACK_CURATED_SEEDS.map((seed) => ({
  id: seed.id,
  title: seed.title,
  producer: seed.producer,
  region: seed.region,
  grapesRaw: seed.grapes,
  grapesList: parseGrapes(seed.grapes),
  style: seed.style,
  notes: seed.notes,
  color: seed.style,
  image: null,
  createdAt: seed.createdAt,
  createdAtMs: Date.parse(seed.createdAt),
  source: "curated",
}));

const FALLBACK_WINE_INDEX_ROWS: WineIndexRow[] = FALLBACK_CURATED_LIBRARY.map((scan) => ({
  id: scan.id,
  created_at: scan.createdAt,
  title: scan.title,
  producer: scan.producer ?? null,
  region: scan.region ?? null,
  grapes_raw: scan.grapesRaw ?? null,
  style: scan.style ?? null,
  color: scan.color ?? null,
  notes: scan.notes ?? null,
  image_url: scan.image ?? null,
  rank: null,
  payload_json: null,
}));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getCardPayloadType = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  return typeof payload.type === "string" ? payload.type : null;
};

const parseSeedScanPayload = (payload: unknown): ExploreScan | null => {
  if (!isRecord(payload)) return null;

  const id = typeof payload.id === "string" ? payload.id : null;
  const title = typeof payload.title === "string" ? payload.title : null;
  if (!id || !title) return null;

  const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString();
  const rawCreatedAtMs = Date.parse(createdAt);

  const grapesRaw =
    typeof payload.grapesRaw === "string"
      ? payload.grapesRaw
      : typeof payload.grapes === "string"
        ? payload.grapes
        : null;

  const providedGrapesList = Array.isArray(payload.grapesList)
    ? (payload.grapesList.filter((item): item is string => typeof item === "string") ?? [])
    : [];

  const grapesList = providedGrapesList.length > 0 ? providedGrapesList : parseGrapes(grapesRaw);

  return {
    id,
    title,
    producer: typeof payload.producer === "string" ? payload.producer : null,
    region: typeof payload.region === "string" ? payload.region : null,
    grapesRaw,
    grapesList,
    style: typeof payload.style === "string" ? payload.style : null,
    color:
      typeof payload.color === "string"
        ? payload.color
        : typeof payload.style === "string"
          ? payload.style
          : null,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    image: typeof payload.image === "string" ? payload.image : null,
    createdAt,
    createdAtMs: Number.isNaN(rawCreatedAtMs) ? Date.now() : rawCreatedAtMs,
    source: "curated",
  };
};

const parseAggregationPayload = (payload: unknown): AggregationItem | null => {
  if (!isRecord(payload)) return null;
  const label = typeof payload.label === "string" ? payload.label : null;
  if (!label) return null;

  const detail = typeof payload.detail === "string" ? payload.detail : "";
  const countValue =
    typeof payload.count === "number"
      ? payload.count
      : typeof payload.count === "string"
        ? Number.parseInt(payload.count, 10)
        : 0;

  return {
    label,
    detail,
    count: Number.isNaN(countValue) ? 0 : countValue,
  };
};

const parseQuickFilterPayload = (payload: unknown): QuickFilter | null => {
  if (!isRecord(payload)) return null;
  const id = typeof payload.id === "string" ? payload.id : null;
  const label = typeof payload.label === "string" ? payload.label : null;
  const field = typeof payload.field === "string" ? payload.field : null;
  const value = typeof payload.value === "string" ? payload.value : null;
  if (!id || !label || !field || !value) return null;
  if (field !== "grape" && field !== "style" && field !== "region") return null;

  return {
    id,
    label,
    description: typeof payload.description === "string" ? payload.description : "",
    field: field as QuickFilterField,
    value,
  };
};

const normalizeScanRow = (row: ScanRow, t: TranslateFn): ExploreScan => {
  const analysis = normalizeAnalysisJson(row.analysis_json as unknown as WineAnalysisResult | null);
  const createdAt = row.created_at ?? new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);

  const grapesRaw = analysis?.druvor ?? null;
  const grapesList = parseGrapes(grapesRaw);

  return {
    id: row.id,
    title: analysis?.vin ?? t("explore.unknownLabel"),
    producer: analysis?.producent ?? null,
    region: analysis?.land_region ?? null,
    grapesRaw,
    grapesList,
    style: analysis?.typ ?? analysis?.färgtyp ?? null,
    color: analysis?.färgtyp ?? null,
    notes: analysis?.karaktär ?? analysis?.smak ?? null,
    image: row.image_thumb ?? null,
    createdAt,
    createdAtMs: Number.isNaN(createdAtMs) ? Date.now() : createdAtMs,
    source: "mine",
  };
};

const normalizeWineIndexRow = (row: WineIndexRow): ExploreScan => {
  const createdAt = row.created_at ?? new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);
  const grapesRaw = row.grapes_raw ?? null;

  const payload = (row.payload_json as Record<string, unknown> | null) ?? null;
  const rawPayloadGrapes = Array.isArray(payload?.grapesList as unknown[])
    ? ((payload?.grapesList as unknown[]) ?? [])
    : [];
  const payloadGrapes = rawPayloadGrapes.filter((item): item is string => typeof item === "string");
  const grapesList = payloadGrapes.length > 0 ? payloadGrapes : parseGrapes(grapesRaw);

  return {
    id: row.id,
    title: row.title,
    producer: row.producer,
    region: row.region,
    grapesRaw,
    grapesList,
    style: row.style,
    color: row.color ?? row.style ?? null,
    notes: row.notes,
    image: row.image_url,
    createdAt,
    createdAtMs: Number.isNaN(createdAtMs) ? Date.now() : createdAtMs,
    source: "curated",
  };
};

const deriveTrendingRegions = (scans: ExploreScan[], t: TranslateFn): AggregationItem[] => {
  const now = Date.now();
  const windowMs = TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const eligible = scans.filter((scan) => {
    const region = cleanFilterValue(scan.region);
    if (!region) return false;
    const ageMs = now - scan.createdAtMs;
    return ageMs >= 0 && ageMs <= windowMs;
  });

  if (eligible.length < TREND_MIN_SCANS) {
    return [];
  }

  const counts = new Map<
    string,
    { label: string; weighted: number; count: number; mostRecent: number }
  >();

  for (const scan of eligible) {
    const region = scan.region?.trim();
    if (!region) continue;
    const key = region.toLowerCase();
    const ageRatio = Math.min(Math.max((now - scan.createdAtMs) / windowMs, 0), 1);
    const recencyWeight = 1 + (1 - ageRatio); // 2 for newest, 1 for oldest within window
    const entry = counts.get(key) ?? {
      label: region,
      weighted: 0,
      count: 0,
      mostRecent: 0,
    };
    entry.weighted += recencyWeight;
    entry.count += 1;
    entry.mostRecent = Math.max(entry.mostRecent, scan.createdAtMs);
    counts.set(key, entry);
  }

  const weeks = Math.round(TREND_WINDOW_DAYS / 7);

  return Array.from(counts.values())
    .sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      if (b.count !== a.count) return b.count - a.count;
      return b.mostRecent - a.mostRecent;
    })
    .slice(0, TREND_LIMIT)
    .map((item) => ({
      label: item.label,
      detail: t("explore.scanCount", { count: item.count, unit: pluralize(item.count, "explore.scan", "explore.scans", t), weeks }),
      count: item.count,
    }));
};

const derivePopularStyles = (scans: ExploreScan[], t: TranslateFn, locale: string): AggregationItem[] => {
  const styleScans = scans
    .filter((scan) => Boolean(cleanFilterValue(scan.style)))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  if (styleScans.length < STYLE_MIN_SCANS) {
    return [];
  }

  const counts = new Map<string, { label: string; weighted: number; count: number }>();

  styleScans.forEach((scan, index) => {
    const style = scan.style?.trim();
    if (!style) return;
    const key = style.toLowerCase();
    const recencyBoost = index < POPULAR_STYLE_RECENT_WINDOW ? 1.5 : 1;
    const entry = counts.get(key) ?? { label: style, weighted: 0, count: 0 };
    entry.weighted += recencyBoost;
    entry.count += 1;
    counts.set(key, entry);
  });

  return Array.from(counts.values())
    .sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, locale, { sensitivity: "base" });
    })
    .slice(0, STYLE_LIMIT)
    .map((item) => ({
      label: item.label,
      detail: t("explore.hitCount", { count: item.count, unit: pluralize(item.count, "explore.hit", "explore.hits", t) }),
      count: item.count,
    }));
};

const formatRelativeTime = (iso: string, locale: string, t: TranslateFn) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("explore.recently");

  const diffMs = date.getTime() - Date.now();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, unitMs] of units) {
    if (Math.abs(diffMs) >= unitMs || unit === "minute") {
      const value = Math.round(diffMs / unitMs);
      return rtf.format(value, unit);
    }
  }

  return t("explore.recently");
};

const fetchRecentScans = async (): Promise<ScanRow[]> =>
  withTimeoutFallback(
    async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("id,created_at,analysis_json,image_thumb")
        .order("created_at", { ascending: false })
        .limit(MAX_SCANS_FETCH);

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    () => [],
    { context: "fetch_recent_scans" },
  );

const fetchExploreCards = async (): Promise<ExploreCardRow[]> =>
  withTimeoutFallback(
    async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("explore_cards")
        .select("id,created_at,title,subtitle,payload_json,rank,valid_from,valid_to")
        .lte("valid_from", nowIso)
        .or(`valid_to.is.null,valid_to.gte.${nowIso}`)
        .order("rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    () => [],
    { context: "fetch_explore_cards" },
  );

const WINE_INDEX_FETCH_LIMIT = 120;
const WINE_INDEX_CACHE_KEY = "explore_wine_index_cache_v1";
const WINE_INDEX_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const readCachedWineIndex = (filters: SearchFilters): WineIndexRow[] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cacheKey = `${WINE_INDEX_CACHE_KEY}:${serializeFilters(filters)}`;
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; rows: WineIndexRow[] };
    if (!parsed?.timestamp || !Array.isArray(parsed.rows)) {
      return null;
    }
    if (Date.now() - parsed.timestamp > WINE_INDEX_CACHE_TTL_MS) {
      return null;
    }
    return parsed.rows;
  } catch (error) {
    console.warn("[explore] Failed to read cached wine index", error);
    return null;
  }
};

const writeCachedWineIndex = (filters: SearchFilters, rows: WineIndexRow[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const cacheKey = `${WINE_INDEX_CACHE_KEY}:${serializeFilters(filters)}`;
    const payload = JSON.stringify({ timestamp: Date.now(), rows });
    window.localStorage.setItem(cacheKey, payload);
  } catch (error) {
    console.warn("[explore] Failed to persist wine index cache", error);
  }
};

const fetchWineIndexRows = async (filters: SearchFilters): Promise<WineIndexRow[]> =>
  withTimeoutFallback(
    async () => {
      const cachedRows = readCachedWineIndex(filters);
      if (cachedRows) {
        return cachedRows;
      }

      let query = supabase
        .from("explore_cards")
        .select("id,created_at,title,producer,region,grapes_raw,style,color,notes,image_url,rank,payload_json")
        .order("rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(WINE_INDEX_FETCH_LIMIT);

      if (filters.region) {
        query = query.ilike("region", buildIlikePattern(filters.region));
      }

      if (filters.style) {
        query = query.ilike("style", buildIlikePattern(filters.style));
      }

      if (filters.grape) {
        query = query.ilike("grapes_raw", buildIlikePattern(filters.grape));
      }

      if (filters.label) {
        const labelPattern = buildIlikePattern(filters.label);
        query = query.or(
          `title.ilike.${labelPattern},producer.ilike.${labelPattern},notes.ilike.${labelPattern}`,
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const rows = data ?? [];
      writeCachedWineIndex(filters, rows);
      return rows;
    },
    () =>
      FALLBACK_WINE_INDEX_ROWS.filter((row) =>
        matchesSearchFilters(normalizeWineIndexRow(row), filters),
      ),
    { context: "fetch_wine_index" },
  );

type ExploreScanListProps = {
  scans: ExploreScan[];
  showSkeleton: boolean;
  showEmptyState: boolean;
  showFirstScanHint: boolean;
  showLoginPrompt: boolean;
  showScanErrorBanner: boolean;
  isRetryingScans: boolean;
  onScanOpen: (scan: ExploreScan) => void;
  onScanKeyDown: (event: KeyboardEvent<HTMLElement>, scan: ExploreScan) => void;
  onClearFilters: () => void;
  onStartNewScan: () => void;
  onNavigateToLogin: () => void;
  onRetryScans: () => void;
  t: TranslateFn;
  locale: string;
};

const ExploreScanList = memo(
  ({
    scans,
    showSkeleton,
    showEmptyState,
    showFirstScanHint,
    showLoginPrompt,
    showScanErrorBanner,
    isRetryingScans,
    onScanOpen,
    onScanKeyDown,
    onClearFilters,
    onStartNewScan,
    onNavigateToLogin,
    onRetryScans,
    t,
    locale,
  }: ExploreScanListProps) => (
    <div className="mt-6 space-y-4">
      {showSkeleton && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--color-surface)/0.3)]" />
          ))}
        </div>
      )}

      {!showSkeleton &&
        scans.map((scan) => (
          <article
            key={`${scan.source}-${scan.id}`}
            role="button"
            tabIndex={0}
            aria-label={t("explore.openScan", { title: scan.title })}
            onClick={() => onScanOpen(scan)}
            onKeyDown={(event) => onScanKeyDown(event, scan)}
            className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.2)] p-4 outline-none transition hover:border-[hsl(var(--color-accent)/0.5)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent)/0.6)] sm:flex-row sm:items-center"
          >
            <div className="flex w-full flex-1 flex-col gap-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-theme-secondary/60">
                <span>{scan.source === "mine" ? t("explore.myScan") : t("explore.curated")}</span>
                <span>•</span>
                <span>{formatRelativeTime(scan.createdAt, locale, t)}</span>
              </div>
              <h3 className="text-lg font-semibold text-theme-primary">{scan.title}</h3>
              <p className="text-sm text-theme-secondary/80">
                {[scan.producer, scan.region].filter(Boolean).join(" • ") || t("explore.unknownOrigin")}
              </p>
              {scan.notes && <p className="text-sm text-theme-secondary/70">{scan.notes}</p>}
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-theme-secondary/70 sm:items-end">
              {scan.grapesRaw && <span>{scan.grapesRaw}</span>}
              {scan.style && (
                <span className="rounded-full border border-[hsl(var(--color-border)/0.4)] px-3 py-1 text-xs uppercase tracking-[0.3em]">
                  {scan.style}
                </span>
              )}
            </div>
          </article>
        ))}

      {showEmptyState && (
        <Banner
          type="info"
          title={t("explore.noMatchTitle")}
          text={t("explore.noMatchText")}
          ctaLabel={t("explore.clearFilters")}
          onCta={onClearFilters}
          className="border-dashed"
        />
      )}

      {showFirstScanHint && (
        <Banner
          type="info"
          title={t("explore.firstScanTitle")}
          text={t("explore.firstScanText")}
          ctaLabel={t("explore.startScan")}
          onCta={onStartNewScan}
        />
      )}

      {showLoginPrompt && (
        <Banner
          type="info"
          title={t("explore.loginPromptTitle")}
          text={t("explore.loginPromptText")}
          ctaLabel={t("explore.goToLogin")}
          onCta={onNavigateToLogin}
        />
      )}

      {showScanErrorBanner && (
        <Banner
          type="error"
          title={t("explore.scanErrorTitle")}
          text={t("explore.scanErrorText")}
          ctaLabel={isRetryingScans ? t("explore.retrying") : t("common.retry")}
          onCta={onRetryScans}
        />
      )}
    </div>
  ),
  (prev, next) =>
    prev.scans === next.scans &&
    prev.showSkeleton === next.showSkeleton &&
    prev.showEmptyState === next.showEmptyState &&
    prev.showFirstScanHint === next.showFirstScanHint &&
    prev.showLoginPrompt === next.showLoginPrompt &&
    prev.showScanErrorBanner === next.showScanErrorBanner &&
    prev.isRetryingScans === next.isRetryingScans &&
    prev.onScanOpen === next.onScanOpen &&
    prev.onScanKeyDown === next.onScanKeyDown &&
    prev.onClearFilters === next.onClearFilters &&
    prev.onStartNewScan === next.onStartNewScan &&
    prev.onNavigateToLogin === next.onNavigateToLogin &&
    prev.onRetryScans === next.onRetryScans &&
    prev.t === next.t &&
    prev.locale === next.locale,
);

ExploreScanList.displayName = "ExploreScanList";

const Explore = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useTranslation();
  const sessionIdRef = useRef<string>();
  const exploreOpenedRef = useRef(false);

  const logExploreCardOpened = useCallback((cardType: "trend" | "style" | "quick_filter") => {
    void logEvent("explore_card_opened", { card_type: cardType });
  }, []);

  const handleExploreCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    cardType: "trend" | "style",
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      logExploreCardOpened(cardType);
    }
  };

  if (!sessionIdRef.current) {
    sessionIdRef.current = createExploreSessionId();
  }

  const {
    data: scanRows = [],
    isLoading: scansLoading,
    isError: scansError,
    isFetching: scansFetching,
    refetch: refetchScans,
  } = useQuery({
    queryKey: ["explore", "scans", user?.id ?? "guest"],
    queryFn: fetchRecentScans,
    enabled: Boolean(user?.id),
    staleTime: 1000 * 60 * 5,
  });

  const { data: exploreCards = [] } = useQuery({
    queryKey: ["explore", "cards"],
    queryFn: fetchExploreCards,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const personalScans = useMemo(() => (scanRows ?? []).map((row) => normalizeScanRow(row, t)), [scanRows, t]);

  const cardSeedLibrary = useMemo(
    () =>
      (exploreCards ?? [])
        .filter((card) => getCardPayloadType(card.payload_json) === "seed_scan")
        .map((card) => parseSeedScanPayload(card.payload_json))
        .filter((card): card is ExploreScan => Boolean(card)),
    [exploreCards],
  );


  const serverTrends = useMemo(
    () =>
      (exploreCards ?? [])
        .filter((card) => getCardPayloadType(card.payload_json) === "trending_region")
        .map((card) => parseAggregationPayload(card.payload_json))
        .filter((item): item is AggregationItem => Boolean(item)),
    [exploreCards],
  );

  const serverStyles = useMemo(
    () =>
      (exploreCards ?? [])
        .filter((card) => getCardPayloadType(card.payload_json) === "popular_style")
        .map((card) => parseAggregationPayload(card.payload_json))
        .filter((item): item is AggregationItem => Boolean(item)),
    [exploreCards],
  );

  const serverQuickFilters = useMemo(
    () =>
      (exploreCards ?? [])
        .filter((card) => getCardPayloadType(card.payload_json) === "quick_filter")
        .map((card) => parseQuickFilterPayload(card.payload_json))
        .filter((item): item is QuickFilter => Boolean(item)),
    [exploreCards],
  );

  const availableFilters = serverQuickFilters.length > 0 ? serverQuickFilters : FALLBACK_QUICK_FILTERS;
  const defaultQuickFilter = availableFilters[0] ?? FALLBACK_QUICK_FILTERS[0]!;

  const trendItems = useMemo(() => {
    const trends = deriveTrendingRegions(personalScans, t);
    if (trends.length > 0) return trends;
    if (serverTrends.length > 0) return serverTrends;
    return FALLBACK_TRENDS;
  }, [personalScans, serverTrends, t]);

  const styleItems = useMemo(() => {
    const styles = derivePopularStyles(personalScans, t, locale);
    if (styles.length > 0) return styles;
    if (serverStyles.length > 0) return serverStyles;
    return FALLBACK_STYLES;
  }, [personalScans, serverStyles, t, locale]);

  const selectedFilterId = searchParams.get("filter");

  const selectedQuickFilter = useMemo(() => {
    if (!selectedFilterId) return null;
    return availableFilters.find((filter) => filter.id === selectedFilterId) ?? null;
  }, [availableFilters, selectedFilterId]);

  const paramsFilters = useMemo(() => parseSearchFilters(searchParams), [searchParams]);
  const manualFiltersActive = useMemo(() => hasExplicitFilters(paramsFilters), [paramsFilters]);

  const fallbackQuickFilter = !manualFiltersActive ? selectedQuickFilter ?? defaultQuickFilter : null;

  const effectiveFilters = useMemo<SearchFilters>(() => {
    if (manualFiltersActive) {
      return paramsFilters;
    }
    if (fallbackQuickFilter) {
      return { [fallbackQuickFilter.field]: fallbackQuickFilter.value };
    }
    return {};
  }, [manualFiltersActive, paramsFilters, fallbackQuickFilter]);

  const highlightedFilterId = selectedFilterId ?? (!manualFiltersActive ? fallbackQuickFilter?.id ?? null : null);

  const debouncedFilters = useDebouncedValue(effectiveFilters, 250);
  const debouncedSerializedFilters = useMemo(
    () => serializeFilters(debouncedFilters),
    [debouncedFilters],
  );

  const { data: wineIndexRows = [], isFetching: wineIndexFetching } = useQuery({
    queryKey: ["explore", "wine-index", debouncedSerializedFilters],
    queryFn: () => fetchWineIndexRows(debouncedFilters),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60,
  });

  const serverWineLibrary = useMemo(
    () => (wineIndexRows ?? []).map((row: WineIndexRow) => normalizeWineIndexRow(row)),
    [wineIndexRows],
  );

  const hasRemoteCuratedLibrary = serverWineLibrary.length > 0;

  const curatedWineLibrary = hasRemoteCuratedLibrary
    ? serverWineLibrary
    : cardSeedLibrary.length > 0
      ? cardSeedLibrary
      : FALLBACK_CURATED_LIBRARY;

  const seedLibrarySource = hasRemoteCuratedLibrary
    ? "wine_index"
    : cardSeedLibrary.length > 0
      ? "explore_cards"
      : "fallback";

  const handleSelectFilter = useCallback(
    (filterId: string) => {
      const next = availableFilters.find((filter) => filter.id === filterId);
      if (!next) return;
      logExploreCardOpened("quick_filter");
      const params = new URLSearchParams(searchParams);
      params.set("filter", filterId);
      params.set(next.field, next.value);
      setSearchParams(params, { replace: true });

      const filtersSnapshot = parseSearchFilters(params);
      trackEvent(
        "explore_filter_changed",
        {
          source: "quick",
          field: next.field,
          value: next.value,
          quickFilterId: filterId,
          filters: filtersSnapshot,
          filterCount: countActiveFilters(filtersSnapshot),
          manualFiltersActive: hasExplicitFilters(filtersSnapshot),
        },
        { sessionId: sessionIdRef.current },
      );
    },
    [availableFilters, logExploreCardOpened, searchParams, setSearchParams],
  );

  const handleSearchFilterChange = useCallback(
    (field: SearchFilterField, value: string) => {
      const params = new URLSearchParams(searchParams);
      const normalizedValue = field === "label" ? value : value === FILTER_EMPTY_VALUE ? "" : value;
      if (normalizedValue) {
        params.set(field, normalizedValue);
      } else {
        params.delete(field);
      }
      syncQuickFilterParam(params, availableFilters);
      setSearchParams(params, { replace: true });

      const filtersSnapshot = parseSearchFilters(params);
      trackEvent(
        "explore_filter_changed",
        {
          source: "manual",
          field,
          value: normalizedValue,
          cleared: !normalizedValue,
          quickFilterId: params.get("filter"),
          filters: filtersSnapshot,
          filterCount: countActiveFilters(filtersSnapshot),
          manualFiltersActive: hasExplicitFilters(filtersSnapshot),
        },
        { sessionId: sessionIdRef.current },
      );
    },
    [availableFilters, searchParams, setSearchParams],
  );

  const handleClearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    for (const field of SUPPORTED_FILTER_FIELDS) {
      params.delete(field);
    }
    params.delete("filter");
    setSearchParams(params, { replace: true });

    trackEvent(
      "explore_filter_changed",
      {
        source: "clear_all",
        field: "all",
        value: "__cleared__",
        quickFilterId: null,
        filters: {},
        filterCount: 0,
        manualFiltersActive: false,
    },
    { sessionId: sessionIdRef.current },
    );
  }, [searchParams, setSearchParams]);

  const wineIndex = useMemo(
    () => buildWineIndex(personalScans, curatedWineLibrary),
    [personalScans, curatedWineLibrary],
  );

  const regionOptions = useMemo(() => uniqueSortedValues(wineIndex.map((scan) => scan.region)), [wineIndex]);
  const styleOptions = useMemo(() => uniqueSortedValues(wineIndex.map((scan) => scan.style)), [wineIndex]);
  const grapeOptions = useMemo(
    () => uniqueSortedValues(wineIndex.flatMap((scan) => scan.grapesList)),
    [wineIndex],
  );

  const filteredResults = useMemo(
    () => wineIndex.filter((scan) => matchesSearchFilters(scan, effectiveFilters)),
    [wineIndex, effectiveFilters],
  );

  const combinedResults = useMemo(
    () => filteredResults.slice().sort((a, b) => b.createdAtMs - a.createdAtMs),
    [filteredResults],
  );

  const hasUser = Boolean(user?.id);
  const hasPersonalScans = personalScans.length > 0;
  const showScansSkeleton =
    (hasUser && (scansLoading || (scansFetching && !hasPersonalScans))) || wineIndexFetching;
  const showEmptyState = !showScansSkeleton && combinedResults.length === 0;
  const showLoginPrompt = !hasUser;
  const showFirstScanHint = hasUser && !hasPersonalScans && !scansLoading && !scansError;
  const showScanErrorBanner = hasUser && scansError;

  useEffect(() => {
    if (exploreOpenedRef.current) return;
    trackEvent(
      "explore_opened",
      {
        hasUser: Boolean(user?.id),
        personalScanCount: personalScans.length,
        curatedScanCount: curatedWineLibrary.length,
        quickFilterCount: availableFilters.length,
        seedLibrarySource,
      },
      { sessionId: sessionIdRef.current },
    );
    exploreOpenedRef.current = true;
  }, [availableFilters.length, curatedWineLibrary.length, personalScans.length, seedLibrarySource, user?.id]);

  const handleStartNewScan = useCallback(() => {
    trackEvent(
      "explore_new_scan_cta_clicked",
      {
        manualFiltersActive,
        activeFilterCount: countActiveFilters(effectiveFilters),
        quickFilterId: highlightedFilterId,
        personalScanCount: personalScans.length,
      },
      { sessionId: sessionIdRef.current },
    );
    navigate("/scan");
  }, [effectiveFilters, highlightedFilterId, manualFiltersActive, navigate, personalScans.length]);

  const handleScanOpen = useCallback(
    (scan: ExploreScan) => {
      trackEvent(
        "explore_scan_opened",
        {
          scanId: scan.id,
          source: scan.source,
          manualFiltersActive,
          quickFilterId: highlightedFilterId,
        },
        { sessionId: sessionIdRef.current },
      );
    },
    [highlightedFilterId, manualFiltersActive],
  );

  const handleScanCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, scan: ExploreScan) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleScanOpen(scan);
      }
    },
    [handleScanOpen],
  );

  const handleRetryScans = useCallback(() => {
    if (!hasUser || scansFetching) return;
    trackEvent(
      "explore_scans_retry_requested",
      {
        quickFilterId: highlightedFilterId,
        manualFiltersActive,
        personalScanCount: personalScans.length,
      },
      { sessionId: sessionIdRef.current },
    );
    void refetchScans();
  }, [hasUser, highlightedFilterId, manualFiltersActive, personalScans.length, refetchScans, scansFetching]);

  const handleNavigateToLogin = useCallback(() => {
    trackEvent(
      "explore_login_prompt_clicked",
      {
        quickFilterId: highlightedFilterId,
        manualFiltersActive,
      },
      { sessionId: sessionIdRef.current },
    );
    navigate("/login");
  }, [highlightedFilterId, manualFiltersActive, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <AppHeader
          variant="hero"
          title={t("explore.title")}
          subtitle={t("explore.subtitle")}
          rightActions={(
            <div className="flex flex-col gap-3 sm:items-end">
              <span className="inline-flex items-center gap-2 self-start rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.2)] px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/70 sm:self-end">
                <Compass className="h-4 w-4 text-theme-primary" aria-hidden="true" />
                {t("explore.badge")}
              </span>
              <Button
                className="gap-2 rounded-full bg-theme-accent text-theme-on-accent shadow-theme-card"
                onClick={handleStartNewScan}
                aria-label={t("explore.startNewScan")}
              >
                <Camera className="h-4 w-4" />
                {t("explore.newScan")}
              </Button>
            </div>
          )}
        />

        <div className="flex flex-col gap-6 rounded-3xl border border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface-alt)/0.8)] p-8 shadow-theme-card backdrop-blur">
          <label className="flex flex-col gap-2 text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-theme-secondary/60">{t("explore.searchLabel")}</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-secondary/50" aria-hidden="true" />
              <Input
                type="search"
                placeholder={t("explore.searchPlaceholder")}
                value={paramsFilters.label ?? ""}
                onChange={(event) => handleSearchFilterChange("label", event.target.value)}
                className="h-12 rounded-full border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface)/0.2)] pl-10 text-theme-secondary placeholder:text-theme-secondary/50"
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.grapeLabel")}</Label>
              <Select
                value={effectiveFilters.grape ?? FILTER_EMPTY_VALUE}
                onValueChange={(value) => handleSearchFilterChange("grape", value)}
              >
                <SelectTrigger className="h-11 rounded-2xl border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface)/0.2)] text-left text-sm text-theme-secondary">
                  <SelectValue placeholder={t("explore.allGrapes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_EMPTY_VALUE}>{t("explore.allGrapes")}</SelectItem>
                  {grapeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.regionLabel")}</Label>
              <Select
                value={effectiveFilters.region ?? FILTER_EMPTY_VALUE}
                onValueChange={(value) => handleSearchFilterChange("region", value)}
              >
                <SelectTrigger className="h-11 rounded-2xl border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface)/0.2)] text-left text-sm text-theme-secondary">
                  <SelectValue placeholder={t("explore.allRegions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_EMPTY_VALUE}>{t("explore.allRegions")}</SelectItem>
                  {regionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.styleLabel")}</Label>
              <Select
                value={effectiveFilters.style ?? FILTER_EMPTY_VALUE}
                onValueChange={(value) => handleSearchFilterChange("style", value)}
              >
                <SelectTrigger className="h-11 rounded-2xl border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface)/0.2)] text-left text-sm text-theme-secondary">
                  <SelectValue placeholder={t("explore.allStyles")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_EMPTY_VALUE}>{t("explore.allStyles")}</SelectItem>
                  {styleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-theme-secondary/60">
              <Grip className="h-4 w-4" aria-hidden="true" />
              {t("explore.indexedBottles")}
              <span className="rounded-full bg-[hsl(var(--color-surface)/0.3)] px-2 py-0.5 text-[10px] text-theme-secondary/80">
                {wineIndex.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="self-start rounded-full border border-transparent text-theme-secondary hover:border-[hsl(var(--color-border)/0.4)] hover:bg-[hsl(var(--color-surface)/0.2)]"
            >
              {t("explore.clearFilters")}
            </Button>
          </div>
        </div>

        <section className="rounded-3xl border border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface-alt)/0.75)] p-8 shadow-theme-card backdrop-blur">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-theme-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.trendingLabel")}</p>
                <p className="text-base text-theme-secondary/80">{t("explore.trendingSubtitle")}</p>
              </div>
            </div>
            <Badge className="bg-[hsl(var(--color-surface-alt)/0.6)] text-theme-primary">{t("explore.trendingBadge")}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trendItems.map((trend) => (
              <div
                key={trend.label}
                className="rounded-2xl border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.2)] p-5 shadow-theme-card"
                role="button"
                tabIndex={0}
                onClick={() => logExploreCardOpened("trend")}
                onKeyDown={(event) => handleExploreCardKeyDown(event, "trend")}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.grapeLabel")}</p>
                <h3 className="mt-2 text-2xl font-semibold text-theme-primary">{trend.label}</h3>
                <p className="text-sm text-theme-secondary/70">{trend.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface)/0.2)] p-8 shadow-theme-card">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-theme-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.stylesLabel")}</p>
              <p className="text-base text-theme-secondary/80">{t("explore.stylesSubtitle")}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {styleItems.map((style) => (
              <div
                key={style.label}
                className="rounded-2xl border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface-alt)/0.8)] p-4"
                role="button"
                tabIndex={0}
                onClick={() => logExploreCardOpened("style")}
                onKeyDown={(event) => handleExploreCardKeyDown(event, "style")}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.styleLabel")}</p>
                <h3 className="mt-1 text-lg font-semibold text-theme-primary">{style.label}</h3>
                <p className="text-sm text-theme-secondary/70">{style.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface-alt)/0.75)] p-8 shadow-theme-card backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-theme-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">{t("explore.quickFiltersLabel")}</p>
                  <p className="text-base text-theme-secondary/80">{t("explore.quickFiltersSubtitle")}</p>
                </div>
              </div>
              <span className="text-sm text-theme-secondary/70">
                {t("explore.showingCount", { count: combinedResults.length, unit: pluralize(combinedResults.length, "explore.bottle", "explore.bottles", t) })}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {availableFilters.map((filter) => {
                const isActive = highlightedFilterId === filter.id;
                return (
                  <Button
                    key={filter.id}
                    variant={isActive ? "default" : "outline"}
                    onClick={() => handleSelectFilter(filter.id)}
                    className={`rounded-full px-4 ${
                      isActive
                        ? "bg-theme-accent text-theme-on-accent shadow-theme-card"
                        : "border-[hsl(var(--color-border)/0.5)] bg-[hsl(var(--color-surface)/0.6)] text-theme-secondary/80"
                    }`}
                    aria-pressed={isActive}
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold leading-tight">{filter.label}</span>
                      <span className="text-xs text-theme-secondary/70">
                        {filter.description}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <ExploreScanList
            scans={combinedResults}
            showSkeleton={showScansSkeleton}
            showEmptyState={showEmptyState}
            showFirstScanHint={showFirstScanHint}
            showLoginPrompt={showLoginPrompt}
            showScanErrorBanner={showScanErrorBanner}
            isRetryingScans={scansFetching}
            onScanOpen={handleScanOpen}
            onScanKeyDown={handleScanCardKeyDown}
            onClearFilters={handleClearFilters}
            onStartNewScan={handleStartNewScan}
            onNavigateToLogin={handleNavigateToLogin}
            onRetryScans={handleRetryScans}
            t={t}
            locale={locale}
          />
        </section>
      </div>
    </div>
  );
};

export default Explore;
