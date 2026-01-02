import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, CreditCard, Loader2, Shield } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useIsPremium } from "@/hooks/useUserSettings";
import { trackEvent } from "@/lib/telemetry";
import { isPlayRC } from "@/lib/releaseChannel";
import { completePremiumCheckout } from "@/services/premiumCheckout";

const safeDecode = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn("Failed to decode url param", error);
    return fallback;
  }
};

const PremiumCheckoutSession = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPremium } = useIsPremium();

  useEffect(() => {
    if (isPlayRC) {
      navigate("/me", { replace: true });
    }
  }, [navigate]);

  if (isPlayRC) {
    return null;
  }

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sessionId = params.get("session_id");
  const cancelUrl = safeDecode(params.get("cancel_url"), "/me");
  const successUrl = safeDecode(params.get("success_url"), "/me");

  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");

  useEffect(() => {
    if (sessionId) {
      trackEvent("premium_checkout_started", { sessionId });
    }
  }, [sessionId]);

  const handleCancel = useCallback(() => {
    trackEvent("premium_checkout_cancelled", { sessionId });
    navigate(cancelUrl, { replace: true });
  }, [cancelUrl, navigate, sessionId]);

  const handleComplete = useCallback(async () => {
    if (!sessionId) {
      setStatus("error");
      toast({
        title: "Session saknas",
        description: "Vi kunde inte hitta betalningssessionen.",
        variant: "destructive",
      });
      return;
    }

    setStatus("processing");
    trackEvent("premium_checkout_payment_started", { sessionId });

    try {
      await completePremiumCheckout(sessionId);
      setStatus("success");
      trackEvent("premium_checkout_completed", { sessionId });
      toast({
        title: "Premium aktiverat!",
        description: "Din betalning har verifierats och Premium är påslaget.",
      });
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: ["user_settings", user.id] });
      }
      navigate(successUrl, { replace: true });
    } catch (error) {
      console.error(error);
      setStatus("error");
      trackEvent("premium_checkout_failed", { sessionId, message: (error as Error)?.message });
      toast({
        title: "Kunde inte slutföra betalningen",
        description: "Försök igen eller kontakta support om problemet kvarstår.",
        variant: "destructive",
      });
    }
  }, [navigate, queryClient, sessionId, successUrl, toast, user?.id]);

  const isProcessing = status === "processing";

  if (!sessionId) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-theme-primary">Session kunde inte startas</h1>
          <p className="text-theme-secondary">
            Vi saknar session_id för betalningen. Kontrollera länken eller starta checkout-flödet på nytt.
          </p>
        </div>
        <Button onClick={() => navigate("/me")}>Tillbaka till profilen</Button>
      </div>
    );
  }

  if (isPremium && status !== "success") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Check className="h-10 w-10 text-emerald-500" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-theme-primary">Du är redan Premium</h1>
          <p className="text-theme-secondary">Tack! Dina förmåner är redan aktiva.</p>
        </div>
        <Button onClick={() => navigate("/me", { replace: true })}>Tillbaka till profilen</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <button
        type="button"
        onClick={handleCancel}
        className="group inline-flex items-center gap-2 text-sm text-theme-secondary transition hover:text-theme-primary"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Avbryt och gå tillbaka
      </button>

      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-theme-secondary">Testläge</p>
        <h1 className="text-3xl font-semibold text-theme-primary">Premium-checkout</h1>
        <p className="text-theme-secondary">
          Simulerad betalning för testmiljö. Tryck på betala för att aktivera Premium och återvänd till appen.
        </p>
      </div>

      <Card className="border-theme-card bg-theme-elevated">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-[#8451ED]" aria-hidden />
            WineSnap Premium
          </CardTitle>
          <CardDescription>Obegränsade analyser, sparade listor och snabbare köer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-theme-card/70 bg-theme-surface p-4">
            <CreditCard className="h-10 w-10 text-theme-secondary" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium text-theme-primary">Testbetalning (0 kr)</p>
              <p className="text-sm text-theme-secondary">
                Klicka på Betala för att simulera en lyckad betalning och sätta Premiumflaggan.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="flex items-center gap-2"
              onClick={handleComplete}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {isProcessing ? "Verifierar..." : "Betala (test)"}
            </Button>
            <Button variant="ghost" onClick={handleCancel} disabled={isProcessing}>
              Avbryt
            </Button>
          </div>

          {status === "error" && (
            <p className="text-sm text-destructive">
              Något gick fel vid bekräftelsen. Försök igen eller kontakta support.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PremiumCheckoutSession;
