import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseClientOrFallback,
  getSupabaseInitError,
  onSupabaseInitFailure,
  type SupabaseInitResult,
} from "@/lib/supabaseFallback";
import type { Database } from "@/integrations/supabase/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

const initResult: SupabaseInitResult = createSupabaseClientOrFallback(
  supabaseUrl,
  supabaseAnonKey,
  (url, key) =>
    createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  { context: "core" },
);

export const supabase: SupabaseClient<Database> = initResult.client;
export const supabaseInitError = initResult.error;
export const isSupabaseFallbackClient = initResult.isFallback;
export const subscribeToSupabaseInitFailure = onSupabaseInitFailure;
export const getLatestSupabaseInitError = getSupabaseInitError;
