// Enkel cache av OCR-text i localStorage för att spara omkörningar.
// Nyckel: "wine_ocr_<sha1|custom>", värde: { text, ts }

export interface OcrCacheEntry {
  text: string;
  ts: number;
}

const PREFIX = "wine_ocr_";

export function getOcrCache(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const obj = JSON.parse(raw) as OcrCacheEntry;
    if (!obj?.text) return null;
    return String(obj.text);
  } catch {
    return null;
  }
}

export function setOcrCache(key: string, text: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: OcrCacheEntry = { text, ts: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

export async function sha1Base64(b64: string): Promise<string> {
  const data = new TextEncoder().encode(b64);
  const buf = await crypto.subtle.digest("SHA-1", data);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}
