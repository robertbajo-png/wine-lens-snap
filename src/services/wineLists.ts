import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/integrations/supabase/types";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { normalizeAnalysisJson } from "@/lib/analysisSchema";

export type WineListSummary = {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
};

export type WineListItem = {
  id: string;
  scanId: string;
  createdAt: string;
  wine: Partial<WineAnalysisResult> | null;
  imageThumb: string | null;
};

export type WineListDetail = WineListSummary & {
  items: WineListItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parseWineAnalysis = (value: unknown): Partial<WineAnalysisResult> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const normalized = normalizeAnalysisJson(value as Partial<WineAnalysisResult>);
  return (normalized ?? (value as Partial<WineAnalysisResult>)) ?? null;
};

const extractCount = (value: unknown): number => {
  if (Array.isArray(value) && value.length > 0) {
    const candidate = value[0] as Record<string, unknown>;
    const count = candidate?.count;
    if (typeof count === "number") {
      return count;
    }
  }

  return 0;
};

export const fetchWineLists = async (): Promise<WineListSummary[]> => {
  const { data, error } = await supabase
    .from("lists")
    .select("id,name,created_at,list_items(count)")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const raw = row as Record<string, unknown> & { list_items?: unknown };
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      itemCount: extractCount(raw.list_items),
    };
  });
};

export const fetchMembershipForScan = async (scanId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("list_items")
    .select("list_id")
    .eq("scan_id", scanId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row.list_id)
    .filter((id): id is string => typeof id === "string");
};

export const createWineList = async (name: string): Promise<Tables<"lists">> => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("Ange ett namn på listan.");
  }

  if (trimmed.length > 80) {
    throw new Error("Listnamnet får högst vara 80 tecken.");
  }

  const { data, error } = await supabase
    .from("lists")
    .insert({ name: trimmed })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Kunde inte skapa listan.");
  }

  return data;
};

export const addScanToList = async (listId: string, scanId: string): Promise<void> => {
  const { error } = await supabase.from("list_items").insert({ list_id: listId, scan_id: scanId });

  if (error) {
    // Ignore duplicate insert attempts to keep UX smooth
    if (error.code === "23505") {
      return;
    }
    throw new Error(error.message);
  }
};

export const removeScanFromList = async (listId: string, scanId: string): Promise<void> => {
  const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("scan_id", scanId);

  if (error) {
    throw new Error(error.message);
  }
};

export const fetchWineListsWithItems = async (): Promise<WineListDetail[]> => {
  const { data, error } = await supabase
    .from("lists")
    .select(
      `id,name,created_at,list_items(id,scan_id,created_at,scans(id,analysis_json,image_thumb,created_at))`,
    )
    .order("created_at", { ascending: true })
    .order("created_at", { ascending: false, referencedTable: "list_items" });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const raw = row as Record<string, unknown> & { list_items?: unknown };
    const entries = Array.isArray(raw.list_items)
      ? (raw.list_items as Array<Record<string, unknown>>)
      : [];

    const items: WineListItem[] = entries
      .map((item) => {
        const scan = isRecord(item.scans) ? item.scans : null;
        const scanId = typeof item.scan_id === "string"
          ? item.scan_id
          : typeof scan?.id === "string"
            ? scan.id
            : "";

        if (!scanId) {
          return null;
        }

        return {
          id: typeof item.id === "string" ? item.id : scanId,
          scanId,
          createdAt:
            typeof item.created_at === "string"
              ? item.created_at
              : (typeof scan?.created_at === "string" ? scan.created_at : new Date().toISOString()),
          wine: parseWineAnalysis(scan?.analysis_json ?? null),
          imageThumb: typeof scan?.image_thumb === "string" ? scan.image_thumb : null,
        };
      })
      .filter((entry): entry is WineListItem => Boolean(entry));

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      itemCount: items.length,
      items,
    };
  });
};
