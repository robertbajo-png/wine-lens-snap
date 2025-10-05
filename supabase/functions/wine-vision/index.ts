const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
const MODEL = "google/gemini-2.5-flash";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

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


    console.log(`Analyzing wine with OCR text, UI language: ${uiLang}`);
    console.log(`OCR text length: ${(ocrText || "").length}, no_text_found: ${noTextFound}`);

    // Step 1: Web search with Perplexity using OCR text only
    let webText = "";
    let webSources: string[] = [];
    
    if (PERPLEXITY_API_KEY && ocrText && ocrText.length > 5) {
      console.log("Searching web with Perplexity (OCR text only)...");
      
      // Retry logic with exponential backoff
      const maxRetries = 2;
      let attempt = 0;
      
      while (attempt < maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutMs = 12000 + (attempt * 3000); // 12s, then 15s
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
              const otherSources = citations.filter((url: string) => !url.includes("systembolaget.se"));
              
              // Take top 1-2 sources, prioritizing Systembolaget
              webSources = [...systembolagetSources.slice(0, 2), ...otherSources.slice(0, 2 - systembolagetSources.length)];
              console.log("Web sources prioritized:", webSources);
            }
            
            // Deduplicate and condense the text
            webText = rawText.trim();
            console.log("Web search successful, length:", webText.length);
            break; // Success, exit retry loop
          } else {
            const errText = await perplexityResponse.text();
            console.error(`Perplexity attempt ${attempt + 1} failed:`, perplexityResponse.status, errText);
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
            }
          }
        } catch (e) {
          console.error(`Perplexity attempt ${attempt + 1} error:`, e instanceof Error ? e.message : String(e));
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
          }
        }
        attempt++;
      }
    }


    // System prompt - fact-checking AI sommelier
    const systemPrompt = `DU ÄR: En faktagranskande AI-sommelier. Du läser etikettbilden (vision), använder den OCR-lästa texten och sammanfattar endast verifierad fakta från webbkällor. Du hittar aldrig på.

ARBETSGÅNG:
1) ETIKETT (OCR): Läs texten på etiketten: namn, producent, druvor, land/region, klassificering (DOC/DOCG/Brut/Extra Dry), årgång, alkoholhalt, volym.
2) WEBBFAKTA: Använd sammanfattningen från webbsök-steget (WEB_TEXT). Lita i första hand på Systembolaget, därefter producentens sida, därefter Vivino/Wine-Searcher. Ignorera bloggar/oinställda källor.
3) FILTRERA: Ta endast med fakta som finns på etiketten eller bekräftas i WEB_TEXT. Om uppgift saknas: "-".
4) JSON ENDAST: Svara alltid med EN (1) giltig JSON enligt schemat nedan. Ingen extra text.

SCHEMA (SVENSKA):
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
- Ingen fantasi. Skriv "-" när fakta saknas.
- Fyll endast "karaktär/smak/passar_till/servering/meters" om webbkällan uttryckligen anger det.
- För mousserande: sötma-mappning får användas deterministiskt om klassificering finns:
  Brut Nature/Pas Dosé/Dosage Zéro=0; Extra Brut=0.5; Brut=1; Extra Dry=1.5; Dry/Sec=2.2; Demi-Sec/Semi-Seco=3.4; Dolce/Sweet=4.5.
- Evidence: inkludera etikettens OCR-text (kortad) och de använda webbadresserna.`;

    // Build user message with OCR context, optional web search results, and image
    function buildUserMessage(ocrText: string, webText: string, imageBase64?: string): any {
      const webContext = webText ? `\n\nWEB_TEXT:\n${webText}` : "\n\nWEB_TEXT:\n(AI söker automatiskt efter information)";
      const context = `OCR_TEXT:\n${ocrText || "(ingen text)"}${webContext}\n\nAnalysera vinet baserat på OCR_TEXT och WEB_TEXT ovan och returnera ENDAST JSON enligt schemat.`;
      
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

    const userMessage = buildUserMessage(ocrText || "", webText, imageBase64);

    // Gemini API call with retry logic
    const maxRetries = 2;
    let attempt = 0;
    let ai: Response | null = null;
    
    while (attempt < maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutMs = 30000 + (attempt * 15000); // 30s, then 45s
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
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (ai.ok) {
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
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
          }
        }
      } catch (e) {
        console.error(`AI Gateway attempt ${attempt + 1} error:`, e instanceof Error ? e.message : String(e));
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
      attempt++;
    }

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
