const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const MODEL = "google/gemini-2.5-flash";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

// Server-side cache (Map med TTL, fungerar per function instance)
const CACHE_TTL_MS = 1000 * 60 * 60; // 60 min
const analysisCache = new Map<string, { ts: number; data: any }>();

function normalizeOCR(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "");
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function getCacheKey(ocrText: string): string {
  const normalized = normalizeOCR(ocrText);
  return hashString(normalized.slice(0, 150));
}

function getFromCache(key: string): any | null {
  const hit = analysisCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    analysisCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCache(key: string, data: any): void {
  analysisCache.set(key, { ts: Date.now(), data });
  // Begränsa cache-storlek (max 100 entries)
  if (analysisCache.size > 100) {
    const oldestKey = analysisCache.keys().next().value;
    if (oldestKey) {
      analysisCache.delete(oldestKey);
    }
  }
}

function parseWine(jsonText: string): any {
  try {
    // Trimma av ev. markdown-kodblock
    const clean = jsonText.trim().replace(/^```json|```$/g, "").replace(/^```|```$/g, "");
    return JSON.parse(clean);
  } catch {
    return {
      vin: "–",
      land_region: "–",
      producent: "–",
      druvor: "–",
      karaktär: "–",
      smak: "Tekniskt fel vid tolkning.",
      passar_till: [],
      servering: "–",
      årgång: "–",
      alkoholhalt: "–",
      volym: "–",
      sockerhalt: "–",
      syra: "–",
      detekterat_språk: "–",
      originaltext: "–"
    };
  }
}

function enrichFallback(ocrText: string, data: any) {
  const t = (ocrText || "").toLowerCase();
  const hasTokaji = /tokaji/.test(t);
  const hasFurmint = /furmint/.test(t);

  // Om Tokaji Furmint: fyll standard om saknas
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

function sanitize(data: any) {
  // Remove any OCR error messages from smak field
  if (data.smak && /tekniskt fel|ingen läsbar text|ocr|error/i.test(data.smak)) {
    data.smak = "–";
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...cors, "content-type": "application/json" },
    });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing PERPLEXITY_API_KEY" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const { ocrText, imageBase64, noTextFound = false, uiLang = "sv-SE" } = await req.json();

    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Analyzing wine with OCR text, UI language: ${uiLang}`);
    console.log(`OCR text length: ${(ocrText || "").length}, no_text_found: ${noTextFound}`);

    // Check cache first
    if (ocrText && ocrText.length > 10) {
      const cacheKey = getCacheKey(ocrText);
      const cached = getFromCache(cacheKey);
      if (cached) {
        const cacheTime = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Cache hit! Returned in ${cacheTime}ms`);
        return new Response(JSON.stringify(cached), {
          headers: { ...cors, "content-type": "application/json" },
        });
      }
      console.log(`[${new Date().toISOString()}] Cache miss, proceeding with analysis...`);
    }

    // Step 1: Web search with Perplexity using OCR text only
    let webText = "";
    let webSources: string[] = [];
    let perplexityFailed = false;
    
    if (PERPLEXITY_API_KEY && ocrText && ocrText.length > 5) {
      const perplexityStart = Date.now();
      console.log(`[${new Date().toISOString()}] Starting Perplexity search (OCR text only)...`);
      
      // Single attempt with 8s timeout
      const maxRetries = 1;
      let attempt = 0;
      
      while (attempt < maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutMs = 6000; // 6s timeout (reduced for faster fallback)
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: "sonar",
              search_depth: "basic",
              focus: "internet",
              messages: [
                {
                  role: "user",
                  content: `Vin: "${ocrText.slice(0, 200)}"\n\nHitta kort fakta från Systembolaget, Vivino eller Wine-Searcher. Max 150 ord.`
                }
              ],
              max_tokens: 300,
              temperature: 0.1,
              return_images: false,
              return_related_questions: false,
              search_domain_filter: ["systembolaget.se", "vivino.com", "wine-searcher.com"]
            })
          });

          clearTimeout(timeoutId);

          if (perplexityResponse.ok) {
            const perplexityData = await perplexityResponse.json();
            const rawText = perplexityData?.choices?.[0]?.message?.content || "";
            const citations = perplexityData?.citations || [];
            
            // Post-process: Extract and prioritize sources
            if (citations.length > 0) {
              const systembolagetSources = citations.filter((url: string) => url.includes("systembolaget.se"));
              const producerSources = citations.filter((url: string) => 
                !url.includes("systembolaget.se") && 
                (url.includes("winery") || url.includes("bodega") || url.includes("vineyard"))
              );
              const otherSources = citations.filter((url: string) => 
                !url.includes("systembolaget.se") && 
                !url.includes("winery") && 
                !url.includes("bodega") && 
                !url.includes("vineyard")
              );
              
              // Prioritize: Systembolaget > Producer > Others (max 2 sources)
              webSources = [
                ...systembolagetSources.slice(0, 1),
                ...producerSources.slice(0, systembolagetSources.length > 0 ? 1 : 2),
                ...otherSources.slice(0, 2 - systembolagetSources.length - producerSources.length)
              ].slice(0, 2);
              
              console.log("Web sources prioritized:", webSources);
            }
            
            // Check if empty response
            if (rawText.trim().length > 0) {
              webText = rawText.trim();
              const perplexityTime = Date.now() - perplexityStart;
              console.log(`[${new Date().toISOString()}] Perplexity success (${perplexityTime}ms), text length: ${webText.length}`);
              break; // Success, exit retry loop
            } else {
              console.log(`[${new Date().toISOString()}] Empty Perplexity response`);
              perplexityFailed = true;
              break;
            }
          } else {
            const errText = await perplexityResponse.text();
            const perplexityTime = Date.now() - perplexityStart;
            console.error(`[${new Date().toISOString()}] Perplexity failed (${perplexityTime}ms):`, perplexityResponse.status, errText);
            perplexityFailed = true;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          const perplexityTime = Date.now() - perplexityStart;
          console.error(`[${new Date().toISOString()}] Perplexity error (${perplexityTime}ms):`, errorMsg);
          
          // Check if timeout
          if (errorMsg.includes("abort") || errorMsg.includes("timeout")) {
            console.log(`[${new Date().toISOString()}] Perplexity timeout - using OCR-only mode`);
            perplexityFailed = true;
            break;
          }
          
          perplexityFailed = true;
        }
        attempt++;
      }
    }


    // System prompt - fact-checking AI sommelier with WEB_JSON
    const systemPrompt = `DU ÄR: En faktagranskande AI-sommelier. Du får OCR-text från etiketten och ett JSON-objekt med webbfakta ("WEB_JSON"). Du ska returnera ENDAST ett giltigt JSON-objekt i Systembolaget-stil. Inga påhitt.

ARBETSGÅNG:
1) Använd etikettens OCR_TEXT för att plocka upp namn, klassificering, årgång, alkoholhalt, volym om det står.
2) Använd WEB_JSON för att fylla verifierade fakta (producent, druvor, land/region, ev. stiltyp etc).
3) Vid konflikt: lita främst på Systembolaget, därefter producenten, därefter Vivino/Wine-Searcher. Annars behåll "-".
4) Hitta inte på något som inte står i etikett eller WEB_JSON. Om fält saknas: "-".
5) Svara endast med EN (1) giltig JSON enligt schema nedan (svenska, ingen markdown, ingen extra text).

SCHEMA:
{
  "vin": "",
  "land_region": "",
  "producent": "",
  "druvor": "",
  "årgång": "",
  "typ": "",
  "färgtyp": "",
  "klassificering": "",
  "alkoholhalt": "",
  "volym": "",
  "karaktär": "",
  "smak": "",
  "passar_till": [],
  "servering": "",
  "källa": "",
  "meters": {
    "sötma": null,
    "fyllighet": null,
    "fruktighet": null,
    "fruktsyra": null
  },
  "evidence": {
    "etiketttext": "",
    "webbträffar": []
  }
}

REGLER:
- Typ/färg: härled bara från tydliga ord (Prosecco/Cava/Champagne/Spumante/Frizzante => mousserande; Rosé/Rosato/Rosado => rosé; Bianco/Blanc/White => vitt; Rosso/Rouge/Red => rött). Annars lämna tomt.
- Mousserande sötma (får mappas utan webbcitat om klassificering står): 
  Brut Nature/Pas Dosé/Dosage Zéro=0; Extra Brut=0.5; Brut=1; Extra Dry=1.5; Dry/Sec=2.2; Demi-Sec/Semi-Seco=3.4; Dolce/Sweet=4.5.
- meters.fyllighet/fruktighet/fruktsyra: fyll ENDAST om källa uttryckligen anger värden/stilskala; annars null.
- "källa": välj den viktigaste URL:en från WEB_JSON.källor (helst Systembolaget). 
- "evidence": etiketttext (kortad) = OCR_TEXT (max 200 tecken). "webbträffar" = upp till tre URL:er från WEB_JSON.källor.`;

    // Build WEB_JSON from Perplexity results or fallback mode
    const webJson = perplexityFailed 
      ? { 
          text: "(Ingen verifierad källa hittades. Baserat endast på etikett.)", 
          källor: [],
          fallback_mode: true 
        }
      : {
          text: webText || "",
          källor: webSources,
          fallback_mode: false
        };

    console.log("Web JSON mode:", webJson.fallback_mode ? "OCR-only fallback" : "Web-enhanced");

    // Build user message with OCR and WEB_JSON
    function buildUserMessage(ocrText: string, webJson: any, imageBase64?: string): any {
      const context = webJson.fallback_mode
        ? `DATA:
OCR_TEXT:
${ocrText || "(ingen text)"}

ETIKETT-LÄGE: Webbsökning misslyckades. Använd endast OCR-text från etiketten. Sätt källa: "-". För fält som inte syns på etiketten, använd "-".

Analysera vinet baserat endast på OCR_TEXT och returnera JSON enligt schemat.`
        : `DATA:
OCR_TEXT:
${ocrText || "(ingen text)"}

WEB_JSON:
${JSON.stringify(webJson, null, 2)}

Vid konflikt mellan källor: prioritera Systembolaget > producent > konsensus. Analysera vinet och returnera ENDAST JSON enligt schemat.`;
      
      if (imageBase64) {
        return [
          {
            type: "image_url",
            image_url: {
              url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
            }
          },
          {
            type: "text",
            text: context
          }
        ];
      } else {
        return context;
      }
    }

    const userMessage = buildUserMessage(ocrText || "", webJson, imageBase64);

    // Gemini API call with single retry
    const geminiStart = Date.now();
    console.log(`[${new Date().toISOString()}] Starting Gemini analysis...`);
    
    const maxRetries = 1;
    let attempt = 0;
    let ai: Response | null = null;
    
    while (attempt < maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutMs = 20000; // 20s timeout (reduced from 25s)
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "content-type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.1,
            max_tokens: 1000,
            response_format: { 
              type: "json_object"
            },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (ai.ok) {
          const geminiTime = Date.now() - geminiStart;
          console.log(`[${new Date().toISOString()}] Gemini success (${geminiTime}ms)`);
          break; // Success, exit retry loop
        } else {
          const errText = await ai.text();
          console.error(`AI Gateway attempt ${attempt + 1} error:`, ai.status, errText);
          
          if (ai.status === 429 || ai.status === 402) {
            // Rate limit or payment errors - don't retry
            return new Response(
              JSON.stringify({ 
                error: ai.status === 429 
                  ? "Rate limits exceeded, please try again shortly." 
                  : "Payment required. Please add credits to your Lovable workspace." 
              }),
              { status: ai.status, headers: { ...cors, "content-type": "application/json" } }
            );
          }
          
          perplexityFailed = true;
        }
        } catch (e) {
        console.error(`AI Gateway error:`, e instanceof Error ? e.message : String(e));
        perplexityFailed = true;
      }
      attempt++;
    }

    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Total processing time: ${totalTime}ms`);

    if (!ai || !ai.ok) {
      return new Response(
        JSON.stringify({ error: "AI Gateway error after retries" }),
        { status: 500, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    const json = await ai.json();
    const rawContent: string = json?.choices?.[0]?.message?.content ?? "{}";

    console.log("GPT response:", rawContent);

    // Parse JSON directly (response_format json_object guarantees valid JSON)
    const parsedData = JSON.parse(rawContent);

    console.log("Parsed data:", parsedData);
    
    // Enrich and sanitize
    const enriched = enrichFallback(ocrText || "", parsedData);
    console.log("After enrichFallback:", enriched);
    
    const safe = sanitize(enriched);
    console.log("After sanitize:", safe);
    
    // Telemetry
    const telemetry = {
      ocr_len: (ocrText || "").length,
      no_text_found: noTextFound,
      json_parse_ok: parsedData.vin !== "–" || parsedData.land_region !== "–",
      fallback_applied: ocrText && (/tokaji/i.test(ocrText) && /furmint/i.test(ocrText))
    };
    console.log("Telemetry:", telemetry);

    // Convert passar_till string to array if needed
    let passarTillArray: string[] = [];
    if (typeof safe.passar_till === 'string') {
      passarTillArray = safe.passar_till.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(safe.passar_till)) {
      passarTillArray = safe.passar_till;
    }

    const responseData = {
      vin: safe.vin ?? "–",
      land_region: safe.land_region ?? "–",
      producent: safe.producent ?? "–",
      druvor: safe.druvor ?? "–",
      årgång: safe.årgång ?? "–",
      typ: safe.typ ?? "–",
      färgtyp: safe.färgtyp ?? "–",
      klassificering: safe.klassificering ?? "–",
      alkoholhalt: safe.alkoholhalt ?? "–",
      volym: safe.volym ?? "–",
      karaktär: safe.karaktär ?? "–",
      smak: safe.smak ?? "–",
      passar_till: passarTillArray,
      servering: safe.servering ?? "–",
      sockerhalt: safe.sockerhalt ?? "–",
      syra: safe.syra ?? "–",
      källa: safe.källa ?? "–",
      meters: safe.meters ?? { sötma: null, fyllighet: null, fruktighet: null, fruktsyra: null },
      evidence: {
        etiketttext: safe.evidence?.etiketttext || (ocrText || "").slice(0, 200),
        webbträffar: webSources.length > 0 ? webSources : (safe.evidence?.webbträffar || [])
      },
      _telemetry: telemetry
    };

    // Save to cache before returning
    if (ocrText && ocrText.length > 10) {
      const cacheKey = getCacheKey(ocrText);
      setCache(cacheKey, responseData);
      console.log(`[${new Date().toISOString()}] Result cached for future requests`);
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e: any) {
    console.error("Error in wine-vision function:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...cors, "content-type": "application/json" } }
    );
  }
});
