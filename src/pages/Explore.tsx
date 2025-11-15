import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Compass, Filter, Flame, Grip, Search, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/integrations/supabase/types";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { useAuth } from "@/auth/AuthProvider";

const SEARCH_PLACEHOLDER = "Sök snart bland tusentals etiketter";
const TREND_LIMIT = 3;
const STYLE_LIMIT = 4;
const MAX_SCANS_FETCH = 120;

const categories = ["Druvor", "Regioner", "Stilar", "Matmatchning", "Prisnivåer", "Butiker"];

type QuickFilterField = "grape" | "style" | "region";

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

const deriveTrends = (scans: ExploreScan[]): AggregationItem[] => {
  const counts = new Map<string, number>();
  for (const scan of scans) {
    for (const grape of scan.grapesList) {
      const key = grape.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TREND_LIMIT)
    .map(([label, count]) => ({
      label,
      detail: `${count} ${pluralize(count, "skanning", "skanningar")}`,
      count,
    }));
};

const deriveStyles = (scans: ExploreScan[]): AggregationItem[] => {
  const counts = new Map<string, number>();
  for (const scan of scans) {
    const style = scan.style?.trim();
    if (!style) continue;
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, STYLE_LIMIT)
    .map(([label, count]) => ({
      label,
      detail: `${count} ${pluralize(count, "träff", "träffar")}`,
      count,
    }));
};

const matchesFilter = (scan: ExploreScan, filter: QuickFilter): boolean => {
  const target = filter.value.toLowerCase();
  if (filter.field === "grape") {
    return scan.grapesList.some((grape) => grape.toLowerCase().includes(target));
  }
  if (filter.field === "style") {
    return (scan.style ?? "").toLowerCase().includes(target);
  }
  if (filter.field === "region") {
    return (scan.region ?? "").toLowerCase().includes(target);
  }
  return false;
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

  const {
    data: scanRows = [],
    isLoading: scansLoading,
    isError: scansError,
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

  const trendItems = useMemo(() => {
    const trends = deriveTrends(personalScans);
    if (trends.length > 0) return trends;
    if (serverTrends.length > 0) return serverTrends;
    return FALLBACK_TRENDS;
  }, [personalScans, serverTrends]);

  const styleItems = useMemo(() => {
    const styles = deriveStyles(personalScans);
    if (styles.length > 0) return styles;
    if (serverStyles.length > 0) return serverStyles;
    return FALLBACK_STYLES;
  }, [personalScans, serverStyles]);

  const activeFilter = useMemo(() => {
    const param = searchParams.get("filter");
    return (
      availableFilters.find((filter) => filter.id === param) ??
      availableFilters[0] ??
      FALLBACK_QUICK_FILTERS[0]!
    );
  }, [searchParams, availableFilters]);

  const handleSelectFilter = (filterId: string) => {
    const next = availableFilters.find((filter) => filter.id === filterId);
    if (!next) return;
    const params = new URLSearchParams(searchParams);
    params.set("filter", filterId);
    setSearchParams(params, { replace: true });
  };

  const personalMatches = useMemo(
    () => personalScans.filter((scan) => matchesFilter(scan, activeFilter)),
    [personalScans, activeFilter],
  );

  const curatedMatches = useMemo(
    () => curatedSeedLibrary.filter((scan) => matchesFilter(scan, activeFilter)),
    [activeFilter, curatedSeedLibrary],
  );

  const combinedResults = useMemo(
    () => [...personalMatches, ...curatedMatches].sort((a, b) => b.createdAtMs - a.createdAtMs),
    [personalMatches, curatedMatches],
  );

  const showEmptyState = !scansLoading && combinedResults.length === 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="absolute right-4 top-6 z-20">
        <Button
          className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
          onClick={() => navigate("/scan")}
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
                disabled
                className="h-12 rounded-full border-theme-card/60 bg-theme-card/20 pl-10 text-theme-secondary/70 placeholder:text-theme-secondary/50"
              />
            </div>
          </label>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-theme-secondary/60">
              <Grip className="h-4 w-4" aria-hidden="true" />
              Kategorier
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant="outline"
                  disabled
                  className="cursor-not-allowed rounded-full border-theme-card/50 bg-theme-card/20 px-4 text-sm font-medium text-theme-secondary/70"
                >
                  {category}
                </Button>
              ))}
            </div>
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
                const isActive = filter.id === activeFilter.id;
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
            {scansLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl bg-theme-card/30" />
                ))}
              </div>
            )}

            {!scansLoading &&
              combinedResults.map((scan) => (
                <article
                  key={`${scan.source}-${scan.id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-theme-card/40 bg-theme-card/20 p-4 sm:flex-row sm:items-center"
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
              <div className="rounded-2xl border border-dashed border-theme-card/60 bg-theme-card/10 p-6 text-center text-sm text-theme-secondary/70">
                Inga skanningar matchar filtret ännu. Fortsätt fota etiketter eller välj ett annat fokus.
              </div>
            )}

            {!user && (
              <div className="rounded-2xl border border-theme-card/50 bg-theme-card/20 p-4 text-sm text-theme-secondary/80">
                Logga in för att se dina egna skanningar i listan. Kuraterade tips visas alltid.
              </div>
            )}

            {scansError && (
              <div className="rounded-2xl border border-theme-card/50 bg-theme-card/20 p-4 text-sm text-theme-secondary/80">
                Kunde inte läsa dina skanningar just nu. Vi visar endast kuraterade flaskor tills vidare.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Explore;
