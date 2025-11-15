import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="rounded-2xl border border-theme-card bg-theme-elevated p-10 text-center shadow-theme-elevated">
          <h1 className="mb-4 text-5xl font-bold text-theme-primary">404</h1>
          <p className="mb-4 text-lg text-theme-secondary">Oops! Sidan kunde inte hittas.</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-theme-accent px-6 py-2 text-sm font-semibold text-theme-primary shadow-theme-elevated transition hover:opacity-90"
          >
            Gå till startsidan
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
