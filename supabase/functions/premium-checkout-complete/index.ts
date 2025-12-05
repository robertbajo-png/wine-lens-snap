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
    console.warn("Failed to resolve user for checkout completion", error?.message);
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
    const { session_id }: { session_id?: string } = body ?? {};

    if (!session_id) {
      return new Response(JSON.stringify({ error: "missing_session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: session, error: sessionError } = await admin
      .from("premium_checkout_sessions")
      .select("id, user_id, status")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("Session lookup failed", sessionError?.message);
      return new Response(JSON.stringify({ error: "session_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    const { data: existingSettings } = await admin
      .from("user_settings")
      .select("settings_json")
      .eq("user_id", user.id)
      .maybeSingle();

    const nextSettingsJson = {
      ...((existingSettings?.settings_json as Record<string, unknown> | null) ?? {}),
      is_premium: true,
      premium_since: now,
    };

    const { error: settingsError } = await admin.from("user_settings").upsert({
      user_id: user.id,
      settings_json: nextSettingsJson,
      is_premium: true,
      premium_since: now,
      updated_at: now,
    });

    if (settingsError) {
      console.error("Failed to update user_settings", settingsError.message);
      return new Response(JSON.stringify({ error: "settings_update_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateSessionError } = await admin
      .from("premium_checkout_sessions")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .eq("id", session_id);

    if (updateSessionError) {
      console.error("Failed to mark session completed", updateSessionError.message);
    }

    return new Response(JSON.stringify({ ok: true, premium_since: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error completing checkout", error);
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
