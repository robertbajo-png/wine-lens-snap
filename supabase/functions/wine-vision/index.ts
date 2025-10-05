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
    data.smak = data.smak && !/Ingen läsbar text/i.test(data.smak) ? data.smak :
      "Friskt och fruktigt med inslag av citrus, gröna äpplen och lätt honung/mineral.";
    data.servering = data.servering && data.servering !== "–" ? data.servering : "8–10 °C";
    data.passar_till = Array.isArray(data.passar_till) && data.passar_till.length ? data.passar_till : ["fisk","kyckling","milda ostar"];
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

    const { imageDataUrl, lang = "sv" } = await req.json();

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image")) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    console.log(`Analyzing wine image with vision API, language: ${lang}`);

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

    const userInstruction = `Här är etikettens text (tom sträng om OCR misslyckades):
---
(Se bilden nedan)
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
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userInstruction },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
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
    let content: string = json?.choices?.[0]?.message?.content ?? "{}";

    console.log("Vision API response:", content);

    const parsed = parseWine(content);
    
    // Kör enrichFallback baserat på AI:ns raw response (content innehåller ev. Tokaji/Furmint)
    const enriched = enrichFallback(content, parsed);

    const data = {
      vin: enriched.vin ?? "–",
      land_region: enriched.land_region ?? "–",
      producent: enriched.producent ?? "–",
      druvor: enriched.druvor ?? "–",
      karaktär: enriched.karaktär ?? "–",
      smak: enriched.smak ?? "–",
      passar_till: Array.isArray(enriched.passar_till) ? enriched.passar_till : [],
      servering: enriched.servering ?? "–",
      årgång: enriched.årgång ?? "–",
      alkoholhalt: enriched.alkoholhalt ?? "–",
      volym: enriched.volym ?? "–",
      sockerhalt: enriched.sockerhalt ?? "–",
      syra: enriched.syra ?? "–",
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
