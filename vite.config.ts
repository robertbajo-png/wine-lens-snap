import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          "page-for-you": ["./src/pages/ForYou.tsx"],
          "page-explore": ["./src/pages/Explore.tsx"],
          "page-scan": ["./src/pages/WineSnap.tsx"],
          "page-following": ["./src/pages/Following.tsx"],
          "page-history": ["./src/pages/History.tsx"],
          "page-me": ["./src/pages/Me.tsx"],
          "page-auth": ["./src/pages/Login.tsx", "./src/pages/LoginCallback.tsx"],
          "page-static": ["./src/pages/About.tsx", "./src/pages/NotFound.tsx"],
          "page-dev": ["./src/pages/dev/Events.tsx"],
        },
      },
    },
  },
  test: {
    environment: "node",
  },
}));
