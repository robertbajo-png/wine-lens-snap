import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MODEL = "gpt-4o-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

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

    const system = `Du är en vinexpert. Läs etikettens text (OCR först) och returnera ENDAST giltig JSON enligt schemat nedan. Gissa inte; om data saknas, använd "–".

JSON-schema:
{
  "vin": "string",
  "land_region": "string",
  "producent": "string",
  "druvor": "string",
  "karaktär": "string",           // t.ex. "Friskt & fruktigt"
  "smak": "string",               // 1–2 meningar
  "passar_till": ["string", "string", "string"],
  "servering": "string",          // t.ex. "8–10 °C"
  "årgång": "string",
  "alkoholhalt": "string",        // t.ex. "13 %"
  "volym": "string",              // t.ex. "750 ml"
  "sockerhalt": "string",         // t.ex. "6 g/l" eller "–"
  "syra": "string"                // t.ex. "6,2 g/l" eller "–"
}

Regler:
- Använd en neutral, informativ ton (Systembolaget-stil).
- Inga emojis, inga värdeomdömen.
- Svara alltid på svenska.
- Om OCR inte hittar text: returnera {"vin":"–","land_region":"–","producent":"–","druvor":"–","karaktär":"–","smak":"Ingen läsbar text på etiketten.","passar_till":[],"servering":"–","årgång":"–","alkoholhalt":"–","volym":"–","sockerhalt":"–","syra":"–"}.

Returnera ENDAST JSON utan markdown eller kommentarer.`;

    const userInstruction = "Analysera vinet på bilden och returnera strikt JSON enligt schema.";

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
    content = content.replace(/^```json/i, "").replace(/```$/i, "").trim();

    console.log("Vision API response:", content);

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError, content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...cors, "content-type": "application/json" } }
      );
    }

    const data = {
      vin: parsed.vin ?? "–",
      land_region: parsed.land_region ?? "–",
      producent: parsed.producent ?? "–",
      druvor: parsed.druvor ?? "–",
      karaktär: parsed.karaktär ?? "–",
      smak: parsed.smak ?? "–",
      passar_till: Array.isArray(parsed.passar_till) ? parsed.passar_till : [],
      servering: parsed.servering ?? "–",
      årgång: parsed.årgång ?? "–",
      alkoholhalt: parsed.alkoholhalt ?? "–",
      volym: parsed.volym ?? "–",
      sockerhalt: parsed.sockerhalt ?? "–",
      syra: parsed.syra ?? "–",
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
