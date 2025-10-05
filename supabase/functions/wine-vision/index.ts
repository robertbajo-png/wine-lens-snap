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

    const system = `Du är en vinexpert. Du får en bild av en vinflaska. Läs av etikettens text (OCR) och analysera vinet enligt följande modell. 
Format och ton ska efterlikna Systembolaget.se. Svara alltid på svenska.

Följ dessa steg:
1️⃣ Identifiera vinets namn, typ (vitt/rött/rosé/mousserande/sött), land, region, producent, årgång om den finns.  
2️⃣ Ange druvsort eller druvblandning.  
3️⃣ Beskriv kortfattat smaktyp, t.ex. "Friskt & fruktigt" eller "Fylligt & smakrikt".  
4️⃣ Beskriv smaken mer detaljerat med 1–2 meningar.  
5️⃣ Ange passande mat (3–4 rätter).  
6️⃣ Ange serveringstemperatur i °C.  
7️⃣ Om någon uppgift saknas, skriv "–".

Returnera ENDAST JSON enligt detta schema:
{
  "vin": "vinets namn",
  "land_region": "land/region",
  "producent": "producentens namn",
  "druvor": "druvsort eller druvblandning",
  "karaktar": "kort smaktyp (t.ex. Friskt & fruktigt)",
  "smak": "detaljerad smakbeskrivning 1-2 meningar",
  "passar_till": ["rätt 1", "rätt 2", "rätt 3", "rätt 4"],
  "servering": "temperatur i °C"
}

Var konkret, använd Systembolagets ton: informativ, neutral, tydlig, inga värdeomdömen.
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
      karaktar: parsed.karaktar ?? "–",
      smak: parsed.smak ?? "–",
      passar_till: Array.isArray(parsed.passar_till) ? parsed.passar_till : [],
      servering: parsed.servering ?? "–",
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
