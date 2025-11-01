// supabase/functions/wine-vision/db.ts
// Tiny helpers to read/write OCR text cache via Supabase REST.
export async function getOcrFromServerCache(
  SUPABASE_URL: string,
  SERVICE_KEY: string,
  imageHash: string
) {
  const url = `${SUPABASE_URL}/rest/v1/label_ocr_cache?image_hash=eq.${encodeURIComponent(imageHash)}&select=ocr_text`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: "application/json"
    }
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => []);
  return Array.isArray(json) && json[0]?.ocr_text ? String(json[0].ocr_text) : null;
}

export async function upsertOcrServerCache(
  SUPABASE_URL: string,
  SERVICE_KEY: string,
  imageHash: string,
  ocrText: string
) {
  const url = `${SUPABASE_URL}/rest/v1/label_ocr_cache`;
  const payload = [{ image_hash: imageHash, ocr_text: ocrText, ts: new Date().toISOString() }];
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify(payload)
  });
  return res.ok;
}

export async function getAnalysisFromServerCache(
  SUPABASE_URL: string,
  SERVICE_KEY: string,
  key: string
) {
  const url = `${SUPABASE_URL}/rest/v1/wine_analysis_cache?cache_key=eq.${encodeURIComponent(key)}&select=payload,expires_at&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: "application/json"
    }
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => []);
  if (!Array.isArray(json) || !json[0]) return null;
  const row = json[0];
  try {
    const exp = row.expires_at ? new Date(row.expires_at) : null;
    if (exp && exp.getTime() < Date.now()) return null;
  } catch {
    // ignore parse errors
  }
  return row.payload ?? null;
}

export async function upsertAnalysisServerCache(
  SUPABASE_URL: string,
  SERVICE_KEY: string,
  key: string,
  payload: unknown
) {
  const url = `${SUPABASE_URL}/rest/v1/wine_analysis_cache`;
  const row = {
    cache_key: key,
    payload,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString()
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify([row])
  });
  return res.ok;
}
