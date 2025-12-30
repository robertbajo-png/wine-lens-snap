import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./styles/global.css";
import { logEvent } from "./lib/logger";
import {
  applyThemeByName,
  detectSystemTheme,
  themeTokensByName,
  type ThemeName,
  type ThemePreference,
} from "./ui/theme";

const SETTINGS_STORAGE_KEY = "winesnap.settings";
const THEME_STORAGE_KEY = "winesnap_theme";
const LEGACY_THEME_STORAGE_KEY = "winesnap.theme";
const SW_VERSION = "v3"; // Keep in sync with public/sw.js

type ServiceWorkerPayload = {
  type: "SKIP_WAITING";
};

const sanitizePreference = (theme?: string | null): ThemePreference => {
  if (!theme) {
    return "system";
  }

  if (theme === "system") {
    return "system";
  }

  return theme in themeTokensByName ? (theme as ThemeName) : "system";
};

const resolveStoredPreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings) as { theme?: string | null };
      return sanitizePreference(parsed?.theme);
    } catch (error) {
      console.warn("[Theme] Failed to parse stored settings", error);
    }
  }

  const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedPreference) {
    return sanitizePreference(storedPreference);
  }

  const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacyTheme) {
    try {
      const parsed = JSON.parse(legacyTheme) as string;
      return sanitizePreference(parsed);
    } catch (error) {
      console.warn("[Theme] Failed to parse stored theme", error);
      return sanitizePreference(legacyTheme);
    }
  }

  return "system";
};

const resolveInitialTheme = (): ThemeName => {
  const preference = resolveStoredPreference();
  if (preference === "system") {
    return detectSystemTheme();
  }

  return preference;
};

// Apply the chosen app theme globally (default: dark)
applyThemeByName(resolveInitialTheme());

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const root = document.getElementById("root");
    let hasRefreshed = false;
    let shouldReloadOnControllerChange = false;
    let updateBanner: HTMLElement | null = null;

    const removeBanner = () => {
      if (updateBanner?.parentNode) {
        updateBanner.parentNode.removeChild(updateBanner);
      }
      updateBanner = null;
    };

    const showUpdateBanner = (onReload: () => void) => {
      removeBanner();

      const banner = document.createElement("div");
      banner.style.position = "fixed";
      banner.style.inset = "16px auto auto 50%";
      banner.style.transform = "translateX(-50%)";
      banner.style.zIndex = "2147483647";
      banner.style.maxWidth = "640px";
      banner.style.width = "calc(100% - 32px)";
      banner.style.background = "rgba(17, 24, 39, 0.95)";
      banner.style.color = "#F9FAFB";
      banner.style.border = "1px solid #374151";
      banner.style.borderRadius = "16px";
      banner.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";
      banner.style.backdropFilter = "blur(8px)";
      banner.style.padding = "16px";
      banner.style.display = "flex";
      banner.style.flexWrap = "wrap";
      banner.style.gap = "12px";
      banner.style.alignItems = "center";

      const message = document.createElement("div");
      message.style.flex = "1 1 240px";
      message.style.fontSize = "14px";
      message.style.lineHeight = "20px";
      message.textContent = "En ny version finns. Ladda om för att få senaste uppdateringarna.";

      const reloadButton = document.createElement("button");
      reloadButton.type = "button";
      reloadButton.textContent = "Uppdatera nu";
      reloadButton.style.background = "#8B5CF6";
      reloadButton.style.color = "#F9FAFB";
      reloadButton.style.border = "none";
      reloadButton.style.borderRadius = "999px";
      reloadButton.style.padding = "10px 16px";
      reloadButton.style.fontWeight = "700";
      reloadButton.style.cursor = "pointer";
      reloadButton.onclick = () => {
        onReload();
        removeBanner();
      };

      const laterButton = document.createElement("button");
      laterButton.type = "button";
      laterButton.textContent = "Påminn mig senare";
      laterButton.style.background = "transparent";
      laterButton.style.color = "#E5E7EB";
      laterButton.style.border = "1px solid #4B5563";
      laterButton.style.borderRadius = "999px";
      laterButton.style.padding = "10px 16px";
      laterButton.style.cursor = "pointer";
      laterButton.onclick = removeBanner;

      banner.appendChild(message);
      banner.appendChild(reloadButton);
      banner.appendChild(laterButton);

      updateBanner = banner;
      document.body.appendChild(banner);
    };

    const applyUpdate = (worker: ServiceWorker) => {
      void logEvent("sw_update_accepted", { version: SW_VERSION });
      shouldReloadOnControllerChange = true;
      worker.postMessage({ type: "SKIP_WAITING" } satisfies ServiceWorkerPayload);
    };

    const reloadWhenControlled = () => {
      if (!shouldReloadOnControllerChange || hasRefreshed) return;
      hasRefreshed = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadWhenControlled);

    navigator.serviceWorker
      .register("/sw.js?version=" + SW_VERSION)
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);

        const promptForUpdate = (waitingWorker: ServiceWorker) => {
          void logEvent("sw_update_available", { version: SW_VERSION });
          showUpdateBanner(() => applyUpdate(waitingWorker));
        };

        if (registration.waiting) {
          promptForUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                promptForUpdate(installingWorker);
              } else if (root) {
                // First install, claim control without reload
                installingWorker.postMessage({ type: "SKIP_WAITING" } satisfies ServiceWorkerPayload);
              }
            }
          });
        });
      })
      .catch((error) => {
        void logEvent("sw_registration_failed", {
          version: SW_VERSION,
          message: error instanceof Error ? error.message : String(error),
        });
        console.error("[PWA] Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
