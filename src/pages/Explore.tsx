import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
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
import { useAuth } from "@/auth/AuthProvider";
import { trackEvent } from "@/lib/telemetry";

const SEARCH_PLACEHOLDER = "Sök bland etiketter, producenter eller anteckningar";
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
type ExploreSeedCardRow = Tables<"explore_seed_cards">;

const cleanFilterValue = (value?: string | null) => value?.trim() ?? "";

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

const pluralize = (count: number, singular: string, plural: string) =>
  count === 1 ? singular : plural;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const normalizeScanRow = (row: ScanRow): ExploreScan => {
  const analysis = (row.analysis_json as WineAnalysisResult | null) ?? null;
  const createdAt = row.created_at ?? new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);

  const grapesRaw = analysis?.druvor ?? null;
  const grapesList = parseGrapes(grapesRaw);

  return {
    id: row.id,
    title: analysis?.vin ?? "Okänd etikett",
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

const deriveTrendingRegions = (scans: ExploreScan[]): AggregationItem[] => {
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
      detail: `${item.count} ${pluralize(item.count, "skanning", "skanningar")} senaste ${weeks} veckorna`,
      count: item.count,
    }));
};

const derivePopularStyles = (scans: ExploreScan[]): AggregationItem[] => {
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
      return a.label.localeCompare(b.label, "sv", { sensitivity: "base" });
    })
    .slice(0, STYLE_LIMIT)
    .map((item) => ({
      label: item.label,
      detail: `${item.count} ${pluralize(item.count, "träff", "träffar")} totalt`,
      count: item.count,
    }));
};

const formatRelativeTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "nyligen";

  const diffMs = date.getTime() - Date.now();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];

  const rtf = new Intl.RelativeTimeFormat("sv", { numeric: "auto" });

  for (const [unit, unitMs] of units) {
    if (Math.abs(diffMs) >= unitMs || unit === "minute") {
      const value = Math.round(diffMs / unitMs);
      return rtf.format(value, unit);
    }
  }

  return "nyligen";
};

const fetchRecentScans = async (): Promise<ScanRow[]> => {
  const { data, error } = await supabase
    .from("scans")
    .select("id,created_at,analysis_json,image_thumb")
    .order("created_at", { ascending: false })
    .limit(MAX_SCANS_FETCH);

  if (error) {
    throw error;
  }

  return data ?? [];
};

const fetchExploreSeedCards = async (): Promise<ExploreSeedCardRow[]> => {
  const { data, error } = await supabase
    .from("explore_seed_cards")
    .select("id,created_at,type,payload_json")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

const Explore = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionIdRef = useRef<string>();
  const exploreOpenedRef = useRef(false);

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

  const { data: seedCards = [] } = useQuery({
    queryKey: ["explore", "seed-cards"],
    queryFn: fetchExploreSeedCards,
    staleTime: 1000 * 60 * 5,
  });

  const personalScans = useMemo(() => (scanRows ?? []).map((row) => normalizeScanRow(row)), [scanRows]);

  const serverSeedLibrary = useMemo(
    () =>
      (seedCards ?? [])
        .filter((card) => card.type === "seed_scan")
        .map((card) => parseSeedScanPayload(card.payload_json))
        .filter((card): card is ExploreScan => Boolean(card)),
    [seedCards],
  );

  const curatedSeedLibrary = serverSeedLibrary.length > 0 ? serverSeedLibrary : FALLBACK_CURATED_LIBRARY;

  const serverTrends = useMemo(
    () =>
      (seedCards ?? [])
        .filter((card) => card.type === "trending_region")
        .map((card) => parseAggregationPayload(card.payload_json))
        .filter((item): item is AggregationItem => Boolean(item)),
    [seedCards],
  );

  const serverStyles = useMemo(
    () =>
      (seedCards ?? [])
        .filter((card) => card.type === "popular_style")
        .map((card) => parseAggregationPayload(card.payload_json))
        .filter((item): item is AggregationItem => Boolean(item)),
    [seedCards],
  );

  const serverQuickFilters = useMemo(
    () =>
      (seedCards ?? [])
        .filter((card) => card.type === "quick_filter")
        .map((card) => parseQuickFilterPayload(card.payload_json))
        .filter((item): item is QuickFilter => Boolean(item)),
    [seedCards],
  );

  const availableFilters = serverQuickFilters.length > 0 ? serverQuickFilters : FALLBACK_QUICK_FILTERS;
  const defaultQuickFilter = availableFilters[0] ?? FALLBACK_QUICK_FILTERS[0]!;

  const trendItems = useMemo(() => {
    const trends = deriveTrendingRegions(personalScans);
    if (trends.length > 0) return trends;
    if (serverTrends.length > 0) return serverTrends;
    return FALLBACK_TRENDS;
  }, [personalScans, serverTrends]);

  const styleItems = useMemo(() => {
    const styles = derivePopularStyles(personalScans);
    if (styles.length > 0) return styles;
    if (serverStyles.length > 0) return serverStyles;
    return FALLBACK_STYLES;
  }, [personalScans, serverStyles]);

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

  const handleSelectFilter = (filterId: string) => {
    const next = availableFilters.find((filter) => filter.id === filterId);
    if (!next) return;
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
  };

  const handleSearchFilterChange = (field: SearchFilterField, value: string) => {
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
  };

  const handleClearFilters = () => {
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
  };

  const wineIndex = useMemo(
    () => buildWineIndex(personalScans, curatedSeedLibrary),
    [personalScans, curatedSeedLibrary],
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
  const showScansSkeleton = hasUser && (scansLoading || (scansFetching && !hasPersonalScans));
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
        curatedScanCount: curatedSeedLibrary.length,
        quickFilterCount: availableFilters.length,
        seedLibrarySource: serverSeedLibrary.length > 0 ? "remote" : "fallback",
      },
      { sessionId: sessionIdRef.current },
    );
    exploreOpenedRef.current = true;
  }, [availableFilters.length, curatedSeedLibrary.length, personalScans.length, serverSeedLibrary.length, user?.id]);

  const handleStartNewScan = () => {
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
  };

  const handleScanOpen = (scan: ExploreScan) => {
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
  };

  const handleScanCardKeyDown = (event: KeyboardEvent<HTMLElement>, scan: ExploreScan) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleScanOpen(scan);
    }
  };

  const handleRetryScans = () => {
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
  };

  const handleNavigateToLogin = () => {
    trackEvent(
      "explore_login_prompt_clicked",
      {
        quickFilterId: highlightedFilterId,
        manualFiltersActive,
      },
      { sessionId: sessionIdRef.current },
    );
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="absolute right-4 top-6 z-20">
        <Button
          className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
          onClick={handleStartNewScan}
          aria-label="Starta ny skanning"
        >
          <Camera className="h-4 w-4" />
          Ny skanning
        </Button>
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/20 px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/70">
            <Compass className="h-4 w-4 text-theme-primary" aria-hidden="true" />
            Utforska
          </span>
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Snart öppnar vinbiblioteket</h1>
          <p className="mx-auto max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
            Vi förbereder ett flöde med trender, stilar och filter så att du snabbt hittar flaskor som matchar din smak.
            Upplevelsen är statisk idag men kopplad till riktiga skanningar där det finns data.
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-3xl border border-theme-card/60 bg-theme-elevated/80 p-8 backdrop-blur">
          <label className="flex flex-col gap-2 text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-theme-secondary/60">Sök i vinarkivet</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-secondary/50" aria-hidden="true" />
              <Input
                type="search"
                placeholder={SEARCH_PLACEHOLDER}
                value={paramsFilters.label ?? ""}
                onChange={(event) => handleSearchFilterChange("label", event.target.value)}
                className="h-12 rounded-full border-theme-card/60 bg-theme-card/20 pl-10 text-theme-secondary placeholder:text-theme-secondary/50"
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Druva</Label>
              <Select value={effectiveFilters.grape ?? FILTER_EMPTY_VALUE} onValueChange={(value) => handleSearchFilterChange("grape", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-theme-card/50 bg-theme-card/20 text-left text-sm text-theme-secondary">
                  <SelectValue placeholder="Alla druvor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_EMPTY_VALUE}>Alla druvor</SelectItem>
                  {grapeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Region</Label>
              <Select value={effectiveFilters.region ?? FILTER_EMPTY_VALUE} onValueChange={(value) => handleSearchFilterChange("region", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-theme-card/50 bg-theme-card/20 text-left text-sm text-theme-secondary">
                  <SelectValue placeholder="Alla regioner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_EMPTY_VALUE}>Alla regioner</SelectItem>
                  {regionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Stil</Label>
              <Select value={effectiveFilters.style ?? FILTER_EMPTY_VALUE} onValueChange={(value) => handleSearchFilterChange("style", value)}>
                <SelectTrigger className="h-11 rounded-2xl border-theme-card/50 bg-theme-card/20 text-left text-sm text-theme-secondary">
                  <SelectValue placeholder="Alla stilar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_EMPTY_VALUE}>Alla stilar</SelectItem>
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
              Indexerade flaskor
              <span className="rounded-full bg-theme-card/30 px-2 py-0.5 text-[10px] text-theme-secondary/80">
                {wineIndex.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="self-start rounded-full border border-transparent text-theme-secondary hover:border-theme-card/40 hover:bg-theme-card/20"
            >
              Rensa filter
            </Button>
          </div>
        </div>

        <section className="rounded-3xl border border-theme-card/50 bg-theme-elevated/70 p-8 backdrop-blur">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Flame className="h-5 w-5 text-theme-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Trendar</p>
                <p className="text-base text-theme-secondary/80">Mest skannade druvor just nu</p>
              </div>
            </div>
            <Badge className="bg-theme-card/60 text-theme-primary">Live från dina senaste skanningar</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trendItems.map((trend) => (
              <div
                key={trend.label}
                className="rounded-2xl border border-theme-card/40 bg-theme-card/20 p-5 shadow-[0_18px_45px_-30px_rgba(123,63,228,0.9)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Druva</p>
                <h3 className="mt-2 text-2xl font-semibold text-theme-primary">{trend.label}</h3>
                <p className="text-sm text-theme-secondary/70">{trend.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-theme-card/50 bg-theme-card/20 p-8">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-theme-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Populära stilar</p>
              <p className="text-base text-theme-secondary/80">Kuraterade inspel från redaktionen</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {styleItems.map((style) => (
              <div key={style.label} className="rounded-2xl border border-theme-card/40 bg-theme-elevated/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-theme-secondary/60">Stil</p>
                <h3 className="mt-1 text-lg font-semibold text-theme-primary">{style.label}</h3>
                <p className="text-sm text-theme-secondary/70">{style.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-theme-card/50 bg-theme-elevated/70 p-8 backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-theme-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/60">Snabbfilter</p>
                  <p className="text-base text-theme-secondary/80">Välj ett fokus för listan</p>
                </div>
              </div>
              <span className="text-sm text-theme-secondary/70">
                Visar {combinedResults.length} {pluralize(combinedResults.length, "flaska", "flaskor")}
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
                        ? "bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary"
                        : "border-theme-card/50 bg-theme-card/20 text-theme-secondary/80"
                    }`}
                    aria-pressed={isActive}
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold">{filter.label}</span>
                      <span className="text-[11px] uppercase tracking-[0.3em] text-theme-secondary/60">
                        {filter.description}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {showScansSkeleton && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-theme-card/30" />
                ))}
              </div>
            )}

            {!showScansSkeleton &&
              combinedResults.map((scan) => (
                <article
                  key={`${scan.source}-${scan.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Öppna ${scan.title}`}
                  onClick={() => handleScanOpen(scan)}
                  onKeyDown={(event) => handleScanCardKeyDown(event, scan)}
                  className="flex cursor-pointer flex-col gap-4 rounded-2xl border border-theme-card/40 bg-theme-card/20 p-4 outline-none transition hover:border-theme-primary/50 focus-visible:ring-2 focus-visible:ring-theme-primary/60 sm:flex-row sm:items-center"
                >
                  <div className="flex w-full flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-theme-secondary/60">
                      <span>{scan.source === "mine" ? "Min skanning" : "Kuraterat"}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(scan.createdAt)}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-theme-primary">{scan.title}</h3>
                    <p className="text-sm text-theme-secondary/80">
                      {[scan.producer, scan.region].filter(Boolean).join(" • ") || "Okänt ursprung"}
                    </p>
                    {scan.notes && <p className="text-sm text-theme-secondary/70">{scan.notes}</p>}
                  </div>
                  <div className="flex flex-col items-start gap-2 text-sm text-theme-secondary/70 sm:items-end">
                    {scan.grapesRaw && <span>{scan.grapesRaw}</span>}
                    {scan.style && (
                      <span className="rounded-full border border-theme-card/40 px-3 py-1 text-xs uppercase tracking-[0.3em]">
                        {scan.style}
                      </span>
                    )}
                  </div>
                </article>
              ))}

            {showEmptyState && (
              <Banner
                type="info"
                title="Inga flaskor matchar filtret"
                text="Justera sökningen eller nollställ filtren för att få fler träffar."
                ctaLabel="Rensa filter"
                onCta={handleClearFilters}
                className="border-dashed"
              />
            )}

            {showFirstScanHint && (
              <Banner
                type="info"
                title="Gör en första skanning"
                text="Vi visar redaktionens favoriter tills du fotar din första etikett. Då blir Explore personligt anpassad."
                ctaLabel="Starta skanning"
                onCta={handleStartNewScan}
              />
            )}

            {showLoginPrompt && (
              <Banner
                type="info"
                title="Logga in för att låsa upp historiken"
                text="Kuraterade tips visas alltid, men dina egna skanningar kräver ett konto."
                ctaLabel="Till inloggning"
                onCta={handleNavigateToLogin}
              />
            )}

            {showScanErrorBanner && (
              <Banner
                type="error"
                title="Kan inte läsa dina skanningar"
                text="Din uppkoppling verkar svaja. Vi visar tills vidare kuraterade flaskor."
                ctaLabel={scansFetching ? "Försöker igen..." : "Försök igen"}
                onCta={handleRetryScans}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Explore;
