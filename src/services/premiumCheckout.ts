import { supabase } from "@/lib/supabaseClient";

export type PremiumCheckoutSession = {
  sessionId: string;
  redirectUrl: string;
  cancelUrl: string;
  successUrl: string;
};

export const createPremiumCheckoutSession = async (
  checkoutBaseUrl: string,
  options?: { successUrl?: string; cancelUrl?: string },
): Promise<PremiumCheckoutSession> => {
  const { data, error } = await supabase.functions.invoke<{
    session_id?: string;
    redirect_url?: string;
    cancel_url?: string;
    success_url?: string;
  }>("premium-checkout", {
    body: {
      checkout_base_url: checkoutBaseUrl,
      success_url: options?.successUrl,
      cancel_url: options?.cancelUrl,
    },
  });

  if (error || !data?.session_id || !data?.redirect_url) {
    throw new Error(error?.message ?? "Kunde inte starta betalningen");
  }

  return {
    sessionId: data.session_id,
    redirectUrl: data.redirect_url,
    cancelUrl: data.cancel_url ?? options?.cancelUrl ?? "/me",
    successUrl: data.success_url ?? options?.successUrl ?? "/me",
  };
};

export const completePremiumCheckout = async (sessionId: string) => {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; premium_since?: string }>(
    "premium-checkout-complete",
    {
      body: { session_id: sessionId },
    },
  );

  if (error || !data?.ok) {
    throw new Error(error?.message ?? "Betalningen kunde inte bekräftas");
  }

  return data;
};
