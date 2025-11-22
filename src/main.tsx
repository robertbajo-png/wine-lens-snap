import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/global.css";
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
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.error("[PWA] Service Worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
