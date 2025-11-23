import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui/use-toast";

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

const LoginCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { loading, session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const error = params.get("error");
    if (error) {
      toast({
        title: "Inloggningen misslyckades",
        description: "Försök igen eller välj en annan metod.",
        variant: "destructive",
      });
      navigate(`/login?${params.toString()}`, { replace: true });
      return;
    }

    if (!loading && session) {
      const target = getSafeRedirect(params.get("redirectTo"));
      navigate(target, { replace: true });
      return;
    }

    if (!loading && !session) {
      toast({
        title: "Ingen session hittades",
        description: "Logga in igen för att fortsätta.",
        variant: "destructive",
      });
      navigate("/login", { replace: true });
    }
  }, [loading, navigate, params, session, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-theme-canvas px-4 py-12 text-theme-primary">
      <p className="text-theme-secondary">Loggar in med Google...</p>
    </div>
  );
};

export default LoginCallback;
