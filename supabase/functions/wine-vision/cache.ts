import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// In-memory cache with TTL
const CACHE_TTL_MS = 1000 * 60 * 60; // 60 min
const memoryCache = new Map<string, { ts: number; data: any }>();

function normalizeOCR(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function getCacheKey(ocrText: string): string {
  const normalized = normalizeOCR(ocrText);
  return hashString(normalized.slice(0, 150));
}

// Get from in-memory cache
export function getFromMemoryCache(key: string): { data: any; note: string } | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return { data: hit.data, note: "hit_memory" };
}

// Set in-memory cache
export function setMemoryCache(key: string, data: any): void {
  memoryCache.set(key, { ts: Date.now(), data });
  // Limit cache size (max 100 entries)
  if (memoryCache.size > 100) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }
}

// Get from Supabase cache
export async function getFromSupabaseCache(
  key: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ data: any; note: string } | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from("winesnap_cache")
      .select("data, created_at")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;

    // Check TTL
    const createdAt = new Date(data.created_at).getTime();
    if (Date.now() - createdAt > CACHE_TTL_MS) {
      // Delete expired entry
      await supabase.from("winesnap_cache").delete().eq("key", key);
      return null;
    }

    return { data: data.data, note: "hit_supabase" };
  } catch (error) {
    console.error("Supabase cache read error:", error);
    return null;
  }
}

// Set in Supabase cache
export async function setSupabaseCache(
  key: string,
  cacheData: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase
      .from("winesnap_cache")
      .upsert({ key, data: cacheData }, { onConflict: "key" });
  } catch (error) {
    console.error("Supabase cache write error:", error);
  }
}
