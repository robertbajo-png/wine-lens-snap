import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";

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
          <Button asChild size="lg">
            <a href="/">Gå till startsidan</a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
