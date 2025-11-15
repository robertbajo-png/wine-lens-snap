import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/global.css";
import { applyThemeByName, themeTokensByName, type ThemeName } from "./ui/theme";

const resolveInitialTheme = (): ThemeName => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem("winesnap.theme");
  if (storedTheme) {
    try {
      const parsed = JSON.parse(storedTheme) as ThemeName;
      if (parsed in themeTokensByName) {
        return parsed;
      }
    } catch (error) {
      console.warn("[Theme] Failed to parse stored theme", error);
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
