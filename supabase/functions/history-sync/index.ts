// deno-lint-ignore-file no-explicit-any
/**
 * history-sync Edge Function
 * - Tar emot ett historikobjekt från klienten och lagrar i tabell "label_history".
 * - Skapar tabellen om den inte redan finns (idempotent).
 *
 * Körs med Service Role (servermiljö), klienten använder publishable key i Authorization-header.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-device-id",
};

// Table created via migration - no need for ensureTable()

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
    const deviceHeader = req.headers.get("x-device-id") || undefined;
    const body = await req.json().catch(() => ({}));

    const {
      ts,
      vin,
      producent,
      land_region,
      årgång,
      argang, // tillåter båda nycklarna
      meters,
      evidence,
      user_id,
      meta,
      device_id,
    } = body || {};

    const payload = {
      ts: ts || new Date().toISOString(),
      vin: vin ?? null,
      producent: producent ?? null,
      land_region: land_region ?? null,
      argang: (årgång ?? argang) ?? null,
      meters: meters ?? null,
      evidence: evidence ?? null,
      user_id: user_id ?? null,
      device_id: (device_id || deviceHeader || "unknown"),
      meta: meta ?? null,
    };

    await insertRow(payload);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

