// deno-lint-ignore-file no-explicit-any
/**
 * history-sync Edge Function
 * - Tar emot ett historikobjekt från klienten och lagrar i tabell "label_history".
 * - Extraherar user_id från JWT-token om autentiserad, annars endast device_id.
 * - SÄKERHET: user_id accepteras INTE från request body.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-device-id",
};

/**
 * Extraherar user_id från JWT-token om giltig
 */
async function getUserIdFromToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.replace("Bearer ", "");
  
  // Om det är anon-key, returnera null (ej autentiserad)
  if (token === SUPABASE_ANON_KEY) {
    return null;
  }
  
  try {
    // Skapa en klient med användarens token för att verifiera
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log("JWT validation failed or no user:", error?.message);
      return null;
    }
    
    return user.id;
  } catch (err) {
    console.error("Error validating JWT:", err);
    return null;
  }
}

async function insertRow(payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/label_history`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Insert failed: ${res.status} ${t}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  
  try {
    const authHeader = req.headers.get("authorization");
    const deviceHeader = req.headers.get("x-device-id") || undefined;
    const body = await req.json().catch(() => ({}));

    // SÄKERHET: Extrahera user_id från JWT, INTE från request body
    const userId = await getUserIdFromToken(authHeader);

    const {
      ts,
      vin,
      producent,
      land_region,
      årgång,
      argang,
      meters,
      evidence,
      meta,
      device_id,
      // user_id ignoreras från body - tas från JWT istället
    } = body || {};

    const payload = {
      ts: ts || new Date().toISOString(),
      vin: vin ?? null,
      producent: producent ?? null,
      land_region: land_region ?? null,
      argang: (årgång ?? argang) ?? null,
      meters: meters ?? null,
      evidence: evidence ?? null,
      user_id: userId, // Från JWT, inte request body
      device_id: (device_id || deviceHeader || "unknown"),
      meta: meta ?? null,
    };

    await insertRow(payload);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Logga fullständigt fel serverside
    console.error("history-sync error:", err);
    
    // Returnera generiskt felmeddelande till klient
    return new Response(JSON.stringify({ ok: false, error: "Kunde inte spara historik" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
