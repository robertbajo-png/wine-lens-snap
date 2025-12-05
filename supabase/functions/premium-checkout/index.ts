import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const getUserFromRequest = async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authHeader.replace(/bearer\s+/i, "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.warn("Failed to resolve user for checkout", error?.message);
    return null;
  }

  return data.user;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "auth_required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      checkout_base_url,
      success_url,
      cancel_url,
    }: { checkout_base_url?: string; success_url?: string; cancel_url?: string } = body ?? {};

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin
      .from("premium_checkout_sessions")
      .insert({
        user_id: user.id,
        status: "pending",
        success_url: success_url ?? null,
        cancel_url: cancel_url ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error("Failed to create checkout session", error?.message);
      return new Response(JSON.stringify({ error: "session_creation_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") ?? "";
    const checkoutBaseUrl =
      typeof checkout_base_url === "string" && checkout_base_url.length > 0
        ? checkout_base_url
        : `${origin}/premium/checkout/session`;

    const resolveUrl = (url: string | undefined, fallbackPath: string) => {
      if (typeof url === "string" && url.length > 0) return url;
      if (origin && fallbackPath.startsWith("/")) return `${origin}${fallbackPath}`;
      return fallbackPath;
    };

    const encodedCancelUrl = encodeURIComponent(resolveUrl(cancel_url, "/me"));
    const encodedSuccessUrl = encodeURIComponent(resolveUrl(success_url, "/me"));

    const redirectUrl = `${checkoutBaseUrl}${checkoutBaseUrl.includes("?") ? "&" : "?"}session_id=${
      data.id
    }&cancel_url=${encodedCancelUrl}&success_url=${encodedSuccessUrl}&provider=stub`;

    return new Response(JSON.stringify({
      session_id: data.id,
      redirect_url: redirectUrl,
      cancel_url: resolveUrl(cancel_url, "/me"),
      success_url: resolveUrl(success_url, "/me"),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error creating checkout session", error);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
