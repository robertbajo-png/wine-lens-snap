import { GoogleGenAI, Type, type Schema } from "npm:@google/genai";
import { aiClient } from "./lib/aiClient.ts";
import {
  getCacheKey,
  getFromMemoryCache,
  setMemoryCache,
  getFromSupabaseCache,
  setSupabaseCache
} from "./cache.ts";
import {
  getAnalysisFromServerCache,
  getOcrFromServerCache,
  upsertAnalysisServerCache,
  upsertOcrServerCache,
} from "./db.ts";
import type {
  WineAnalysisResult,
  WineSearchResult,
  WineStyle,
  WineSummary,
} from "./types.ts";
import {
  TASTE_PRIMARY_PROMPT,
  TASTE_REPAIR_PROMPT,
  inferStyleFromGrapes,
  isWeakNotes,
} from "./prompts.ts";

const DEV_LOG = true; // sätt till false inför release
function devLog(label: string, data: unknown) {
  if (!DEV_LOG) return;
  const ts = new Date().toISOString().split("T")[1]?.split(".")[0] ?? "--:--:--";
  console.log(`🧪 [${ts}] ${label}:`, data);
}

const CFG = {
  PPLX_TIMEOUT_MS: 12000,   // max PPLX-tid
  GEMINI_TIMEOUT_MS: 45000, // max Gemini-tid
  FAST_TIMEOUT_MS: 4000,    // snabb “fail-fast” för initial sök
  MAX_WEB_URLS: 3,
  PPLX_MODEL: "sonar",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const PERPLEXITY_GATEWAY_URL = Deno.env.get("PERPLEXITY_GATEWAY_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_KEY_ENV_VARS = [
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "GENAI_API_KEY",
];

function getApiKey(): string {
  const key = GEMINI_KEY_ENV_VARS
    .map((name) => Deno.env.get(name)?.trim())
    .find((value) => value && value.length > 0);

  if (!key) {
    throw new Error("Missing Gemini API key – set GOOGLE_API_KEY or GEMINI_API_KEY");
  }

  return key;
}

const wineAnalysisSchema: Schema = {
  type: Type.OBJECT,
  description: "Structured wine analysis derived from label text and imagery.",
  properties: {
    wineName: { type: Type.STRING, description: "Primary wine name" },
    producer: { type: Type.STRING, nullable: true },
    grapeVariety: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Detected grape varieties",
    },
    region: { type: Type.STRING, nullable: true },
    country: { type: Type.STRING, nullable: true },
    tastingNotes: { type: Type.STRING, nullable: true },
    foodPairing: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly three recommended food pairings",
    },
    vin: { type: Type.STRING, nullable: true },
    land_region: { type: Type.STRING, nullable: true },
    producent: { type: Type.STRING, nullable: true },
    druvor: { type: Type.STRING, nullable: true },
    årgång: { type: Type.STRING, nullable: true },
    typ: { type: Type.STRING, nullable: true },
    färgtyp: { type: Type.STRING, nullable: true },
    klassificering: { type: Type.STRING, nullable: true },
    alkoholhalt: { type: Type.STRING, nullable: true },
    volym: { type: Type.STRING, nullable: true },
    karaktär: { type: Type.STRING, nullable: true },
    smak: { type: Type.STRING, nullable: true },
    servering: { type: Type.STRING, nullable: true },
    passar_till: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      nullable: true,
    },
  },
  required: ["wineName", "foodPairing"],
};

function toJsonSafe(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate) as Record<string, unknown>;
      } catch {
        // fallthrough
      }
    }
  }
  throw new Error("Gemini returned non-JSON response");
}

// --- Helpers: timed fetch (abort) för snabb första-sökning ---
async function safeWebFetch(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Helper functions
const stripDiacritics = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const clamp = (s: string, n = 200) => (s.length > n ? s.slice(0, n) : s);
const isBlank = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "-" || trimmed === "–";
  }
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => isBlank(item));
  }
  return false;
};

function weightSource(url: string | undefined | null): number {
  if (!url) return 0;
  const lower = url.toLowerCase();
  if (lower.includes("systembolaget.se")) return 5;
  if (
    lower.includes("vinmonopolet.no") ||
    lower.includes("alko.fi") ||
    lower.includes("saq.com") ||
    lower.includes("lcbo.com")
  )
    return 4;
  if (
    lower.includes("wine-searcher.com") ||
    lower.includes("wine.com") ||
    lower.includes("totalwine.com")
  )
    return 3;
  if (
    lower.includes("decanter.com") ||
    lower.includes("winemag.com") ||
    lower.includes("jancisrobinson.com") ||
    lower.includes("falstaff.com")
  )
    return 2;
  if (lower.includes("vivino.com") || lower.includes("cellartracker.com")) return 1;
  return 0;
}

const normalizeForAnalysisKey = (s: string) =>
  stripDiacritics(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 160);

const detectVintage = (text?: string): string | null => {
  const match = String(text ?? "").match(/\b(19[0-9]{2}|20[0-9]{2})\b/);
  return match ? match[1] : null;
};

function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        const error = new Error(`timeout:${reason}:${ms}ms`);
        error.name = "TimeoutError";
        reject(error);
      }
    }, ms);

    promise
      .then((value) => {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

type WebJson = WineSearchResult | null;

async function runPerplexity(ocrText: string): Promise<WebJson> {
  if (!PERPLEXITY_API_KEY) return null;

  const queries = buildSearchVariants(ocrText);
  const schemaJSON = `
{
  "vin": "", "producent": "", "druvor": "", "land_region": "",
  "årgång": "", "alkoholhalt": "", "volym": "", "klassificering": "",
  "karaktär": "", "smak": "", "servering": "", "passar_till": [], "källor": []
}`.trim();
  const systemPrompt =
    "Du är en extraktor som MÅSTE returnera ENBART ett giltigt, minifierat JSON-objekt enligt schema. Ingen markdown, inga backticks, ingen kommentar före eller efter. Dubbelcitat på alla nycklar/strängar. KRITISKT: ALL text i ditt svar MÅSTE vara på SVENSKA. Översätt alla beskrivningar till svenska.";

  const pplxPrompt = `
VIN-LEDTRÅD (OCR):
"${ocrText.slice(0, 300)}"

Sök i denna prioritering med site:-filter:
${queries.slice(0, 8).map((q, i) => `${i + 1}) ${q}`).join("\n")}

Normalisera sökningen (ta bort diakritiska tecken; "Egri" ≈ "Eger").

Returnera ENBART ett JSON-objekt exakt enligt detta schema (saknas uppgift → "-"):
${schemaJSON}
  `.trim();

  const perplexityResult = await aiClient.perplexity(pplxPrompt, {
    model: CFG.PPLX_MODEL,
    timeoutMs: CFG.PPLX_TIMEOUT_MS,
    systemPrompt,
    schemaHint: schemaJSON,
  });

  const normalized = normalizeSearchResult(perplexityResult);
  normalized.fallback_mode = false;

  const sources = normalized.källor ?? [];
  normalized.källor = Array.from(new Set(sources))
    .filter((u) => u.startsWith("http"))
    .sort((a, b) => weightSource(b) - weightSource(a))
    .slice(0, CFG.MAX_WEB_URLS);

  return normalized;
}

async function runGeminiFast(ocrText: string, imageUrl?: string): Promise<WebJson> {
  if (!LOVABLE_API_KEY || !imageUrl) return null;

  console.log(`[${new Date().toISOString()}] Gemini Vision fallback: analyzing label image directly...`);

  const prompt = `
Analysera denna vinflaska-etikett MYCKET NOGGRANT och extrahera följande information.

INSTRUKTIONER:
1. Läs HELA etiketten, inklusive liten text längst ner/bak
2. Alkoholhalt hittas ofta som: "13% vol", "12.5% alc", "14%" - leta NOGA efter detta
3. Volym hittas ofta som: "750ml", "75cl", "0.75L" - ofta i nedre kanten
4. Årgång är ofta 4 siffror (2019, 2021, etc.) - kan stå på framsidan eller backsidan
5. Producent och vinnamn står oftast störst på etiketten
6. Druvsort kan stå som "Sauvignon Blanc", "Chardonnay", etc.
7. Land/region kan vara "France", "Bordeaux", "Italy", "Toscana" etc.

KRITISKT: Returnera ENBART ett giltigt JSON-objekt utan markdown, backticks eller kommentarer.
ALL text MÅSTE vara på SVENSKA (utom vinnamn och producent som ska vara original).

OCR-text från etiketten (använd som referens):
${ocrText}

Schema:
{
  "vin": "vinets namn (original språk)",
  "producent": "producent (original språk)",
  "druvor": "druvsort(er) på svenska",
  "land_region": "land, region på svenska",
  "årgång": "YYYY eller -",
  "alkoholhalt": "X% vol eller X% eller -",
  "volym": "XXXml eller XXcl eller -",
  "klassificering": "t.ex. DOC, Reserva, AOC eller -",
  "karaktär": "kort beskrivning baserad på druva och region eller -",
  "smak": "typiska smaker för denna vintyp eller -",
  "servering": "rekommenderad serveringstemperatur eller -",
  "passar_till": ["maträtt1", "maträtt2", "maträtt3"],
  "källor": []
}

VIKTIGT: 
- Om du INTE kan hitta alkoholhalt eller volym på bilden: använd "-"
- Fyll i karaktär och smak baserat på druva och region även om det inte står på etiketten
- passar_till: ge 3-5 lämpliga maträtter baserat på vintyp och druva
- Max 5 maträtter i passar_till
  `.trim();

  try {
    const result = await aiClient.gemini(prompt, {
      imageUrl,
      timeoutMs: CFG.GEMINI_TIMEOUT_MS,
      json: true,
    }) as Record<string, unknown>;

    const normalized = normalizeSearchResult(result);
    normalized.fallback_mode = false;
    normalized.källor = ["gemini-vision"];

    console.log(`[${new Date().toISOString()}] Gemini Vision success:`, JSON.stringify(normalized, null, 2));
    return normalized;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Gemini Vision error:`, error);
    return null;
  }
}

type WebMeta = {
  fastPathHit: boolean;
  pplx_ms: number | null;
  gemini_ms: number | null;
  pplx_status: "ok" | "timeout" | "error" | "skipped" | "empty";
  gemini_status: "ok" | "timeout" | "error" | "skipped" | "empty";
};

async function parallelWeb(ocrText: string, imageUrl?: string): Promise<{ web: WebJson; meta: WebMeta }> {
  let pplx_ms: number | null = null;
  let gemini_ms: number | null = null;
  let fastPathHit = false;
  let pplx_status: WebMeta["pplx_status"] = PERPLEXITY_API_KEY ? "empty" : "skipped";
  let gemini_status: WebMeta["gemini_status"] = LOVABLE_API_KEY ? "empty" : "skipped";

  const tasks: Promise<WebJson>[] = [];

  if (PERPLEXITY_API_KEY) {
    console.log(`[${new Date().toISOString()}] Starting Perplexity search (${CFG.PPLX_TIMEOUT_MS}ms timeout)...`);
    const pplxPromise = (async () => {
      const start = Date.now();
      try {
        const res = await withTimeout(runPerplexity(ocrText), CFG.PPLX_TIMEOUT_MS, "pplx");
        pplx_ms = Date.now() - start;
        pplx_status = res ? "ok" : "empty";
        if (res) {
          console.log(`[${new Date().toISOString()}] Perplexity WEB_JSON:`, JSON.stringify(res, null, 2));
          console.log(`[${new Date().toISOString()}] Perplexity success (${pplx_ms}ms), sources: ${res.källor?.length ?? 0}`);
        } else {
          console.log(`[${new Date().toISOString()}] Perplexity returned empty result (${pplx_ms}ms)`);
        }
        return res;
      } catch (error) {
        pplx_ms = Date.now() - start;
        if (error instanceof Error && error.name === "TimeoutError") {
          pplx_status = "timeout";
          console.log(`[${new Date().toISOString()}] Perplexity timeout (${pplx_ms}ms)`);
        } else {
          pplx_status = "error";
          console.error(`[${new Date().toISOString()}] Perplexity error (${pplx_ms}ms):`, error);
        }
        return null;
      }
    })();
    tasks.push(pplxPromise);
  }

  // Don't run Gemini Vision in parallel initially - use it as fallback only
  // This saves on API costs and only uses it when Perplexity fails

  let web: WebJson = null;

  if (tasks.length > 0) {
    const settled = await Promise.allSettled(tasks);
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        web = result.value;
        break;
      }
    }
  }

  // FALLBACK: If Perplexity failed or returned 0 sources, use Gemini Vision
  if ((!web || !web.källor || web.källor.length === 0) && LOVABLE_API_KEY && imageUrl) {
    console.log(`[${new Date().toISOString()}] Perplexity returned no sources – activating Gemini Vision fallback`);
    const gemStart = Date.now();
    try {
      const geminiResult = await withTimeout(
        runGeminiFast(ocrText, imageUrl), 
        CFG.GEMINI_TIMEOUT_MS, 
        "gemini-vision-fallback"
      );
      gemini_ms = Date.now() - gemStart;
      if (geminiResult) {
        web = geminiResult;
        gemini_status = "ok";
        console.log(`[${new Date().toISOString()}] Gemini Vision fallback success (${gemini_ms}ms)`);
      } else {
        gemini_status = "empty";
        console.log(`[${new Date().toISOString()}] Gemini Vision fallback returned empty (${gemini_ms}ms)`);
      }
    } catch (error) {
      gemini_ms = Date.now() - gemStart;
      if (error instanceof Error && error.name === "TimeoutError") {
        gemini_status = "timeout";
        console.log(`[${new Date().toISOString()}] Gemini Vision fallback timeout (${gemini_ms}ms)`);
      } else {
        gemini_status = "error";
        console.error(`[${new Date().toISOString()}] Gemini Vision fallback error (${gemini_ms}ms):`, error);
      }
    }
  }

  return {
    web,
    meta: { fastPathHit, pplx_ms, gemini_ms, pplx_status, gemini_status },
  };
}

const WHITE_GRAPES = [
  "riesling","sauvignon blanc","chardonnay","pinot grigio","pinot gris","grüner veltliner",
  "chenin blanc","gewürztraminer","viognier","albariño","garganega","glera","furmint",
  "semillon","muscat","moscato","verdejo","assyrtiko","vermentino","godello","trebbiano"
];

const RED_GRAPES = [
  "pinot noir","nebbiolo","barbera","sangiovese","tempranillo","garnacha","grenache",
  "cabernet sauvignon","merlot","syrah","shiraz","malbec","zinfandel","primitivo",
  "touriga nacional","baga","kékfrankos","blaufränkisch","kékmedoc"
];

function createEmptySummary(): WineSummary {
  return {
    vin: "-",
    land_region: "-",
    producent: "-",
    druvor: "-",
    årgång: "-",
    typ: "-",
    färgtyp: "-",
    klassificering: "-",
    alkoholhalt: "-",
    volym: "-",
    karaktär: "-",
    smak: "-",
    servering: "-",
    källa: "-",
    passar_till: [],
    meters: { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null },
    evidence: { etiketttext: "", webbträffar: [] },
  };
}

const ensureString = (value: unknown, fallback = "-"): string =>
  typeof value === "string" ? value : fallback;

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function ensureMeters(value: unknown): WineSummary["meters"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null };
  }

  const meters = value as Partial<WineSummary["meters"]>;
  return {
    sötma: typeof meters.sötma === "number" ? meters.sötma : null,
    fyllighet: typeof meters.fyllighet === "number" ? meters.fyllighet : null,
    fruktighet: typeof meters.fruktighet === "number" ? meters.fruktighet : null,
    fruktsyra: typeof meters.fruktsyra === "number" ? meters.fruktsyra : null,
  };
}

function ensureEvidence(value: unknown): WineSummary["evidence"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { etiketttext: "", webbträffar: [] };
  }

  const evidence = value as Partial<WineSummary["evidence"]>;
  return {
    etiketttext: typeof evidence.etiketttext === "string" ? evidence.etiketttext : "",
    webbträffar: ensureStringArray(evidence.webbträffar),
  };
}

function normalizeWineSummary(value: unknown): WineSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptySummary();
  }

  const record = value as Record<string, unknown>;
  return {
    ...createEmptySummary(),
    vin: ensureString(record.vin, "-"),
    land_region: ensureString(record.land_region, "-"),
    producent: ensureString(record.producent, "-"),
    druvor: ensureString(record.druvor, "-"),
    årgång: ensureString(record.årgång, "-"),
    typ: ensureString(record.typ, "-"),
    färgtyp: ensureString(record.färgtyp, "-"),
    klassificering: ensureString(record.klassificering, "-"),
    alkoholhalt: ensureString(record.alkoholhalt, "-"),
    volym: ensureString(record.volym, "-"),
    karaktär: ensureString(record.karaktär, "-"),
    smak: ensureString(record.smak, "-"),
    servering: ensureString(record.servering, "-"),
    källa: ensureString(record.källa, "-"),
    passar_till: ensureStringArray(record.passar_till),
    meters: ensureMeters(record.meters),
    evidence: ensureEvidence(record.evidence),
  };
}

function normalizeSearchResult(value: unknown): WineSearchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      vin: "-",
      producent: "-",
      druvor: "-",
      land_region: "-",
      årgång: "-",
      alkoholhalt: "-",
      volym: "-",
      klassificering: "-",
      karaktär: "-",
      smak: "-",
      servering: "-",
      passar_till: [],
      källor: [],
      fallback_mode: true,
    };
  }

  const record = value as Record<string, unknown>;
  const result: WineSearchResult = {
    vin: ensureString(record.vin, "-"),
    producent: ensureString(record.producent, "-"),
    druvor: ensureString(record.druvor, "-"),
    land_region: ensureString(record.land_region, "-"),
    årgång: ensureString(record.årgång, "-"),
    alkoholhalt: ensureString(record.alkoholhalt, "-"),
    volym: ensureString(record.volym, "-"),
    klassificering: ensureString(record.klassificering, "-"),
    karaktär: ensureString(record.karaktär, "-"),
    smak: ensureString(record.smak, "-"),
    servering: ensureString(record.servering, "-"),
    passar_till: ensureStringArray(record.passar_till),
    källor: ensureStringArray(record.källor),
  };

  if (typeof record.text === "string") {
    result.text = record.text;
  }
  if (typeof record.fallback_mode === "boolean") {
    result.fallback_mode = record.fallback_mode;
  }
  if (record.meters !== undefined) {
    result.meters = ensureMeters(record.meters);
  }
  if (record.evidence !== undefined) {
    result.evidence = ensureEvidence(record.evidence);
  }

  return result;
}

function normalizeGatewayResult(payload: unknown): WineSearchResult | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidates = Array.isArray(record.webbträffar)
    ? record.webbträffar
    : Array.isArray(record.hits)
      ? record.hits
      : [];

  const hits = candidates
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const hit = item as Record<string, unknown>;
      const url = ensureString(hit.url, "");
      if (!url) return null;
      const fields =
        hit.fields && typeof hit.fields === "object" && !Array.isArray(hit.fields)
          ? (hit.fields as Record<string, unknown>)
          : {};
      return { url, fields };
    })
    .filter((entry): entry is { url: string; fields: Record<string, unknown> } => Boolean(entry));

  if (!hits.length) return null;

  hits.sort((a, b) => weightSource(b.url) - weightSource(a.url));
  const primary = hits[0];
  const fields = primary.fields;

  const result: WineSearchResult = {
    vin: ensureString(fields.vin ?? fields.namn ?? fields.name ?? fields.title, "-"),
    producent: ensureString(fields.producent ?? fields.producer ?? fields.tillverkare, "-"),
    druvor: ensureString(fields.druvor ?? fields.grapes ?? fields.sortiment, "-"),
    land_region: ensureString(fields.land_region ?? fields.region ?? fields.ursprung, "-"),
    årgång: ensureString(fields.årgång ?? fields.vintage, "-"),
    alkoholhalt: ensureString(fields.alkoholhalt ?? fields.abv ?? fields.alcohol, "-"),
    volym: ensureString(fields.volym ?? fields.volume ?? fields.bottle_size, "-"),
    klassificering: ensureString(fields.klassificering ?? fields.classification, "-"),
    karaktär: ensureString(fields.karaktär ?? fields.karakter ?? fields.character ?? fields.style, "-"),
    smak: ensureString(fields.smak ?? fields.smaksprofil ?? fields.taste ?? fields.notes, "-"),
    servering: ensureString(fields.servering ?? fields.serve ?? fields.serveringstips, "-"),
    passar_till: ensureStringArray(fields.passar_till ?? fields.food ?? fields.matchningar),
    källor: hits.map((h) => h.url).slice(0, CFG.MAX_WEB_URLS),
    källa: ensureString(fields.källa ?? fields.source, hits[0]?.url ?? "-"),
    fallback_mode: false,
  };

  if (fields.meters !== undefined) {
    result.meters = ensureMeters(fields.meters);
  }

  return normalizeSearchResult(result);
}

function detectColour(data: Partial<WineSummary>, ocrText: string) {
  const joined = [
    data?.färgtyp,
    data?.typ,
    data?.karaktär,
    data?.smak,
    data?.druvor,
    ocrText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/dessert|aszú|late harvest|ice\s?wine|sauternes|tokaji|sweet wine|dolce|porto|sherry/.test(joined)) {
    return "dessert";
  }
  if (/mousserande|bubbl|champagne|cava|prosecco|spumante|frizzante|sparkling|crémant/.test(joined)) {
    return "mousserande";
  }
  if (/ros[eéáå]|rosado|rosato|blush/.test(joined)) {
    return "rosé";
  }
  if (/rött|rosso|rouge|tinto|negro|garnacha tinta|vin rouge|vino rosso/.test(joined)) {
    return "rött";
  }
  if (/vitt|white|blanc|bianco|bianc|alb|weiß|weiss/.test(joined)) {
    return "vitt";
  }

  const grapeText = joined;
  if (RED_GRAPES.some((grape) => grapeText.includes(grape))) return "rött";
  if (WHITE_GRAPES.some((grape) => grapeText.includes(grape))) return "vitt";

  return "okänt";
}

function detectBody(data: Partial<WineSummary>, ocrText: string) {
  const joined = [data?.karaktär, data?.smak, data?.typ, data?.klassificering, ocrText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/kraftfull|fyllig|barolo|amarone|reserva|gran reserva|cabernet|syrah|shiraz|malbec|barrique/.test(joined)) {
    return "kraftfull";
  }
  if (/lätt|frisk|crisp|spritzy|pinot noir|gamay|vouvray|vinho verde|riesling|spritsig/.test(joined)) {
    return "lätt";
  }
  return "medel";
}

function detectSweetness(data: Partial<WineSummary>, ocrText: string) {
  const joined = [data?.karaktär, data?.smak, data?.typ, data?.klassificering, data?.sockerhalt, ocrText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/dessert|sweet|dolce|aszú|ice\s?wine|late harvest|passito|tokaji|sött|noble rot|vin santo|süß/.test(joined)) {
    return "söt";
  }
  if (/halvsöt|halvtorr|demi-sec|semi seco|semi-seco|amabile|lieblich|off dry|semi sweet|dulce/.test(joined)) {
    return "halvsöt";
  }
  return "torr";
}

function defaultPairings(colour: string, body: string, sweetness: string) {
  if (colour === "dessert" || sweetness === "söt") {
    return [
      "Blåmögelost med honung",
      "Crème brûlée",
      "Fruktiga desserter med bär",
      "Rostade nötter och torkad frukt"
    ];
  }
  if (colour === "mousserande") {
    return [
      "Aperitif med charkuterier",
      "Ostron och skaldjur",
      "Sushi och sashimi",
      "Friterade snacks eller tempura"
    ];
  }
  if (colour === "rosé") {
    return [
      "Somrig sallad med getost",
      "Grillad kyckling med örter",
      "Pizza med grönsaker",
      "Asiatiska smårätter"
    ];
  }
  if (colour === "vitt") {
    if (body === "lätt") {
      return [
        "Skaldjur med citron",
        "Vit fisk med dill",
        "Kyckling med örtsås",
        "Färska getostar"
      ];
    }
    return [
      "Grillad lax med citron",
      "Krämig pasta med svamp",
      "Fläskfilé med örter",
      "Halvmogna ostar"
    ];
  }
  if (colour === "rött") {
    if (body === "lätt") {
      return [
        "Pasta med tomat och basilika",
        "Grillad kyckling",
        "Lättare kötträtter",
        "Milda ostar"
      ];
    }
    if (body === "kraftfull") {
      return [
        "Grillat nötkött",
        "Lammstek med örter",
        "Viltgryta",
        "Lagrade hårdostar"
      ];
    }
    return [
      "Nötkött eller entrecôte",
      "Lasagne eller mustig pasta",
      "Grillad fläskkarré",
      "Lagrade ostar"
    ];
  }
  return [
    "Charkuterier och ostar",
    "Pastarätt med örter",
    "Grillade grönsaker",
    "Rostad kyckling"
  ];
}

function defaultServing(colour: string, body: string, sweetness: string) {
  if (colour === "dessert" || sweetness === "söt") return "10–12 °C";
  if (colour === "mousserande") return "6–8 °C";
  if (colour === "rosé") return "8–10 °C";
  if (colour === "vitt") {
    return body === "lätt" ? "7–9 °C" : "9–11 °C";
  }
  if (colour === "rött") {
    if (body === "lätt") return "14–15 °C";
    if (body === "kraftfull") return "17–18 °C";
    return "16–17 °C";
  }
  return "10–12 °C";
}

function defaultCharacter(colour: string, body: string, sweetness: string) {
  if (colour === "dessert" || sweetness === "söt") {
    return "Söt och koncentrerad med toner av honung, torkad frukt och karamell.";
  }
  if (colour === "mousserande") {
    return "Pigg och elegant med fin mousse och frisk syra.";
  }
  if (colour === "rosé") {
    return "Friskt och bärigt med inslag av smultron, blodapelsin och örter.";
  }
  if (colour === "vitt") {
    return body === "lätt"
      ? "Lätt och frisk med citrus, gröna äpplen och mineralitet."
      : "Fylligt vitt med gul frukt, nötighet och balanserad syra.";
  }
  if (colour === "rött") {
    if (body === "lätt") {
      return "Lätt rött vin med röda bär, mjuka tanniner och frisk avslutning.";
    }
    if (body === "kraftfull") {
      return "Kraftfull struktur med mörka bär, choklad och rostade fattoner.";
    }
    return "Medelfylligt med mörka bär, kryddor och mjuka tanniner.";
  }
  return "Fruktigt och balanserat vin med harmonisk avslutning.";
}

function defaultTaste(colour: string, body: string, sweetness: string) {
  if (colour === "dessert" || sweetness === "söt") {
    return "Rik sötma med smaker av aprikos, apelsinzest, honung och karamelliserade nötter.";
  }
  if (colour === "mousserande") {
    return "Livlig smak med citrus, gröna äpplen och brödiga toner i avslutningen.";
  }
  if (colour === "rosé") {
    return "Fruktig smak av jordgubbar, blodapelsin och örter med frisk syra.";
  }
  if (colour === "vitt") {
    return body === "lätt"
      ? "Frisk smak av citrus, gröna äpplen och mineral med pigg syra."
      : "Fylligare vit frukt, gula äpplen och lätt ekfatston med krämig textur.";
  }
  if (colour === "rött") {
    if (body === "lätt") {
      return "Smak av röda bär, körsbär och kryddor med silkiga tanniner.";
    }
    if (body === "kraftfull") {
      return "Intensiv smak med mörka bär, choklad, lakrits och tydliga tanniner.";
    }
    return "Balanserad smak av mörka bär, plommon och kryddiga toner med mjuka tanniner.";
  }
  return "Harmonisk smakbild med fruktiga toner och balanserad syra.";
}

// --- Druva/Region/Typ-modell för förbättrade fallback-smaker & meters ---
type DRT = { sötma: number; fyllighet: number; fruktighet: number; fruktsyra: number; text: string };
const GRAPE_BASE: Record<string, Omit<DRT, "text">> = {
  // Vitt
  furmint:            { sötma: 1.0, fyllighet: 3.0, fruktighet: 3.5, fruktsyra: 4.0 },
  riesling:           { sötma: 1.0, fyllighet: 2.5, fruktighet: 3.5, fruktsyra: 4.5 },
  chardonnay:         { sötma: 1.0, fyllighet: 3.5, fruktighet: 3.2, fruktsyra: 3.0 },
  "sauvignon blanc":  { sötma: 1.0, fyllighet: 2.6, fruktighet: 3.8, fruktsyra: 4.2 },
  olaszrizling:       { sötma: 1.0, fyllighet: 2.5, fruktighet: 3.0, fruktsyra: 3.5 },
  welschriesling:     { sötma: 1.0, fyllighet: 2.5, fruktighet: 3.0, fruktsyra: 3.5 },
  // Rött
  kékfrankos:         { sötma: 1.0, fyllighet: 3.0, fruktighet: 4.0, fruktsyra: 3.5 },
  "pinot noir":      { sötma: 1.0, fyllighet: 2.4, fruktighet: 3.6, fruktsyra: 3.6 },
  "cabernet sauvignon": { sötma: 1.0, fyllighet: 4.2, fruktighet: 3.5, fruktsyra: 3.0 },
};

function regionAdjust(base: Omit<DRT, "text">, region: string, colour: string): Omit<DRT, "text"> {
  const r = (region || "").toLowerCase();
  let { sötma, fyllighet, fruktighet, fruktsyra } = base;

  if (/tokaj|tokaji|eger|balaton|somlo|mátra|matra|badacsony/.test(r)) {
    fruktsyra += 0.3;
    fruktighet += 0.1;
  }
  if (/tuscany|toscana|rioja|priorat|rhone|languedoc|sud/.test(r)) {
    fyllighet += 0.2;
    fruktsyra -= 0.2;
  }
  if (colour === "mousserande") {
    fruktsyra += 0.2;
    sötma = Math.max(1.0, sötma);
  }

  const clampNum = (n: number) => Math.max(0, Math.min(5, Math.round(n * 10) / 10));
  return {
    sötma: clampNum(sötma),
    fyllighet: clampNum(fyllighet),
    fruktighet: clampNum(fruktighet),
    fruktsyra: clampNum(fruktsyra),
  };
}

function drtText(grape: string, region: string, colour: string, vals: Omit<DRT, "text">): string {
  const parts: string[] = [];

  if (colour === "vitt") {
    parts.push("Torr, frisk stil");
    if (vals.fruktsyra >= 3.8) parts.push("hög syra");
    if (vals.fyllighet >= 3.4) parts.push("medelfyllig till fyllig");
    parts.push("toner av citrus, gul frukt och mineralitet");
  } else if (colour === "rött") {
    parts.push("Torr, balanserad stil");
    if (vals.fyllighet >= 3.8) parts.push("fyllig kropp");
    parts.push(vals.fruktighet >= 3.6 ? "röd/mörk frukt" : "diskret frukt");
    if (vals.fruktsyra >= 3.6) parts.push("frisk avslutning");
  } else if (colour === "mousserande") {
    parts.push("Livligt mousserande, frisk syra, citrus och äpple");
  } else if (colour === "dessert") {
    parts.push("Uttalad sötma med honung och torkad frukt");
  } else {
    parts.push("Fruktig och balanserad stil");
  }

  return parts.join(", ") + ".";
}

function computeTasteFromDRT(druvorRaw?: string, land_region?: string, typ?: string): DRT | null {
  const grape = (druvorRaw || "").toLowerCase();
  const region = land_region || "";
  const colour = (() => {
    const t = (typ || "").toLowerCase();
    if (/mousserande|sparkling|cava|crémant|champagne|prosecco/.test(t)) return "mousserande";
    if (/ros[eéáå]|rosado|rosato/.test(t)) return "rosé";
    if (/rött|rosso|rouge|tinto/.test(t)) return "rött";
    if (/vitt|white|blanc|bianco|weiß|weiss/.test(t)) return "vitt";
    return "okänt";
  })();

  const baseKey = Object.keys(GRAPE_BASE).find((key) => grape.includes(key));
  if (!baseKey) return null;

  const adjusted = regionAdjust(GRAPE_BASE[baseKey], region, colour);
  return { ...adjusted, text: drtText(baseKey, region, colour, adjusted) };
}

function defaultMeters(colour: string, body: string, sweetness: string) {
  const sötma = sweetness === "söt" ? 4.2 : sweetness === "halvsöt" ? 2.8 : colour === "mousserande" ? 1.2 : 1.0;
  const fyllighet = body === "kraftfull" ? 4.0 : body === "lätt" ? 2.2 : 3.2;
  const fruktighet = colour === "rött" ? (body === "kraftfull" ? 3.6 : 3.2) : colour === "dessert" ? 4.2 : 3.4;
  const fruktsyra = colour === "rött" ? (body === "kraftfull" ? 2.6 : 3.2) : colour === "dessert" ? 3.0 : 3.8;

  return { sötma, fyllighet, fruktighet, fruktsyra };
}

function fillMissingFields(
  finalData: WineSummary,
  webData: WineSearchResult | null,
  ocrText: string,
  allowHeuristics = true
): WineSummary {
  const fields: Array<keyof WineSummary> = [
    "vin",
    "land_region",
    "producent",
    "druvor",
    "årgång",
    "typ",
    "färgtyp",
    "klassificering",
    "alkoholhalt",
    "volym",
    "karaktär",
    "smak",
    "servering",
    "källa",
  ];

  for (const field of fields) {
    const currentValue = finalData[field];
    const candidate = webData?.[field];
    if (isBlank(currentValue) && typeof candidate === "string" && !isBlank(candidate)) {
      finalData[field] = candidate as WineSummary[typeof field];
    }
  }

  const fromWebPairings = Array.isArray(webData?.passar_till)
    ? webData.passar_till.filter((item): item is string => typeof item === "string" && !isBlank(item))
    : [];
  const existingPairings = finalData.passar_till.filter((item) => typeof item === "string" && !isBlank(item));
  finalData.passar_till = Array.from(new Set([...existingPairings, ...fromWebPairings])).slice(0, 5);

  const meters = finalData.meters ?? { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null };

  if (allowHeuristics) {
    const colour = detectColour(finalData, ocrText);
    const body = detectBody(finalData, ocrText);
    const sweetness = detectSweetness(finalData, ocrText);
    const drt = computeTasteFromDRT(finalData.druvor, finalData.land_region, finalData.typ);

    if (finalData.passar_till.length < 3) {
      finalData.passar_till = defaultPairings(colour, body, sweetness);
    }

    if (isBlank(finalData.servering)) {
      finalData.servering = defaultServing(colour, body, sweetness);
    }

    if (isBlank(finalData.karaktär)) {
      finalData.karaktär = defaultCharacter(colour, body, sweetness);
    }

    if (isBlank(finalData.smak)) {
      finalData.smak = drt ? drt.text : defaultTaste(colour, body, sweetness);
    }

    const defaults = drt
      ? { sötma: drt.sötma, fyllighet: drt.fyllighet, fruktighet: drt.fruktighet, fruktsyra: drt.fruktsyra }
      : defaultMeters(colour, body, sweetness);
    finalData.meters = {
      sötma: typeof meters.sötma === "number" ? meters.sötma : defaults.sötma,
      fyllighet: typeof meters.fyllighet === "number" ? meters.fyllighet : defaults.fyllighet,
      fruktighet: typeof meters.fruktighet === "number" ? meters.fruktighet : defaults.fruktighet,
      fruktsyra: typeof meters.fruktsyra === "number" ? meters.fruktsyra : defaults.fruktsyra,
    };
  } else {
    finalData.meters = {
      sötma: typeof meters.sötma === "number" ? meters.sötma : null,
      fyllighet: typeof meters.fyllighet === "number" ? meters.fyllighet : null,
      fruktighet: typeof meters.fruktighet === "number" ? meters.fruktighet : null,
      fruktsyra: typeof meters.fruktsyra === "number" ? meters.fruktsyra : null,
    };
  }

  finalData.evidence = finalData.evidence ?? { etiketttext: clamp(ocrText), webbträffar: [] };
  finalData.evidence = {
    etiketttext: finalData.evidence.etiketttext || clamp(ocrText),
    webbträffar: ensureStringArray(finalData.evidence.webbträffar),
  };

  const meterKeys: Array<keyof WineSummary["meters"]> = ["sötma", "fyllighet", "fruktighet", "fruktsyra"];
  const webMetersProvided =
    !!webData?.meters && meterKeys.some((key) => typeof webData.meters?.[key] === "number");

  finalData._meta = finalData._meta || {};
  const meta = finalData._meta as {
    meters_source?: string;
    confidence?: Record<string, number>;
    [key: string]: unknown;
  };
  meta.meters_source = webMetersProvided ? "web" : "derived";
  const confidenceMeta =
    meta.confidence && typeof meta.confidence === "object" && !Array.isArray(meta.confidence)
      ? { ...meta.confidence }
      : {};
  confidenceMeta.meters = webMetersProvided ? 0.9 : 0.5;
  meta.confidence = confidenceMeta;

  return finalData;
}

function selectAuthoritative(webData: WineSearchResult | null) {
  const picked: Partial<WineSummary> = {};
  const confidence: Record<string, number> = {};
  const hits = ensureStringArray(webData?.källor)
    .map((url) => ({ url, _w: weightSource(url) }))
    .filter((hit) => !!hit.url)
    .sort((a, b) => b._w - a._w);

  const topWeight = hits[0]?._w ?? 0;
  const fallbackMode = webData?.fallback_mode === true;
  const baseConfidence = fallbackMode
    ? 0.25
    : topWeight >= 5
      ? 0.95
      : topWeight >= 4
        ? 0.9
        : topWeight >= 3
          ? 0.8
          : topWeight >= 2
            ? 0.65
            : topWeight >= 1
              ? 0.45
              : 0.25;
  const textConfidence = fallbackMode
    ? 0.25
    : topWeight >= 4
      ? 0.9
      : topWeight >= 3
        ? 0.75
        : topWeight >= 2
          ? 0.55
          : topWeight >= 1
            ? 0.35
            : 0.2;

  const stringFields: Array<keyof WineSummary> = [
    "vin",
    "land_region",
    "producent",
    "druvor",
    "årgång",
    "typ",
    "färgtyp",
    "klassificering",
    "alkoholhalt",
    "volym",
    "karaktär",
    "smak",
    "servering",
    "källa",
  ];

  for (const field of stringFields) {
    const value = webData?.[field];
    if (typeof value === "string" && !isBlank(value)) {
      picked[field] = value;
      confidence[field] = field === "karaktär" || field === "smak" || field === "servering" ? textConfidence : baseConfidence;
    }
  }

  if (Array.isArray(webData?.passar_till) && webData.passar_till.length > 0) {
    const pairings = ensureStringArray(webData.passar_till).filter((item) => !isBlank(item));
    if (pairings.length) {
      picked.passar_till = pairings;
      confidence.passar_till = baseConfidence;
    }
  }

  if (webData?.meters) {
    const meters: Partial<WineSummary["meters"]> = {};
    if (typeof webData.meters.sötma === "number") meters.sötma = webData.meters.sötma;
    if (typeof webData.meters.fyllighet === "number") meters.fyllighet = webData.meters.fyllighet;
    if (typeof webData.meters.fruktighet === "number") meters.fruktighet = webData.meters.fruktighet;
    if (typeof webData.meters.fruktsyra === "number") meters.fruktsyra = webData.meters.fruktsyra;
    if (Object.keys(meters).length) {
      picked.meters = {
        sötma: meters.sötma ?? null,
        fyllighet: meters.fyllighet ?? null,
        fruktighet: meters.fruktighet ?? null,
        fruktsyra: meters.fruktsyra ?? null,
      };
      confidence.meters = baseConfidence;
      if (typeof meters.fruktsyra === "number") {
        confidence.syra = baseConfidence;
      }
    }
  }

  if (!picked.källa && hits.length > 0) {
    picked.källa = hits[0].url;
    confidence.källa = baseConfidence;
  }

  return { picked, confidence, hits };
}

function buildSearchVariants(ocr: string) {
  const raw = ocr.replace(/\s+/g, " ").trim();
  const noAcc = stripDiacritics(raw);
  const alias = noAcc.replace(/\bEgri\b/gi, "Eger").replace(/\bPinc(e|é)szete?\b/gi, "Winery");
  const base = [raw, noAcc, alias].filter((v, i, a) => v && a.indexOf(v) === i);

  const monopol = ["systembolaget.se", "vinmonopolet.no", "alko.fi", "saq.com", "lcbo.com"];
  const retailers = ["wine-searcher.com", "wine.com", "totalwine.com", "waitrose.com", "tesco.com", "majestic.co.uk"];
  const proMags = ["decanter.com", "winemag.com", "jancisrobinson.com", "falstaff.com"];
  const community = ["vivino.com", "cellartracker.com"];

  const withSite = (terms: string[], doms: string[]) => terms.flatMap(t => doms.map(d => `site:${d} ${t}`));

  return [
    ...withSite(base, ["systembolaget.se"]),
    ...base.map(t => `${t} site:.it OR site:.fr OR site:.es OR site:.hu`),
    ...withSite(base, monopol.filter(d => d !== "systembolaget.se")),
    ...withSite(base, retailers),
    ...withSite(base, proMags),
    ...withSite(base, community),
  ].slice(0, 12);
}

function sanitize(data: WineSummary): WineSummary {
  if (data.smak && /tekniskt fel|ingen läsbar text|ocr|error/i.test(data.smak)) {
    data.smak = "–";
  }
  return data;
}

function enrichFallback(ocrText: string, data: WineSummary): WineSummary {
  const t = (ocrText || "").toLowerCase();
  const hasTokaji = /tokaji/.test(t);
  const hasFurmint = /furmint/.test(t);

  if (hasTokaji && hasFurmint) {
    data.vin = data.vin && data.vin !== "–" ? data.vin : "Tokaji Furmint";
    data.land_region = data.land_region && data.land_region !== "–" ? data.land_region : "Ungern, Tokaj";
    data.druvor = data.druvor && data.druvor !== "–" ? data.druvor : "Furmint";
    data.karaktär = data.karaktär && data.karaktär !== "–" ? data.karaktär : "Friskt & fruktigt";
    data.smak = data.smak && !/Ingen läsbar text/i.test(data.smak) && data.smak !== "–" ? data.smak :
      "Friskt och fruktigt med inslag av citrus, gröna äpplen och lätt honung/mineral.";
    data.servering = data.servering && data.servering !== "–" ? data.servering : "8–10 °C";
    data.passar_till = Array.isArray(data.passar_till) && data.passar_till.length ? data.passar_till : ["fisk", "kyckling", "milda ostar"];
  }
  return data;
}

export async function analyzeWineLabel(
  base64Image: string,
  mimeType: string,
): Promise<WineAnalysisResult> {
  const imageUrl = `data:${mimeType};base64,${base64Image}`;
  
  const prompt = 
    "You are a world-class sommelier. Analyze this wine label image and return a JSON object " +
    "with: wineName, producer, grapeVariety[], region, country, vintage ('N/V' if unknown), " +
    "tastingNotes (1 short paragraph), foodPairing (exactly 3 items). Return STRICT JSON. No markdown.";

  try {
    const json = await aiClient.gemini(prompt, {
      json: true,
      imageUrl,
      temperature: 0.2,
      model: "google/gemini-2.5-flash",
      timeoutMs: CFG.GEMINI_TIMEOUT_MS,
    }) as Record<string, unknown>;

    devLog("VISION RAW", JSON.stringify(json).slice(0, 600));

    devLog("PARSED JSON", json);

    const noName = !json.wineName || String(json.wineName).trim().length === 0;
    const noGrapes = !Array.isArray(json.grapeVariety) || json.grapeVariety.length === 0;
    const noRegion = !json.region || String(json.region).trim().length === 0;
    if (noName && noGrapes && noRegion) {
      throw new Error(
        "CONTENT_UNREADABLE: Label could not be reliably read (name/grapes/region empty).",
      );
    }

    if (!json.wineName || !Array.isArray(json.foodPairing)) {
      throw new Error("FORMAT_INVALID_JSON: Analysis JSON missing required fields");
    }

    const result = json as WineAnalysisResult;

    if (isWeakNotes(result.tastingNotes)) {
      devLog("TASTE FALLBACK TRIGGER", {
        wine: result.wineName,
        grapes: result.grapeVariety,
        region: result.region,
      });
      const taste = await buildTasteWithAI(result);
      if (taste?.summary?.trim()) {
        result.tastingNotes = taste.summary.trim();
        if (!result.smak || isWeakNotes(result.smak)) {
          result.smak = result.tastingNotes;
        }
      } else {
        const inferredStyle = inferStyleFromGrapes(result.grapeVariety ?? []);
        const isRed =
          (result.grapeVariety?.[0] || "").toLowerCase().includes("kadarka") ||
          result.region?.toLowerCase().includes("szekszárd") ||
          inferredStyle === "red";
        result.tastingNotes = isRed
          ? "Lätt rött med röd frukt, frisk syra och låg tannin – drickvänligt och matvänligt."
          : "Friskt, fruktigt och torrt med balanserad syra och ren avslutning.";
        if (!result.smak || isWeakNotes(result.smak)) {
          result.smak = result.tastingNotes;
        }
      }
    }

    if (!result.foodPairing || result.foodPairing.length !== 3) {
      const fp = await buildFoodPairingIfMissing(result);
      if (fp) result.foodPairing = fp;
    }

    if ((!Array.isArray(result.passar_till) || result.passar_till.length === 0) && Array.isArray(result.foodPairing)) {
      result.passar_till = [...result.foodPairing];
    }

    devLog("FINAL RESULT", result);
    return result;
  } catch (error) {
    console.error("Error in analyzeWineLabel:", error);
    if (
      error instanceof Error &&
      !error.message.includes("CONTENT_UNREADABLE") &&
      !error.message.includes("FORMAT_INVALID_JSON") &&
      error.message.toLowerCase().includes("json")
    ) {
      throw new Error(
        "FORMAT_INVALID_JSON: The AI failed to return a valid analysis. The label might be unclear or unreadable.",
      );
    }
    throw error;
  }
}

async function buildTasteWithAI(
  analysis: WineAnalysisResult,
  ocrText?: string,
): Promise<{ tasteProfile: Record<string, number>; summary: string } | null> {
  const grapes = (analysis.grapeVariety || []).filter(Boolean);
  const region = analysis.region || null;
  const country = analysis.country || null;
  const style: WineStyle = inferStyleFromGrapes(grapes);
  const abv = null;
  const sweetness = null;
  const oakMentioned = false;
  const labelNotes = (ocrText || "").slice(0, 800);

  const input = { grapes, region, country, style, abv, sweetness, oakMentioned, labelNotes };
  devLog("TASTE INPUT", input);

  const prompt = TASTE_PRIMARY_PROMPT + "\nINPUT:\n" + JSON.stringify(input);
  
  let parsed: unknown;
  try {
    parsed = await aiClient.gemini(prompt, {
      json: true,
      temperature: 0.3,
      model: "google/gemini-2.5-flash",
      timeoutMs: CFG.GEMINI_TIMEOUT_MS,
    });
    devLog("TASTE RAW", JSON.stringify(parsed).slice(0, 600));
  } catch (error) {
    devLog("TASTE PRIMARY FAILED", error);
    // Retry with repair prompt
    try {
      const repairPrompt = TASTE_REPAIR_PROMPT + "\nINPUT:\n" + JSON.stringify(input) + "\nPREVIOUS:\n" + JSON.stringify(parsed || "");
      parsed = await aiClient.gemini(repairPrompt, {
        json: true,
        temperature: 0.2,
        model: "google/gemini-2.5-flash",
        timeoutMs: CFG.GEMINI_TIMEOUT_MS,
      });
      devLog("TASTE REPAIR RAW", JSON.stringify(parsed).slice(0, 600));
    } catch {
      parsed = null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;

  const candidate = parsed as {
    tasteProfile?: Record<string, unknown>;
    summary?: unknown;
  };

  if (!candidate.tasteProfile || typeof candidate.summary !== "string") return null;

  const clampValue = (v: number) => Math.max(1, Math.min(5, Math.round(v * 2) / 2));
  const metrics = ["sotma", "fyllighet", "fruktighet", "syra", "tannin", "ek"] as const;
  const tasteProfile: Record<string, number> = {};

  for (const key of metrics) {
    const value = Number(candidate.tasteProfile[key]);
    if (!Number.isFinite(value)) {
      return null;
    }
    tasteProfile[key] = clampValue(value);
  }

  return { tasteProfile, summary: candidate.summary.trim() };
}

async function buildFoodPairingIfMissing(
  analysis: WineAnalysisResult,
): Promise<string[] | null> {
  if (analysis.foodPairing && analysis.foodPairing.length === 3) return null;

  const ask = `
Suggest EXACTLY three specific food pairings as a STRICT JSON array of strings.
Use the wine's grapes/region/style if given. No prose, JSON array only.
  `.trim();

  const promptObj = {
    name: analysis.wineName || "",
    producer: analysis.producer || "",
    grapes: analysis.grapeVariety || [],
    region: analysis.region || "",
    country: analysis.country || "",
  };

  const prompt = ask + "\nINPUT:\n" + JSON.stringify(promptObj);

  try {
    const parsed = await aiClient.gemini(prompt, {
      json: true,
      temperature: 0.35,
      model: "google/gemini-2.5-flash",
      timeoutMs: CFG.GEMINI_TIMEOUT_MS,
    }) as unknown;
    devLog("FOOD RAW", JSON.stringify(parsed).slice(0, 400));
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((x): x is string => typeof x === "string")) {
      return parsed;
    }
  } catch {
    // ignore JSON parse issues and fall back to null
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const key = url.searchParams.get("key")?.trim();
      if (!key) {
        return new Response(JSON.stringify({ ok: false, error: "missing key" }), {
          status: 400,
          headers: { ...cors, "content-type": "application/json" },
        });
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ ok: false, error: "server not configured" }), {
          status: 500,
          headers: { ...cors, "content-type": "application/json" },
        });
      }
      const cachedPayload = await getAnalysisFromServerCache(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        key,
      );
      if (!cachedPayload) {
        return new Response(JSON.stringify({ ok: false, error: "not found" }), {
          status: 404,
          headers: {
            ...cors,
            "content-type": "application/json",
            "Cache-Control": "public, max-age=60",
          },
        });
      }
      const cacheHeaders = {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        Vary: "Accept-Encoding",
      };
      return new Response(JSON.stringify({ ok: true, data: cachedPayload, note: "hit_analysis_cache_get" }), {
        status: 200,
        headers: { ...cors, ...cacheHeaders, "content-type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "GET failed" }),
        {
          status: 500,
          headers: { ...cors, "content-type": "application/json" },
        },
      );
    }
  }
  if (req.method !== "POST")
    return new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
      status: 405,
      headers: { ...cors, "content-type": "application/json" },
    });

  try {
    // Validate API keys
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing PERPLEXITY_API_KEY" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Supabase credentials" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const reqJson = await req.json();
    const imageBase64 = typeof reqJson?.imageBase64 === "string" ? reqJson.imageBase64 : null;
    const clientWantsHeuristics = Boolean(reqJson?.allowHeuristics === true);
    const ocrTextFromClient = typeof reqJson?.ocrText === "string" ? reqJson.ocrText : "";
    const ocrImageHash = typeof reqJson?.ocr_image_hash === "string" ? reqJson.ocr_image_hash : null;
    const vintageHint = typeof reqJson?.vintage === "string" && reqJson.vintage.trim() ? reqJson.vintage.trim() : null;

    if (!imageBase64) {
      return new Response(JSON.stringify({ ok: false, error: "Missing image data" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Wine analysis started`);

    let analysisKey = "";

    // Step 1: OCR (try client/server cache before Gemini)
    let ocrText = ocrTextFromClient;
    let ocrSource: "client" | "server_cache" | "gemini" | "unknown" = ocrText ? "client" : "unknown";

    if ((!ocrText || ocrText.length < 5) && ocrImageHash) {
      try {
        const cached = await getOcrFromServerCache(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ocrImageHash);
        if (cached && cached.length >= 5) {
          ocrText = cached;
          ocrSource = "server_cache";
          console.log(`[${new Date().toISOString()}] Server OCR cache hit (length: ${cached.length}).`);
        }
      } catch (error) {
        console.warn("[wine-vision] Server OCR cache lookup failed", error);
      }
    }

    if (!ocrText || ocrText.length < 5) {
      const ocrStart = Date.now();
      console.log(`[${new Date().toISOString()}] Starting OCR via Gemini...`);

      try {
        ocrText = await aiClient.gemini("Läs exakt all text på vinflasketiketten och returnera endast ren text.", {
          imageUrl: imageBase64,
          timeoutMs: CFG.GEMINI_TIMEOUT_MS,
        });
        const ocrTime = Date.now() - ocrStart;
        ocrSource = "gemini";
        console.log(`[${new Date().toISOString()}] OCR success (${ocrTime}ms), text length: ${ocrText.length}`);
      } catch (error) {
        const ocrTime = Date.now() - ocrStart;
        console.error(`[${new Date().toISOString()}] OCR error (${ocrTime}ms):`, error);
        return new Response(
          JSON.stringify({ ok: false, error: "OCR misslyckades" }),
          { status: 500, headers: { ...cors, "content-type": "application/json" } }
        );
      }
    }

    if (!ocrText || ocrText.length < 5) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ingen text hittades på etiketten" }),
        { status: 400, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    console.log(`[${new Date().toISOString()}] OCR source: ${ocrSource}`);

    // Check cache (memory first, then Supabase)
    const cacheKey = getCacheKey(ocrText);

    const resolvedVintage = vintageHint || detectVintage(ocrText) || "NV";
    const analysisKeyBase = normalizeForAnalysisKey(ocrText);
    analysisKey = analysisKeyBase ? `${analysisKeyBase}.y${resolvedVintage}` : "";

    // Try memory cache
    const memoryHit = getFromMemoryCache(cacheKey);
    if (memoryHit) {
      const cacheTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Memory cache hit! (${cacheTime}ms)`);
      return new Response(JSON.stringify({ 
        ok: true, 
        data: memoryHit.data, 
        note: "hit_memory" 
      }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    // Try Supabase cache
    const supabaseHit = await getFromSupabaseCache(cacheKey, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (supabaseHit) {
      const cacheTime = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] Supabase cache hit! (${cacheTime}ms)`);

      setMemoryCache(cacheKey, supabaseHit.data);

      return new Response(JSON.stringify({
        ok: true,
        data: supabaseHit.data,
        note: "hit_supabase"
      }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    if (analysisKey && analysisKey.length >= 6) {
      try {
        const cachedPayload = await getAnalysisFromServerCache(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          analysisKey,
        );
        if (cachedPayload && typeof cachedPayload === "object") {
          const totalTime = Date.now() - startTime;
          console.log(`[CACHE] hit analysis cache key=${analysisKey} total=${totalTime}ms`);
          return new Response(
            JSON.stringify({
              ok: true,
              data: cachedPayload,
              note: "hit_analysis_cache",
              timings: { t_preprocess: 0, t_ocr: 0, t_search: 0, t_llm: 0, t_total: totalTime },
            }),
            {
              headers: {
                ...cors,
                "content-type": "application/json",
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
              },
            },
          );
        }
      } catch (error) {
        console.warn("Analysis cache lookup failed:", error);
      }
    }

    console.log(`[${new Date().toISOString()}] Cache miss, proceeding with analysis...`);

    // Step 2: Web search (Perplexity/Gemini fast-path)
    let cacheNote = "";
    const defaultWeb: WineSearchResult = {
      vin: "-",
      producent: "-",
      druvor: "-",
      land_region: "-",
      årgång: "-",
      alkoholhalt: "-",
      volym: "-",
      klassificering: "-",
      karaktär: "-",
      smak: "-",
      servering: "-",
      passar_till: [],
      källor: [],
      fallback_mode: true,
    };

    const { web: webResult, meta: webMeta } = await parallelWeb(ocrText, imageBase64);
    let webJson: WineSearchResult | null = webResult ? { ...webResult, fallback_mode: false } : null;

    if (!webJson && PERPLEXITY_GATEWAY_URL && PERPLEXITY_API_KEY) {
      try {
        const fast = await safeWebFetch(
          PERPLEXITY_GATEWAY_URL,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            },
            body: JSON.stringify({ q: ocrText, max_results: CFG.MAX_WEB_URLS }),
          },
          CFG.FAST_TIMEOUT_MS,
        );

        if (fast?.ok) {
          const gatewayJson = await fast.json().catch(() => null);
          const normalizedFast = normalizeGatewayResult(gatewayJson);
          if (normalizedFast) {
            webJson = { ...normalizedFast, fallback_mode: false };
            console.log(
              `[${new Date().toISOString()}] Fast gateway search success – using ${webJson.källor?.[0] ?? "unknown source"}`,
            );
          }
        }
      } catch (fastError) {
        console.warn("[wine-vision] Fast gateway search failed", fastError);
      }
    }

    const WEB_JSON: WineSearchResult = webJson ? { ...webJson } : { ...defaultWeb };

    if (!webResult && PERPLEXITY_API_KEY) {
      if (webMeta.pplx_status === "timeout") {
        cacheNote = "perplexity_timeout";
      } else if (webMeta.pplx_status === "error") {
        cacheNote = "perplexity_failed";
      }
    }

    if (!webJson) {
      console.log(`[${new Date().toISOString()}] No web data found – falling back to heuristics.`);
    }

// Step 3: Gemini summarization (strict JSON)
    const geminiStart = Date.now();
    console.log(`[${new Date().toISOString()}] Starting Gemini summarization...`);

    let finalData = createEmptySummary();
    try {
      const hasWebData = (WEB_JSON.källor ?? []).length > 0;
      
      const gemPrompt = `
DU ÄR: En AI-sommelier. ${hasWebData ? 'Använd OCR_TEXT (etiketten) och WEB_JSON (verifierad fakta).' : 'Använd OCR_TEXT från etiketten och din kunskap om vin för att analysera vinet.'} 
Svara ENDAST med giltig JSON enligt schema.

${hasWebData ? '' : 'VIKTIGT: Eftersom inga webbkällor finns tillgängliga, använd din kunskap om vinregioner, druvor och producenter för att ge en komplett analys baserat på etiketten. Fyll i alla fält så gott du kan baserat på OCR-texten och allmän vinkunskap.'}

REGLER:
- "Egri" = region "Eger" (översätt).
- Typ/färg: härled endast från tydliga ord (Prosecco/Cava/Champagne/Spumante/Frizzante => "mousserande"; Rosé/Rosato/Rosado => "rosé"; Bianco/Blanc/White => "vitt"; Rosso/Rouge/Red => "rött").
- **alkoholhalt & volym**: Försök ALLTID extrahera från OCR_TEXT först (sök efter "%" och "ml/cl/L"). Om saknas och webbdata finns, använd det. Om helt saknas, sätt "-".
- **karaktär**: ${hasWebData ? 'Använd webbdata om finns, annars' : 'Använd'} din kunskap om druva, region och stil för att beskriva vinet kort (max 15 ord). Aldrig "-".
- **smak**: ${hasWebData ? 'Använd webbdata om uttrycklig smakbeskrivning finns. Om saknas eller vag' : 'Använd din kunskap om druva och region för att'}, generera en detaljerad smakprofil baserat på druva + region + alkoholhalt + karaktär. Inkludera frukt, kryddor, och struktur. Minst 10 ord, aldrig "-".
- **servering**: ${hasWebData ? 'Använd webbdata om finns, annars g' : 'G'}enerera ALLTID serveringstemperatur och matchtips baserat på vintyp (vitt 8-12°C, rosé 10-12°C, lätt rött 14-16°C, fylligt rött 16-18°C). Aldrig "-".
- undantag: för mousserande får "sötma" mappas deterministiskt:
  Brut Nature/Pas Dosé/Dosage Zéro=0; Extra Brut=0.5; Brut=1; Extra Dry=1.5; Dry/Sec=2.2; Demi-Sec/Semi-Seco=3.4; Dolce/Sweet=4.5.
- **METERS (OBLIGATORISKT - ALLTID FYLL I)**: Baserat på druva, region, alkoholhalt, och smakbeskrivning, generera ALLTID exakta värden 1-5:
  * **sötma**: 1=torrt (t.ex. Bordeaux, Chianti, Barolo), 2=halvtorrt (vissa Riesling), 3=medelsött (Liebfraumilch), 4=sött (Sauternes), 5=mycket sött (Tokaji Aszú). För mousserande: Brut Nature=1, Extra Brut=1, Brut=1, Extra Dry=2, Dry/Sec=2, Demi-Sec=3, Dolce/Sweet=5.
  * **fyllighet**: 1=lätt kropp (Pinot Grigio, Vinho Verde), 2=lätt-medel (Beaujolais, Grüner Veltliner), 3=medelfylligt (Chianti, Côtes du Rhône, 12-13% alkohol), 4=fylligt (Bordeaux, Rioja, Chardonnay med fat, 13.5-14% alkohol), 5=mycket fylligt (Amarone, Barolo, 14.5%+ alkohol). Använd alkoholhalt som vägledning.
  * **fruktighet**: 1=låg (mineraldrivna viner, Chablis), 2=låg-medel (Pinot Noir från Bourgogne), 3=medelfruktigt (Chianti, Rioja Crianza), 4=fruktig (Malbec, Zinfandel, Shiraz, "fruktig" i beskrivningen), 5=mycket fruktig (New World Shiraz, fruktbomb-stilar).
  * **fruktsyra**: 1=låg syra (Amarone, Valpolicella Ripasso), 2=låg-medel (Merlot, Grenache), 3=medelsyra (Bordeaux, Rioja), 4=frisk syra (Chianti, Pinot Noir, Riesling), 5=hög syra (Sangiovese, Nebbiolo, mycket friska vita viner).
  ${hasWebData ? 'Använd WEB_JSON som utgångspunkt men KORRIGERA om värdena verkar felaktiga baserat på vintyp.' : ''} Om inga exakta värden finns, HÄRLED logiskt från druva + region + alkoholhalt + smakbeskrivning. Meters får ALDRIG vara null!
- MATPARNINGAR (passar_till): GENERERA ALLTID 3-5 lämpliga maträtter baserat på vinets druva, region, stil och karaktär. Använd klassiska sommelierregler:
  * Vitt vin (lätt & friskt): skaldjur, vitfisk, kyckling, sallader, milda ostar
  * Vitt vin (fylligt): grillad fisk, fläskkött, krämiga pastarätter, svamprätter
  * Rött vin (lätt): pasta, pizza, kyckling, lättare kötträtter
  * Rött vin (medelfylligt): nötkött, lamm, lasagne, hårdostar
  * Rött vin (kraftfullt): grillat kött, vilt, BBQ, kraftfulla ostar
  * Rosé: sallader, grillat, kyckling, pizza, asiatiskt
  * Mousserande: aperitif, skaldjur, sushi, friterad mat
  Om WEB_JSON.passar_till har värden, använd dem som utgångspunkt och komplettera.
- Vid konflikt: Systembolaget > producent > nordiska monopol > Vivino/Wine-Searcher.
- Saknas uppgift: "-" (men passar_till ska ALDRIG vara tom!).
- "källa": ${hasWebData ? 'välj viktigaste URL från WEB_JSON.källor (Systembolaget om finns)' : 'sätt till "-" eftersom inga webbkällor finns'}.
- "evidence": etiketttext = första ~200 tecken av OCR_TEXT; webbträffar = ${hasWebData ? 'upp till 3 URL:er' : 'tom array []'}.
- KRITISKT KRAV: ALL text i JSON-outputen MÅSTE vara på SVENSKA. Om WEB_JSON innehåller ungerska, engelska eller andra språk i fält som "karaktär", "smak", "klassificering", "servering" - ÖVERSÄTT dem till svenska. Ord som "Savhangsúlyos", "Fajtajellegges", "száraz" måste översättas (t.ex. "syrabetonad", "sortkaraktäristisk", "torr").

SCHEMA:
{
  "vin": "", "land_region": "", "producent": "", "druvor": "", "årgång": "",
  "typ": "", "färgtyp": "", "klassificering": "", "alkoholhalt": "", "volym": "",
  "karaktär": "", "smak": "", "passar_till": [], "servering": "", "källa": "",
  "meters": { "sötma": 1-5, "fyllighet": 1-5, "fruktighet": 1-5, "fruktsyra": 1-5 },
  "evidence": { "etiketttext": "", "webbträffar": [] }
}

OCR_TEXT:
<<<${ocrText}>>>

WEB_JSON:
<<<${JSON.stringify(WEB_JSON)}>>>
      `.trim();

      const geminiResult = await aiClient.gemini(gemPrompt, {
        json: true,
        timeoutMs: CFG.GEMINI_TIMEOUT_MS,
      });

      finalData = normalizeWineSummary(geminiResult);

      console.log(`[${new Date().toISOString()}] Gemini finalData:`, JSON.stringify(finalData, null, 2));

      // Ensure proper structure
      if (!finalData.källa || finalData.källa === "-") {
        finalData.källa = WEB_JSON.källor?.[0] ?? "-";
      }
      finalData.evidence = finalData.evidence || { etiketttext: "", webbträffar: [] };
      finalData.evidence.etiketttext = finalData.evidence.etiketttext || clamp(ocrText);
      finalData.evidence.webbträffar = (WEB_JSON.källor ?? []).slice(0, CFG.MAX_WEB_URLS);

      const geminiTime = Date.now() - geminiStart;
      console.log(`[${new Date().toISOString()}] Gemini success (${geminiTime}ms)`);
    } catch (error) {
      const geminiTime = Date.now() - geminiStart;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      console.error(`[${new Date().toISOString()}] Gemini error (${geminiTime}ms):`, errorMsg);
      
      if (errorMsg === "rate_limit_exceeded") {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Rate limits exceeded, please try again shortly." 
          }),
          { status: 429, headers: { ...cors, "content-type": "application/json" } }
        );
      }
      if (errorMsg === "payment_required") {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: "Payment required. Please add credits to your Lovable workspace." 
          }),
          { status: 402, headers: { ...cors, "content-type": "application/json" } }
        );
      }
      
      // Graceful fallback: use WEB_JSON (from Perplexity or Vision) if available
      try {
        console.warn("[wine-vision] Falling back to WEB_JSON-only summary due to Gemini failure");
        const fallback = normalizeWineSummary(WEB_JSON || createEmptySummary());
        finalData = fallback;
      } catch (e) {
        console.error("[wine-vision] Fallback normalization failed:", e);
        // If even fallback fails, return minimal but valid payload to avoid 500s
        finalData = createEmptySummary();
        finalData.evidence = { etiketttext: clamp(ocrText), webbträffar: [] };
      }
    }

    // Post-process med auktoritativt källval
    const { picked: fromTrusted, confidence: conf, hits } = selectAuthoritative(webJson);

    for (const [key, value] of Object.entries(fromTrusted)) {
      if (key === "passar_till" && Array.isArray(value)) {
        if (!Array.isArray(finalData.passar_till) || finalData.passar_till.length === 0) {
          finalData.passar_till = ensureStringArray(value);
        }
        continue;
      }
      if (key === "meters" && value && typeof value === "object") {
        const meters = finalData.meters ?? { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null };
        const trusted = value as WineSummary["meters"];
        finalData.meters = {
          sötma: typeof meters.sötma === "number" ? meters.sötma : trusted.sötma ?? null,
          fyllighet: typeof meters.fyllighet === "number" ? meters.fyllighet : trusted.fyllighet ?? null,
          fruktighet: typeof meters.fruktighet === "number" ? meters.fruktighet : trusted.fruktighet ?? null,
          fruktsyra: typeof meters.fruktsyra === "number" ? meters.fruktsyra : trusted.fruktsyra ?? null,
        };
        continue;
      }

      if (key in finalData && !isBlank(value)) {
        const field = key as keyof WineSummary;
        if (isBlank(finalData[field])) {
          finalData[field] = value as WineSummary[typeof field];
        }
      }
    }

    const meta = (finalData._meta || {}) as any;
    meta.confidence_per_field = {
      ...(meta.confidence_per_field || {}),
      ...conf,
    };
    meta.source_breakdown = hits?.map((h) => ({ url: h.url, weight: h._w })) || [];
    finalData._meta = meta;

    const hasTrustedTaste =
      (conf?.smak ?? 0) >= 0.85 ||
      (conf?.karaktär ?? 0) >= 0.85 ||
      (conf?.syra ?? 0) >= 0.85;
    if (!hasTrustedTaste) {
      const drt = computeTasteFromDRT(finalData?.druvor, finalData?.land_region, finalData?.typ);
      if (drt) {
        if (isBlank(finalData.karaktär)) finalData.karaktär = drt.text;
        if (!finalData.meters) {
          finalData.meters = { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null };
        }
        const m = finalData.meters;
        if (m.sötma == null) m.sötma = drt.sötma;
        if (m.fyllighet == null) m.fyllighet = drt.fyllighet;
        if (m.fruktighet == null) m.fruktighet = drt.fruktighet;
        if (m.fruktsyra == null) m.fruktsyra = drt.fruktsyra;
        const meta = (finalData._meta || {}) as any;
        meta.fallback = "drt";
        finalData._meta = meta;
      }
    }

    // Vanlig sanity & icke-kritiska texter
    finalData = enrichFallback(ocrText, finalData);
    finalData = sanitize(finalData);

    const heuristicsAuto = !clientWantsHeuristics && (webMeta.fastPathHit || !webJson);
    const allowHeuristics = clientWantsHeuristics || webMeta.fastPathHit || !webJson;

    const combinedWeb = webJson
      ? ({ ...webJson, ...fromTrusted } as WineSearchResult)
      : (Object.keys(fromTrusted).length ? (fromTrusted as unknown as WineSearchResult) : null);

    finalData = fillMissingFields(finalData, combinedWeb ?? WEB_JSON, ocrText, allowHeuristics);

    if (!cacheNote && heuristicsAuto) {
      cacheNote = webMeta.fastPathHit ? "fastpath" : "fastpath_heuristic";
    }

    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Total processing time: ${totalTime}ms`);
    console.log(JSON.stringify({
      note: cacheNote || "success",
      timings: {
        total_ms: totalTime,
        pplx_ms: webMeta.pplx_ms,
        gemini_ms: webMeta.gemini_ms,
      },
      web_trace: {
        fastPathHit: webMeta.fastPathHit,
        pplx_status: webMeta.pplx_status,
        gemini_status: webMeta.gemini_status,
        heuristics_allowed: allowHeuristics,
      }
    }));

    // Store in both caches
    setMemoryCache(cacheKey, finalData);
    await setSupabaseCache(cacheKey, finalData, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (analysisKey && analysisKey.length >= 6) {
      try {
        await upsertAnalysisServerCache(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          analysisKey,
          finalData,
        );
      } catch (error) {
        console.warn("Analysis cache upsert failed:", error);
      }
    }

    if (ocrImageHash && ocrText && ocrText.length >= 5) {
      try {
        await upsertOcrServerCache(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ocrImageHash, ocrText);
      } catch (error) {
        console.warn("[wine-vision] Server OCR cache upsert failed", error);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: finalData,
        note: cacheNote || "success"
      }),
      {
        headers: {
          ...cors,
          "content-type": "application/json",
          "Cache-Control": "public, s-maxage=60",
        },
      }
    );

  } catch (error) {
    console.error("Wine vision error:", error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...cors, "content-type": "application/json" } }
    );
  }
});
