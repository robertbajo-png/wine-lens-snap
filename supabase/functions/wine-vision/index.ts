import { searchWineWithPerplexity } from "./api-perplexity.ts";
import { summarizeWithGemini } from "./api-gemini.ts";
import { 
  getCacheKey, 
  getFromMemoryCache, 
  setMemoryCache, 
  getFromSupabaseCache, 
  setSupabaseCache 
} from "./cache.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

function sanitize(data: any) {
  // Remove any OCR error messages from smak field
  if (data.smak && /tekniskt fel|ingen läsbar text|ocr|error/i.test(data.smak)) {
    data.smak = "–";
  }
  return data;
}

function enrichFallback(ocrText: string, data: any) {
  const t = (ocrText || "").toLowerCase();
  const hasTokaji = /tokaji/.test(t);
  const hasFurmint = /furmint/.test(t);

  // If Tokaji Furmint: fill standard if missing
  if (hasTokaji && hasFurmint) {
    data.vin = data.vin && data.vin !== "–" ? data.vin : "Tokaji Furmint";
    data.land_region = data.land_region && data.land_region !== "–" ? data.land_region : "Ungern, Tokaj";
    data.druvor = data.druvor && data.druvor !== "–" ? data.druvor : "Furmint";
    data.karaktär = data.karaktär && data.karaktär !== "–" ? data.karaktär : "Friskt & fruktigt";
    data.smak = data.smak && !/Ingen läsbar text/i.test(data.smak) && data.smak !== "–" ? data.smak :
      "Friskt och fruktigt med inslag av citrus, gröna äpplen och lätt honung/mineral.";
    data.servering = data.servering && data.servering !== "–" ? data.servering : "8–10 °C";
    data.passar_till = Array.isArray(data.passar_till) && data.passar_till.length ? data.passar_till : ["fisk","kyckling","milda ostar"];
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

    const { ocrText, imageBase64, noTextFound = false, uiLang = "sv-SE" } = await req.json();

    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Wine analysis started, UI language: ${uiLang}`);
    console.log(`OCR text length: ${(ocrText || "").length}, no_text_found: ${noTextFound}`);

    // Check cache (memory first, then Supabase)
    let cacheNote = "";
    if (ocrText && ocrText.length > 10) {
      const cacheKey = getCacheKey(ocrText);
      
      // Try memory cache
      const memoryHit = getFromMemoryCache(cacheKey);
      if (memoryHit) {
        const cacheTime = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Memory cache hit! (${cacheTime}ms)`);
        return new Response(JSON.stringify({ 
          ok: true, 
          data: memoryHit.data, 
          note: memoryHit.note 
        }), {
          headers: { ...cors, "content-type": "application/json" },
        });
      }

      // Try Supabase cache
      const supabaseHit = await getFromSupabaseCache(cacheKey, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      if (supabaseHit) {
        const cacheTime = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Supabase cache hit! (${cacheTime}ms)`);
        
        // Store in memory cache for faster next access
        setMemoryCache(cacheKey, supabaseHit.data);
        
        return new Response(JSON.stringify({ 
          ok: true, 
          data: supabaseHit.data, 
          note: supabaseHit.note 
        }), {
          headers: { ...cors, "content-type": "application/json" },
        });
      }
      
      console.log(`[${new Date().toISOString()}] Cache miss, proceeding with analysis...`);
    }

    // Step 1: Perplexity search with enhanced domain whitelist
    let webData: any = null;
    let webSources: string[] = [];
    let perplexityFailed = false;

    if (PERPLEXITY_API_KEY && ocrText && ocrText.length > 5) {
      const perplexityStart = Date.now();
      console.log(`[${new Date().toISOString()}] Starting Perplexity search (12s timeout)...`);

      try {
        const result = await searchWineWithPerplexity(ocrText, PERPLEXITY_API_KEY, 12000);
        webData = result.data;
        webSources = result.sources;
        
        const perplexityTime = Date.now() - perplexityStart;
        console.log(`[${new Date().toISOString()}] Perplexity success (${perplexityTime}ms), sources: ${webSources.length}`);
      } catch (error) {
        const perplexityTime = Date.now() - perplexityStart;
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        if (errorMsg === "perplexity_timeout") {
          console.log(`[${new Date().toISOString()}] Perplexity timeout (${perplexityTime}ms) - using OCR-only mode`);
          cacheNote = "perplexity_timeout";
        } else {
          console.error(`[${new Date().toISOString()}] Perplexity error (${perplexityTime}ms):`, errorMsg);
        }
        perplexityFailed = true;
      }
    }

    // Step 2: Gemini analysis (JSON only, low temp)
    const geminiStart = Date.now();
    console.log(`[${new Date().toISOString()}] Starting Gemini analysis...`);

    let finalData: any;
    try {
      finalData = await summarizeWithGemini(
        ocrText || "",
        webData,
        webSources,
        imageBase64,
        LOVABLE_API_KEY
      );
      
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

    // Post-process: enrich fallback + sanitize
    finalData = enrichFallback(ocrText || "", finalData);
    finalData = sanitize(finalData);

    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Total processing time: ${totalTime}ms`);

    // Store in both caches
    if (ocrText && ocrText.length > 10) {
      const cacheKey = getCacheKey(ocrText);
      setMemoryCache(cacheKey, finalData);
      await setSupabaseCache(cacheKey, finalData, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

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
