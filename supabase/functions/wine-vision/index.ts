const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "gpt-4o-mini";

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
      syra: "–"
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

    const { ocrText, noTextFound = false, lang = "sv" } = await req.json();

    console.log(`Analyzing wine with OCR text, language: ${lang}`);
    console.log(`OCR text length: ${(ocrText || "").length}, no_text_found: ${noTextFound}`);

    const system = `Du är vinexpert. Returnera ENDAST giltig JSON exakt enligt detta schema:
{"vin":"","land_region":"","producent":"","druvor":"","karaktär":"","smak":"",
 "passar_till":[],"servering":"","årgång":"","alkoholhalt":"","volym":"",
 "sockerhalt":"","syra":""}

Regler:
- Gissa inte från färg/layout. Bygg på text/etikett.
- Om OCR saknas: fyll med "–" men om du ser nyckelord som "Tokaji" och "Furmint"
  får du använda validerad domänkunskap nedan.
- Svara på svenska. Ingen extra text/markdown.
- Håll "passar_till" som array av korta strängar.

Domänkunskap (safe defaults när nyckelord matchar):
- "Tokaji" + "Furmint" => 
  land_region="Ungern, Tokaj", druvor="Furmint", karaktär="Friskt & fruktigt",
  smak="Friskt och fruktigt med inslag av citrus, gröna äpplen och lätt honung/mineral.",
  servering="8–10 °C", passar_till=["fisk","kyckling","milda ostar"].`;

    const userMessage = `Här är etikettens text från OCR:
---
${ocrText || "(ingen text hittades)"}
---
Identifiera och returnera JSON enligt systemet. Använd domänkunskapen om Tokaji/Furmint upptäcks.`;

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
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
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";

    console.log("GPT response:", content);

    // Parse, enrich, and sanitize
    const parsed = parseWine(content);
    console.log("Parsed JSON:", parsed);
    
    const enriched = enrichFallback(ocrText || "", parsed);
    console.log("After enrichFallback:", enriched);
    
    const safe = sanitize(enriched);
    console.log("After sanitize:", safe);
    
    // Telemetry
    const telemetry = {
      ocr_len: (ocrText || "").length,
      no_text_found: noTextFound,
      json_parse_ok: parsed.vin !== "–" || parsed.land_region !== "–",
      fallback_applied: ocrText && (/tokaji/i.test(ocrText) && /furmint/i.test(ocrText))
    };
    console.log("Telemetry:", telemetry);

    const data = {
      vin: safe.vin ?? "–",
      land_region: safe.land_region ?? "–",
      producent: safe.producent ?? "–",
      druvor: safe.druvor ?? "–",
      karaktär: safe.karaktär ?? "–",
      smak: safe.smak ?? "–",
      passar_till: Array.isArray(safe.passar_till) ? safe.passar_till : [],
      servering: safe.servering ?? "–",
      årgång: safe.årgång ?? "–",
      alkoholhalt: safe.alkoholhalt ?? "–",
      volym: safe.volym ?? "–",
      sockerhalt: safe.sockerhalt ?? "–",
      syra: safe.syra ?? "–",
      _telemetry: telemetry
    };

    return new Response(JSON.stringify(data), {
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
