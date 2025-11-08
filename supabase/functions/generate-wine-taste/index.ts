import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const clampSlider = (n: unknown) => {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  if (Number.isNaN(x)) return 3;
  const clamped = Math.min(5, Math.max(1, x));
  return Math.round(clamped * 2) / 2;
};

const isVague = (s: string) => {
  const t = (s || "").toLowerCase();
  if (t.length < 20) return true;
  const vagueWords = ["nice", "pleasant", "balanced", "good", "tasty", "lovely"];
  return vagueWords.some((w) => t.includes(w)) && t.length < 50;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metadata, facts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du är sommelier. Baserat på etikettmetadata och kort faktasammanfattning ska du returnera ENBART JSON (svenska):
- tasteProfile: sweetness, body, fruit, acidity, tannin?, oak? (1..5, halva steg ok)
- summary: exakt EN svensk mening (20–28 ord) som speglar siffrorna tydligt (inte vag).
- foodPairing: exakt 3 svenska rätter (JSON-array).
- usedSignals: 3–5 korta punkter (svenska) som anger vilka ledtrådar du använde (druvor, region, etikettord, ev. fakta).`;

    const userPrompt = `METADATA:
- Namn: ${metadata.wineName}
- Producent: ${metadata.producer}
- Druvor: ${(metadata.grapeVariety || []).join(", ") || "okänt"}
- Region: ${metadata.region}, ${metadata.country}
- Årgång: ${metadata.vintage}

FAKTA (kort):
${facts.summary || "(ingen explicit fakta tillgänglig)"}
Källor: ${(facts.sources || []).join(", ") || "saknas"}

Returnera ENBART JSON enligt schema. Inga markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.25,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const jsonText = data.choices?.[0]?.message?.content || "{}";
    const json = JSON.parse(jsonText);

    const tp = json.tasteProfile || {};
    const tasteProfile = {
      sweetness: clampSlider(tp.sweetness),
      body: clampSlider(tp.body),
      fruit: clampSlider(tp.fruit),
      acidity: clampSlider(tp.acidity),
      tannin: tp.tannin != null ? clampSlider(tp.tannin) : undefined,
      oak: tp.oak != null ? clampSlider(tp.oak) : undefined,
    };

    let summary: string = String(json.summary || "").trim();
    
    // Repair vague summary
    if (isVague(summary)) {
      const repairResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: `Omformulera följande smakmening till exakt en svensk mening (20–28 ord) som speglar dessa siffror. Använd inga nya fakta.
Siffror: ${JSON.stringify(tasteProfile)}
Mening: "${summary}"`
          }],
          temperature: 0.25,
        }),
      });
      
      if (repairResponse.ok) {
        const repairData = await repairResponse.json();
        const fixed = (repairData.choices?.[0]?.message?.content || "").trim();
        if (!isVague(fixed)) summary = fixed;
      }
    }

    let food: string[] = Array.isArray(json.foodPairing)
      ? json.foodPairing.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [];

    // Ensure exactly 3 food pairings
    if (food.length !== 3) {
      const foodResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: `Skapa EXAKT 3 svenska maträtter i JSON-array baserat på denna smakprofil:
${JSON.stringify(tasteProfile)}`
          }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (foodResponse.ok) {
        const foodData = await foodResponse.json();
        const foodText = foodData.choices?.[0]?.message?.content || "[]";
        try {
          const parsed = JSON.parse(foodText);
          if (Array.isArray(parsed) && parsed.length === 3) {
            food = parsed.map((s: unknown) => String(s).trim());
          } else if (parsed.foodPairing && Array.isArray(parsed.foodPairing)) {
            food = parsed.foodPairing.slice(0, 3);
          }
        } catch (e) {
          console.error("Failed to parse food:", e);
        }
      }
    }

    const usedSignals: string[] = Array.isArray(json.usedSignals)
      ? json.usedSignals.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [];

    const result = {
      tasteProfile,
      summary,
      foodPairing: food.slice(0, 3),
      usedSignals,
    };

    if (result.foodPairing.length !== 3 || !result.summary || isVague(result.summary)) {
      return new Response(
        JSON.stringify({ error: "FORMAT_INVALID_JSON: Taste block failed quality gate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
