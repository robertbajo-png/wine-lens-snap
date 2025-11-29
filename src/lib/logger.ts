import { supabase } from "@/lib/supabaseClient";
import { getAuthContextUserId } from "@/auth/authContextBridge";
import type { Json } from "@/integrations/supabase/types";

const isBrowser = typeof window !== "undefined";

const serializeJson = (payload?: Record<string, unknown>): Json => {
  if (!payload) return {};

  try {
    return JSON.parse(JSON.stringify(payload)) as Json;
  } catch (_error) {
    return { note: "serialization_failed" } as Json;
  }
};

const resolveUserId = async (providedUserId?: string | null): Promise<string | null> => {
  if (providedUserId !== undefined) {
    return providedUserId;
  }

  const authContextUserId = getAuthContextUserId();
  if (authContextUserId !== null) {
    return authContextUserId;
  }

  if (!isBrowser) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (import.meta.env.DEV) {
      console.info("log: could not resolve user id", error.message);
    }
    return null;
  }

  return data.user?.id ?? null;
};

export type LogLevel = "error" | "warning" | "info";

export const logEvent = async (
  eventType: string,
  payload?: Record<string, unknown>,
  options?: { userId?: string | null },
) => {
  try {
    const userId = await resolveUserId(options?.userId);
    await supabase.from("event_logs").insert({
      event_name: eventType,
      properties: serializeJson(payload),
      user_id: userId,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Event logging failed", error);
    }
  }
};

export const logError = async (
  view: string,
  action: string,
  message: string,
  details?: Record<string, unknown>,
  options?: { level?: LogLevel; userId?: string | null },
) => {
  try {
    const userId = await resolveUserId(options?.userId);
    if (!userId) {
      if (import.meta.env.DEV) {
        console.info("client_logs skipped – no authenticated user");
      }
      return;
    }

    await supabase.from("client_logs").insert({
      view,
      action,
      level: options?.level ?? "error",
      message,
      details: serializeJson(details),
      user_id: userId,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Error logging failed", error);
    }
  }
};
