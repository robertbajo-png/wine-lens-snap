import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/global.css";

// Tvinga på vårt app-tema globalt (mörk bakgrund + token-override)
if (typeof document !== "undefined") {
  document.body.classList.add("app-theme");
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
