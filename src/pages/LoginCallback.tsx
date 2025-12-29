import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const getSafeRedirect = (raw: string | null) => {
  if (!raw) {
    return "/me";
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/me";
  }

  return trimmed;
};

const TIMEOUT_MS = 10000; // 10 seconds timeout

const LoginCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loading, session } = useAuth();
  const { toast } = useToast();
  const [timedOut, setTimedOut] = useState(false);

  // Timeout handling
  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check for OAuth errors in URL
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      toast({
        title: "Inloggningen misslyckades",
        description: errorDescription || "Försök igen eller välj en annan metod.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
      return;
    }

    // Check for hash fragment with tokens (Supabase OAuth returns tokens in hash)
    const hash = window.location.hash;
    if (hash && hash.includes("error")) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const hashError = hashParams.get("error");
      const hashErrorDesc = hashParams.get("error_description");
      if (hashError) {
        console.error("OAuth hash error:", hashError, hashErrorDesc);
        toast({
          title: "Inloggningen misslyckades",
          description: hashErrorDesc || "Ett fel uppstod vid inloggning.",
          variant: "destructive",
        });
        navigate("/login", { replace: true });
        return;
      }
    }

    if (!loading && session) {
      const target = getSafeRedirect(params.get("redirectTo"));
      navigate(target, { replace: true });
      return;
    }

    if (!loading && !session && timedOut) {
      toast({
        title: "Inloggningen tog för lång tid",
        description: "Försök igen. Om problemet kvarstår, rensa webbläsarens cookies.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    }
  }, [loading, navigate, params, session, toast, timedOut]);

  // Handle timeout state
  if (timedOut && !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-theme-canvas px-4 py-12 text-theme-primary">
        <p className="text-theme-secondary">Inloggningen tog för lång tid...</p>
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="text-sm text-theme-accent underline"
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-theme-canvas px-4 py-12 text-theme-primary">
      <Loader2 className="h-6 w-6 animate-spin text-theme-secondary" />
      <p className="text-theme-secondary">Loggar in...</p>
    </div>
  );
};

export default LoginCallback;
