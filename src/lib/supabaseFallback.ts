import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { logError as logConsoleError } from "@/lib/errorLogger";

type FallbackListener = (error: Error) => void;

const fallbackListeners = new Set<FallbackListener>();

let lastFallbackError: Error | null = null;

const recordFallbackTelemetry = (error: Error, context?: string) => {
  const label = context ? `Supabase (${context})` : "Supabase";
  logConsoleError(error, `${label} init`);

  console.warn(`[${label}] Fallback client activated: ${error.message}`);

  if (typeof window === "undefined") {
    return;
  }

  try {
    const key = context ? `supabase_fallback_${context}` : "supabase_fallback";
    const current = Number.parseInt(window.sessionStorage.getItem(key) ?? "0", 10);
    window.sessionStorage.setItem(key, String(current + 1));
  } catch (storageError) {
    console.debug("[Supabase] Could not persist fallback telemetry", storageError);
  }
};

const notifyFallback = (error: Error) => {
  lastFallbackError = error;

  fallbackListeners.forEach((listener) => {
    try {
      listener(error);
    } catch (listenerError) {
      console.error("[Supabase] Fallback listener failed", listenerError);
    }
  });
};

const createNoopPromise = async <T>(error: Error) => ({ data: null as T | null, error });

const createNoopQueryBuilder = <T>(error: Error) => {
  const result = createNoopPromise<T>(error);
  const chainable = {
    then: result.then.bind(result),
    catch: result.catch.bind(result),
    finally: result.finally.bind(result),
  } as const;

  return new Proxy(chainable, {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return (result as never)[prop].bind(result);
      }

      return (..._args: unknown[]) => createNoopQueryBuilder<T>(error);
    },
  });
};

const createNoopStorageClient = (error: Error) => ({
  upload: async () => ({ data: null, error }),
  getPublicUrl: () => ({ data: { publicUrl: "" }, error, publicUrl: "" }),
});

export const createFallbackSupabaseClient = (
  error: Error,
  options?: { context?: string },
): SupabaseClient<Database> => {
  recordFallbackTelemetry(error, options?.context);
  notifyFallback(error);

  const fallbackError = error;
  const subscription = { unsubscribe: () => {} };

  const client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: fallbackError }),
      onAuthStateChange: () => ({ data: { subscription }, error: fallbackError }),
      signInWithOtp: async () => ({ data: null, error: fallbackError }),
      signInWithOAuth: async () => ({ data: null, error: fallbackError }),
      signOut: async () => ({ error: fallbackError }),
      getUser: async () => ({ data: { user: null }, error: fallbackError }),
    },
    from: () => createNoopQueryBuilder<unknown>(fallbackError),
    rpc: async () => ({ data: null, error: fallbackError }),
    functions: {
      invoke: async () => ({ data: null, error: fallbackError }),
    },
    storage: {
      from: () => createNoopStorageClient(fallbackError),
    },
  };

  return client as SupabaseClient<Database>;
};

export type SupabaseInitResult = {
  client: SupabaseClient<Database>;
  error: Error | null;
  isFallback: boolean;
};

export const createSupabaseClientOrFallback = (
  supabaseUrl: string | undefined,
  supabaseKey: string | undefined,
  factory: (url: string, key: string) => SupabaseClient<Database>,
  options?: { context?: string },
): SupabaseInitResult => {
  if (!supabaseUrl || !supabaseKey) {
    const missingVars = [
      !supabaseUrl ? "VITE_SUPABASE_URL" : null,
      !supabaseKey ? "VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY" : null,
    ].filter(Boolean);
    const error = new Error(`Missing Supabase configuration (${missingVars.join(", ")})`);
    return {
      client: createFallbackSupabaseClient(error, options),
      error,
      isFallback: true,
    };
  }

  try {
    return { client: factory(supabaseUrl, supabaseKey), error: null, isFallback: false };
  } catch (maybeError) {
    const error = maybeError instanceof Error ? maybeError : new Error(String(maybeError));
    return {
      client: createFallbackSupabaseClient(error, options),
      error,
      isFallback: true,
    };
  }
};

export const onSupabaseInitFailure = (listener: FallbackListener) => {
  fallbackListeners.add(listener);
  return () => fallbackListeners.delete(listener);
};

export const getSupabaseInitError = () => lastFallbackError;
