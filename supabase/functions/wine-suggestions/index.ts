import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TasteProfileEntry = {
  value: string;
  count: number;
};

type TasteProfile = {
  grapes: TasteProfileEntry[];
  regions: TasteProfileEntry[];
  styles: TasteProfileEntry[];
  totalScans: number;
};

type WineSuggestion = {
  name: string;
  reason: string;
  region?: string;
  grape?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tasteProfile } = await req.json() as { tasteProfile: TasteProfile };

    if (!tasteProfile || tasteProfile.totalScans < 1) {
      return new Response(
        JSON.stringify({ suggestions: [], message: "Not enough scans for suggestions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const topGrapes = tasteProfile.grapes.slice(0, 5).map((g) => `${g.value} (${g.count}x)`).join(", ");
    const topRegions = tasteProfile.regions.slice(0, 5).map((r) => `${r.value} (${r.count}x)`).join(", ");
    const topStyles = tasteProfile.styles.slice(0, 3).map((s) => `${s.value} (${s.count}x)`).join(", ");

    const systemPrompt = `Du är en vinexpert som ger personliga vinrekommendationer baserat på användarens smakprofil.

Svara ENDAST med giltig JSON i följande format utan markdown:
{
  "suggestions": [
    {
      "name": "Vinnamn eller typ",
      "reason": "Kort förklaring på svenska varför detta passar",
      "region": "Vald region (valfritt)",
      "grape": "Huvuddruva (valfritt)"
    }
  ]
}

Ge 2-4 förslag som:
1. Matchar användarens preferenser men utforskar något nytt
2. Är konkreta och lätta att hitta (populära viner/regioner)
3. Har korta, engagerande förklaringar på svenska`;

    const userPrompt = `Användarens smakprofil baserat på ${tasteProfile.totalScans} skannade viner:

Favorit druvor: ${topGrapes || "Ingen tydlig favorit ännu"}
Favorit regioner: ${topRegions || "Ingen tydlig favorit ännu"}
Favorit stilar: ${topStyles || "Ingen tydlig favorit ännu"}

Ge personliga vinförslag som utforskar något nytt men bygger på dessa preferenser.`;

    console.log("Generating wine suggestions for profile:", {
      totalScans: tasteProfile.totalScans,
      topGrapes,
      topRegions,
    });

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "För många förfrågningar, försök igen senare" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "AI-krediter slut" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI-tjänsten är inte tillgänglig just nu" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    console.log("AI raw response:", content);

    // Parse AI response - extract JSON from potential markdown code blocks
    let parsed: { suggestions: WineSuggestion[] };
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      parsed = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      return new Response(
        JSON.stringify({ suggestions: [], error: "Kunde inte tolka AI-svaret" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [];

    console.log("Generated suggestions:", suggestions.length);

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("wine-suggestions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Okänt fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
