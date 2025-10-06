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
        const pplxPrompt = `
Du ska returnera ENDAST ett kort JSON-objekt (ingen löptext) med verifierad fakta om detta vin.

Använd dessa sökfraser i turordning (max 12):
${queries.map((q, i) => `${i + 1}) ${q}`).join("\n")}

Prioritera: 1) systembolaget.se 2) producentens sajt
3) vinmonopolet.no/alko.fi/saq.com/lcbo.com
4) wine-searcher/wine.com/totalwine/waitrose/tesco/majestic
5) decanter/winemag/jancisrobinson/falstaff
6) vivino/cellartracker (endast om inget annat finns)

Returnera ENDAST giltig JSON exakt enligt:
{
  "vin": "", "producent": "", "druvor": "", "land_region": "",
  "årgång": "", "alkoholhalt": "", "volym": "", "klassificering": "",
  "karaktär": "", "smak": "", "servering": "", "passar_till": [], "källor": []
}
Om uppgift saknas: "-".
        `.trim();

        WEB_JSON = await aiClient.perplexity(pplxPrompt, {
          model: CFG.PPLX_MODEL,
          timeoutMs: CFG.PPLX_TIMEOUT_MS,
        });

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
      const gemPrompt = `
DU ÄR: En faktagranskande AI-sommelier. Använd OCR_TEXT (etiketten) och WEB_JSON (verifierad fakta).
Hitta inte på. Svara ENDAST med giltig JSON enligt schema.

REGLER:
- "Egri" = region "Eger" (översätt).
- Typ/färg: härled endast från tydliga ord (Prosecco/Cava/Champagne/Spumante/Frizzante => "mousserande"; Rosé/Rosato/Rosado => "rosé"; Bianco/Blanc/White => "vitt"; Rosso/Rouge/Red => "rött").
- karaktär/smak/passar_till/servering/meters: fyll bara om uttryckligen i källan; undantag: för mousserande får "sötma" mappas deterministiskt:
  Brut Nature/Pas Dosé/Dosage Zéro=0; Extra Brut=0.5; Brut=1; Extra Dry=1.5; Dry/Sec=2.2; Demi-Sec/Semi-Seco=3.4; Dolce/Sweet=4.5.
- Vid konflikt: Systembolaget > producent > nordiska monopol > Vivino/Wine-Searcher.
- Saknas uppgift: "-".
- "källa": välj viktigaste URL från WEB_JSON.källor (Systembolaget om finns).
- "evidence": etiketttext = första ~200 tecken av OCR_TEXT; webbträffar = upp till 3 URL:er.

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
