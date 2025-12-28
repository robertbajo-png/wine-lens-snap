import { supabase } from "@/lib/supabaseClient";
import type { Json } from "@/integrations/supabase/types";

export type TelemetryEventName =
  | "tab_select"
  | "scan_start"
  | "scan_succeeded"
  | "scan_failed"
  | "history_open"
  | "profile_open"
  | "premium_cta_clicked"
  | "premium_checkout_started"
  | "premium_checkout_payment_started"
  | "premium_checkout_completed"
  | "premium_checkout_failed"
  | "premium_checkout_cancelled"
  | "explore_opened"
  | "explore_filter_changed"
  | "explore_scan_opened"
  | "explore_new_scan_cta_clicked"
  | "explore_scans_retry_requested"
  | "explore_login_prompt_clicked"
  | "analysis_cache_hit"
  | "analysis_parse_failed"
  | "analysis_label_only_fallback"
  | "sync_attempt"
  | "sync_completed"
  | "sync_failed"
  | "sync_offline_skip"
  | "sync_backoff_scheduled";

export type TelemetryPayload = Record<string, unknown> | undefined;

export type TelemetryContext = {
  sessionId?: string | null;
};

export type TelemetryEvent = {
  name: TelemetryEventName;
  payload?: TelemetryPayload;
  timestamp: string;
  context?: TelemetryContext;
};

const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
const isBrowser = typeof window !== "undefined";

const logToConsole = (event: TelemetryEvent) => {
  const { name, payload, timestamp } = event;
  const prefix = "[telemetry]";
  if (isDev) {
    console.info(prefix, name, { ...payload, timestamp });
  } else {
    console.log(prefix, name, { ...payload, timestamp });
  }
};

const persistEvent = async (event: TelemetryEvent) => {
  try {
    await supabase.from("telemetry_events").insert([{
      event_name: event.name,
      payload_json: (event.payload ?? {}) as Json,
      occurred_at: event.timestamp,
      session_id: event.context?.sessionId ?? null,
    }]);
  } catch (error) {
    if (isDev) {
      console.warn("Telemetry persistence failed", error);
    }
  }
};

const schedulePersistence = (event: TelemetryEvent) => {
  if (!isBrowser) return;
  const runner = () => {
    void persistEvent(event);
  };
  if (typeof queueMicrotask === "function") {
    queueMicrotask(runner);
  } else {
    setTimeout(runner, 0);
  }
};

export const trackEvent = (
  name: TelemetryEventName,
  payload?: TelemetryPayload,
  context?: TelemetryContext,
) => {
  const event: TelemetryEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
    context,
  };

  try {
    logToConsole(event);
  } catch (error) {
    if (isDev) {
      console.warn("Telemetry logging failed", error);
    }
  }

  schedulePersistence(event);

  return event;
};
