export type TelemetryEventName =
  | "tab_select"
  | "scan_start"
  | "scan_success"
  | "scan_fail"
  | "history_open"
  | "profile_open";

export type TelemetryPayload = Record<string, unknown> | undefined;

export type TelemetryEvent = {
  name: TelemetryEventName;
  payload?: TelemetryPayload;
  timestamp: string;
};

const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

const logToConsole = (event: TelemetryEvent) => {
  const { name, payload, timestamp } = event;
  const prefix = "[telemetry]";
  if (isDev) {
    console.info(prefix, name, { ...payload, timestamp });
  } else {
    console.log(prefix, name, { ...payload, timestamp });
  }
};

export const trackEvent = (name: TelemetryEventName, payload?: TelemetryPayload) => {
  const event: TelemetryEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  try {
    logToConsole(event);
  } catch (error) {
    if (isDev) {
      console.warn("Telemetry logging failed", error);
    }
  }

  return event;
};
