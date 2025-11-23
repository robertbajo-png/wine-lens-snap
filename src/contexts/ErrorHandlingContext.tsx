import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { logError } from "@/lib/errorLogger";

export type ErrorBannerPayload = {
  message: string;
  details?: string;
  error?: unknown;
  source?: string;
  isCritical?: boolean;
};

export type ErrorHandlingContextValue = {
  banner: ErrorBannerPayload | null;
  showError: (message: string, options?: Omit<ErrorBannerPayload, "message">) => void;
  showErrorFromError: (error: unknown, options?: { message?: string; source?: string }) => void;
  hideError: () => void;
  isDevMode: boolean;
};

const DEFAULT_MESSAGE = "Något gick fel. Försök igen.";

const ErrorHandlingContext = createContext<ErrorHandlingContextValue | undefined>(undefined);

export const ErrorHandlingProvider = ({ children }: { children: ReactNode }) => {
  const [banner, setBanner] = useState<ErrorBannerPayload | null>(null);
  const isDevMode = import.meta.env.MODE !== "production";

  const showError = useCallback(
    (message: string, options?: Omit<ErrorBannerPayload, "message">) => {
      const nextBanner: ErrorBannerPayload = {
        message: message || DEFAULT_MESSAGE,
        ...options,
      };

      if (nextBanner.error) {
        logError(nextBanner.error, nextBanner.source ?? "Error banner");
      }

      if (nextBanner.details && nextBanner.details !== nextBanner.message) {
        logError(nextBanner.details, `${nextBanner.source ?? "Error banner"} details`);
      }

      setBanner(nextBanner);
    },
    [],
  );

  const showErrorFromError = useCallback(
    (error: unknown, options?: { message?: string; source?: string }) => {
      const fallbackMessage = options?.message ?? DEFAULT_MESSAGE;
      let details: string | undefined;

      if (error) {
        if (error instanceof Error) {
          details = `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
        } else if (typeof error === "string") {
          details = error;
        } else if (typeof error === "object") {
          details = JSON.stringify(error);
        }

        logError(error, options?.source ?? "Async error");
      }

      showError(fallbackMessage, { details, error, source: options?.source });
    },
    [showError],
  );

  const hideError = useCallback(() => setBanner(null), []);

  const value = useMemo<ErrorHandlingContextValue>(
    () => ({ banner, showError, showErrorFromError, hideError, isDevMode }),
    [banner, hideError, isDevMode, showError, showErrorFromError],
  );

  return <ErrorHandlingContext.Provider value={value}>{children}</ErrorHandlingContext.Provider>;
};

export const useErrorHandling = () => {
  const context = useContext(ErrorHandlingContext);

  if (!context) {
    throw new Error("useErrorHandling must be used within an ErrorHandlingProvider");
  }

  return context;
};

export const DEFAULT_ERROR_MESSAGE = DEFAULT_MESSAGE;
