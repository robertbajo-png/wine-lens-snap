import { useMemo, useState } from "react";
import { DEFAULT_ERROR_MESSAGE, useErrorHandling } from "@/contexts/ErrorHandlingContext";

const buttonClasses =
  "rounded-lg border border-theme-card px-3 py-1 text-xs font-semibold text-theme-secondary transition hover:text-theme-primary";

const closeButtonClasses =
  "rounded-full p-1 text-theme-secondary transition hover:bg-theme-surface-alt hover:text-theme-primary";

export const ErrorBanner = () => {
  const { banner, hideError, isDevMode } = useErrorHandling();
  const [showDetails, setShowDetails] = useState(false);

  const details = useMemo(() => {
    if (!banner?.details) {
      return null;
    }

    if (!isDevMode) {
      return null;
    }

    return banner.details;
  }, [banner?.details, isDevMode]);

  if (!banner) {
    return null;
  }

  const headline = banner.message?.trim() || DEFAULT_ERROR_MESSAGE;

  return (
    <div className="fixed inset-x-0 top-0 z-50 px-3 py-3 sm:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-theme-card bg-theme-surface shadow-theme-card">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-theme-primary">{headline}</p>
            {details && showDetails ? (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-theme-surface-alt p-3 text-xs text-theme-secondary">
                {details}
              </pre>
            ) : null}
          </div>

          {details ? (
            <button
              type="button"
              className={buttonClasses}
              onClick={() => setShowDetails((prev) => !prev)}
            >
              {showDetails ? "Dölj detaljer" : "Visa detaljer"}
            </button>
          ) : null}

          <button type="button" aria-label="Stäng" className={closeButtonClasses} onClick={hideError}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
