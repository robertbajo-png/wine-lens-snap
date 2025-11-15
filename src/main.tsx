import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/global.css";
import { applyThemeByName, themeTokensByName, type ThemeName } from "./ui/theme";

const SETTINGS_STORAGE_KEY = "winesnap.settings";
const THEME_STORAGE_KEY = "winesnap.theme";

const resolveInitialTheme = (): ThemeName => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings) as { theme?: string | null };
      if (parsed && typeof parsed.theme === "string" && parsed.theme in themeTokensByName) {
        return parsed.theme as ThemeName;
      }
    } catch (error) {
      console.warn("[Theme] Failed to parse stored settings", error);
    }
  }

  const legacyTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (legacyTheme) {
    try {
      const parsed = JSON.parse(legacyTheme) as string;
      if (parsed in themeTokensByName) {
        return parsed as ThemeName;
      }
    } catch (error) {
      console.warn("[Theme] Failed to parse stored theme", error);
      if (legacyTheme in themeTokensByName) {
        return legacyTheme as ThemeName;
      }
    }
  }

  return "dark";
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
