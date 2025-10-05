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

    const system = `Du är en strikt vinexpert. Du får en BILD av en vinetikett.

Regler:
- Läs texten direkt från bilden. Gissa ALDRIG från färger/design om text finns.
- Returnera ENDAST JSON enligt schema. Skriv "Okänt" vid saknad info.
- Om du ser "Tokaji" och "Furmint": Typ=Vitt, Druva=Furmint, Region=Tokaj, Ungern.
- Ge 3–5 rimliga matparningar för stilen.

JSON-schema:
{
  "vin": "string|Okänt",
  "typ": "Vitt|Rött|Rosé|Mousserande|Okänt",
  "druva": "string|Okänt",
  "region": "string|Okänt",
  "stil_smak": "string",
  "servering": "t.ex. 8–10 °C",
  "att_till": ["rätt 1", "rätt 2", "rätt 3"]
}

Språk: ${lang === "sv" ? "Svenska" : "Engelska"}
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
      vin: parsed.vin ?? "Okänt",
      typ: parsed.typ ?? "Okänt",
      druva: parsed.druva ?? "Okänt",
      region: parsed.region ?? "Okänt",
      stil_smak: parsed.stil_smak ?? "Okänt",
      servering: parsed.servering ?? "Okänt",
      att_till: Array.isArray(parsed.att_till) ? parsed.att_till.slice(0, 5) : [],
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
