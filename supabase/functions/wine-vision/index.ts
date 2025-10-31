import { aiClient } from "./lib/aiClient.ts";
import {
  getCacheKey,
  getFromMemoryCache,
  setMemoryCache,
  getFromSupabaseCache,
  setSupabaseCache
} from "./cache.ts";
import type { WineSearchResult, WineSummary } from "./types.ts";

const CFG = {
  PPLX_TIMEOUT_MS: 12000,   // max PPLX-tid
  GEMINI_TIMEOUT_MS: 45000, // max Gemini-tid
  FAST_TIMEOUT_MS: 3000,    // efter 3s: gå “fast path” (heuristik) om inget svar
  MAX_WEB_URLS: 3,
  PPLX_MODEL: "sonar",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

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
    .slice(0, CFG.MAX_WEB_URLS)
    .sort((a, b) => {
      const score = (u: string) =>
        u.includes("systembolaget.se") ? 5 :
        u.includes("vinmonopolet.no") || u.includes("alko.fi") || u.includes("saq.com") || u.includes("lcbo.com") ? 4 :
        u.includes("wine-searcher.com") || u.includes("wine.com") || u.includes("totalwine.com") ? 3 :
        u.includes("decanter.com") || u.includes("winemag.com") || u.includes("jancisrobinson.com") ? 2 :
        u.includes("vivino.com") || u.includes("cellartracker.com") ? 1 : 0;
      return score(b) - score(a);
    });

  return normalized;
}

async function runGeminiFast(_ocrText: string, _imageHint?: string): Promise<WebJson> {
  if (!LOVABLE_API_KEY) return null;
  return null;
}

type WebMeta = {
  fastPathHit: boolean;
  pplx_ms: number | null;
  gemini_ms: number | null;
  pplx_status: "ok" | "timeout" | "error" | "skipped" | "empty";
  gemini_status: "ok" | "timeout" | "error" | "skipped" | "empty";
};

async function parallelWeb(ocrText: string): Promise<{ web: WebJson; meta: WebMeta }> {
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

  if (LOVABLE_API_KEY) {
    const gemPromise = (async () => {
      const start = Date.now();
      try {
        const res = await withTimeout(runGeminiFast(ocrText), CFG.GEMINI_TIMEOUT_MS, "gemini");
        gemini_ms = Date.now() - start;
        gemini_status = res ? "ok" : "empty";
        return res;
      } catch (error) {
        gemini_ms = Date.now() - start;
        if (error instanceof Error && error.name === "TimeoutError") {
          gemini_status = "timeout";
        } else {
          gemini_status = "error";
          console.error(`[${new Date().toISOString()}] Gemini fast-path error (${gemini_ms}ms):`, error);
        }
        return null;
      }
    })();
    tasks.push(gemPromise);
  }

  let web: WebJson = null;

  if (tasks.length > 0) {
    try {
      web = await withTimeout(Promise.any(tasks), CFG.FAST_TIMEOUT_MS, "fastpath");
    } catch (error) {
      fastPathHit = true;
      if (error instanceof Error && error.name === "TimeoutError") {
        console.log(`[${new Date().toISOString()}] Fast-path timeout (${CFG.FAST_TIMEOUT_MS}ms) – enabling heuristics.`);
      }
    }

    if (!web) {
      const settled = await Promise.allSettled(tasks);
      for (const result of settled) {
        if (result.status === "fulfilled" && result.value) {
          web = result.value;
          break;
        }
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
      finalData.smak = defaultTaste(colour, body, sweetness);
    }

    const defaults = defaultMeters(colour, body, sweetness);
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

  return finalData;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
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

    if (!imageBase64) {
      return new Response(JSON.stringify({ ok: false, error: "Missing image data" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Wine analysis started`);

    // Step 1: OCR with Gemini
    const ocrStart = Date.now();
    console.log(`[${new Date().toISOString()}] Starting OCR...`);
    
    let ocrText = "";
    try {
      ocrText = await aiClient.gemini("Läs exakt all text på vinflasketiketten och returnera endast ren text.", {
        imageUrl: imageBase64,
        timeoutMs: CFG.GEMINI_TIMEOUT_MS,
      });
      const ocrTime = Date.now() - ocrStart;
      console.log(`[${new Date().toISOString()}] OCR success (${ocrTime}ms), text length: ${ocrText.length}`);
    } catch (error) {
      const ocrTime = Date.now() - ocrStart;
      console.error(`[${new Date().toISOString()}] OCR error (${ocrTime}ms):`, error);
      return new Response(
        JSON.stringify({ ok: false, error: "OCR misslyckades" }),
        { status: 500, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    if (!ocrText || ocrText.length < 5) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ingen text hittades på etiketten" }),
        { status: 400, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    // Check cache (memory first, then Supabase)
    const cacheKey = getCacheKey(ocrText);
    
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

    const { web: webResult, meta: webMeta } = await parallelWeb(ocrText);
    const WEB_JSON: WineSearchResult = webResult ? { ...webResult, fallback_mode: false } : { ...defaultWeb };

    if (!webResult && PERPLEXITY_API_KEY) {
      if (webMeta.pplx_status === "timeout") {
        cacheNote = "perplexity_timeout";
      } else if (webMeta.pplx_status === "error") {
        cacheNote = "perplexity_failed";
      }
    }

    if (!webResult) {
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
- karaktär/smak/servering${hasWebData ? ': fyll bara om uttryckligen i källan' : ': använd din kunskap om vintyp, druva och region för att ge rimliga värden'}; undantag: för mousserande får "sötma" mappas deterministiskt:
  Brut Nature/Pas Dosé/Dosage Zéro=0; Extra Brut=0.5; Brut=1; Extra Dry=1.5; Dry/Sec=2.2; Demi-Sec/Semi-Seco=3.4; Dolce/Sweet=4.5.
- meters (sötma/fyllighet/fruktighet/fruktsyra): ${hasWebData ? 'fyll bara om uttryckligen i källan' : 'ge rimliga värden baserat på vintyp och druva (0-5 skala)'}.
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
  "meters": { "sötma": null, "fyllighet": null, "fruktighet": null, "fruktsyra": null },
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
      
      throw new Error(errorMsg);
    }

    // Post-process
    finalData = enrichFallback(ocrText, finalData);
    finalData = sanitize(finalData);

    const heuristicsAuto = !clientWantsHeuristics && (webMeta.fastPathHit || !webResult);
    const allowHeuristics = clientWantsHeuristics || webMeta.fastPathHit || !webResult;

    finalData = fillMissingFields(finalData, WEB_JSON, ocrText, allowHeuristics);

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

    return new Response(
      JSON.stringify({ 
        ok: true, 
        data: finalData, 
        note: cacheNote || "success" 
      }),
      { headers: { ...cors, "content-type": "application/json" } }
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
