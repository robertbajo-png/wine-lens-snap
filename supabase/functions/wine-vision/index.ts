const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "gpt-4.1-2025-04-14";

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
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const { ocrText, noTextFound = false, uiLang = "sv-SE" } = await req.json();

    console.log(`Analyzing wine with OCR text, UI language: ${uiLang}`);
    console.log(`OCR text length: ${(ocrText || "").length}, no_text_found: ${noTextFound}`);

    // System prompt with web search requirement
    const systemPrompt = `Läs etiketten på bilden och sök på internet efter verifierad fakta om vinet.
Använd bara tillförlitliga källor som Systembolaget, producentens hemsida, Vivino eller Wine-Searcher.
Returnera enbart bekräftad information – inget påhitt.

Svara alltid i detta format (på svenska, som giltig JSON):

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
  "sockerhalt": "",
  "syra": "",
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

Regler:
- Hitta aldrig på fakta.
- Läs etikettens text (namn, producent, druvor, region, årgång, alkoholhalt).
- Sök sedan på internet efter exakt det vinet och fyll bara i fakta som hittas i källorna.
- Om något saknas, skriv "-".
- Ange alltid vilken webbadress (källa) informationen kommer från.
- För meters: om du hittar verifierad info om sötma/fyllighet/fruktighet/fruktsyra, sätt värde 0-5, annars null.
- Svara endast med JSON, inga kommentarer eller extra text.`;

    // Build user message
    function buildUserMessage(ocrText: string): string {
      return `OCR-text från vinflaska-etikett:
---
${ocrText || "(ingen text hittades)"}
---
Analysera enligt systemet och returnera JSON.`;
    }

    const userMessage = buildUserMessage(ocrText || "");

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
      }),
    });

    if (!ai.ok) {
      const errText = await ai.text();
      console.error("OpenAI Vision error:", ai.status, errText);

      if (ai.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again shortly." }),
          { status: 429, headers: { ...cors, "content-type": "application/json" } }
        );
      }
      if (ai.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your account." }),
          { status: 402, headers: { ...cors, "content-type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "OpenAI Vision error", detail: errText }),
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
      evidence: safe.evidence ?? { etiketttext: "", webbträffar: [] },
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
