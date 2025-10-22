import { aiClient } from "./lib/aiClient.ts";
import { 
  getCacheKey, 
  getFromMemoryCache, 
  setMemoryCache, 
  getFromSupabaseCache, 
  setSupabaseCache 
} from "./cache.ts";

const CFG = {
  PPLX_TIMEOUT_MS: 12000,
  GEMINI_TIMEOUT_MS: 45000,
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

function detectColour(data: any, ocrText: string) {
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

function detectBody(data: any, ocrText: string) {
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

function detectSweetness(data: any, ocrText: string) {
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

function fillMissingFields(finalData: any, webData: any, ocrText: string) {
  const fields: Array<keyof typeof finalData> = [
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
    "källa"
  ];

  for (const field of fields) {
    if (isBlank(finalData[field]) && !isBlank(webData?.[field])) {
      finalData[field] = webData[field];
    }
  }

  const fromWebPairings = Array.isArray(webData?.passar_till) ? webData.passar_till.filter((item: unknown) => typeof item === "string" && !isBlank(item)) : [];
  const existingPairings = Array.isArray(finalData.passar_till) ? finalData.passar_till.filter((item: unknown) => typeof item === "string" && !isBlank(item)) : [];
  finalData.passar_till = Array.from(new Set([...existingPairings, ...fromWebPairings])).slice(0, 5);

  const colour = detectColour(finalData, ocrText);
  const body = detectBody(finalData, ocrText);
  const sweetness = detectSweetness(finalData, ocrText);

  if (!Array.isArray(finalData.passar_till) || finalData.passar_till.length < 3) {
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

  if (!finalData.meters) {
    finalData.meters = { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null };
  }

  const meters = finalData.meters || {};
  const defaults = defaultMeters(colour, body, sweetness);
  finalData.meters = {
    sötma: typeof meters.sötma === "number" ? meters.sötma : defaults.sötma,
    fyllighet: typeof meters.fyllighet === "number" ? meters.fyllighet : defaults.fyllighet,
    fruktighet: typeof meters.fruktighet === "number" ? meters.fruktighet : defaults.fruktighet,
    fruktsyra: typeof meters.fruktsyra === "number" ? meters.fruktsyra : defaults.fruktsyra,
  };

  if (!finalData.evidence) {
    finalData.evidence = { etiketttext: clamp(ocrText), webbträffar: [] };
  }

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

function sanitize(data: any) {
  if (data.smak && /tekniskt fel|ingen läsbar text|ocr|error/i.test(data.smak)) {
    data.smak = "–";
  }
  return data;
}

function enrichFallback(ocrText: string, data: any) {
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

    const { imageBase64 } = await req.json();

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

    // Step 2: Perplexity search with enhanced domain whitelist
    let WEB_JSON: any = {
      vin: "-", producent: "-", druvor: "-", land_region: "-", årgång: "-",
      alkoholhalt: "-", volym: "-", klassificering: "-",
      karaktär: "-", smak: "-", servering: "-", passar_till: [], källor: []
    };
    let cacheNote = "";

    if (PERPLEXITY_API_KEY) {
      const perplexityStart = Date.now();
      console.log(`[${new Date().toISOString()}] Starting Perplexity search (${CFG.PPLX_TIMEOUT_MS}ms timeout)...`);

      try {
        const queries = buildSearchVariants(ocrText);
        
        const schemaJSON = `
{
  "vin": "", "producent": "", "druvor": "", "land_region": "",
  "årgång": "", "alkoholhalt": "", "volym": "", "klassificering": "",
  "karaktär": "", "smak": "", "servering": "", "passar_till": [], "källor": []
}
`.trim();

        const systemPrompt = `Du är en extraktor som MÅSTE returnera ENBART ett giltigt, minifierat JSON-objekt enligt schema. Ingen markdown, inga backticks, ingen kommentar före eller efter. Dubbelcitat på alla nycklar/strängar. KRITISKT: ALL text i ditt svar MÅSTE vara på SVENSKA. Översätt alla beskrivningar till svenska.`;

        const pplxPrompt = `
VIN-LEDTRÅD (OCR):
"${ocrText.slice(0, 300)}"

Sök i denna prioritering med site:-filter:
${queries.slice(0, 8).map((q, i) => `${i + 1}) ${q}`).join("\n")}

Normalisera sökningen (ta bort diakritiska tecken; "Egri" ≈ "Eger").

Returnera ENBART ett JSON-objekt exakt enligt detta schema (saknas uppgift → "-"):
${schemaJSON}
        `.trim();

        WEB_JSON = await aiClient.perplexity(pplxPrompt, {
          model: CFG.PPLX_MODEL,
          timeoutMs: CFG.PPLX_TIMEOUT_MS,
          systemPrompt,
          schemaHint: schemaJSON,
        });

        console.log(`[${new Date().toISOString()}] Perplexity WEB_JSON:`, JSON.stringify(WEB_JSON, null, 2));

        // Clean and sort sources
        const sources = (WEB_JSON.källor || []) as unknown[];
        WEB_JSON.källor = Array.from(new Set(sources))
          .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http"))
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

        const perplexityTime = Date.now() - perplexityStart;
        console.log(`[${new Date().toISOString()}] Perplexity success (${perplexityTime}ms), sources: ${WEB_JSON.källor.length}`);
      } catch (error) {
        const perplexityTime = Date.now() - perplexityStart;
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        if (errorMsg === "perplexity_timeout") {
          console.log(`[${new Date().toISOString()}] Perplexity timeout (${perplexityTime}ms) - using OCR-only mode`);
          cacheNote = "perplexity_timeout";
        } else {
          console.error(`[${new Date().toISOString()}] Perplexity error (${perplexityTime}ms):`, errorMsg);
          console.error("Perplexity full error details:", error);
          cacheNote = "perplexity_failed";
        }
      }
    }

    // Step 3: Gemini summarization (strict JSON)
    const geminiStart = Date.now();
    console.log(`[${new Date().toISOString()}] Starting Gemini summarization...`);

    let finalData: any;
    try {
      const hasWebData = WEB_JSON.källor && WEB_JSON.källor.length > 0;
      
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

      finalData = await aiClient.gemini(gemPrompt, {
        json: true,
        timeoutMs: CFG.GEMINI_TIMEOUT_MS,
      });

      console.log(`[${new Date().toISOString()}] Gemini finalData:`, JSON.stringify(finalData, null, 2));

      // Ensure proper structure
      if (!finalData.källa || finalData.källa === "-") {
        finalData.källa = WEB_JSON.källor?.[0] || "-";
      }
      finalData.evidence = finalData.evidence || { etiketttext: "", webbträffar: [] };
      finalData.evidence.etiketttext = finalData.evidence.etiketttext || clamp(ocrText);
      finalData.evidence.webbträffar = (WEB_JSON.källor || []).slice(0, CFG.MAX_WEB_URLS);

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
    finalData = fillMissingFields(finalData, WEB_JSON, ocrText);

    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Total processing time: ${totalTime}ms`);

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
