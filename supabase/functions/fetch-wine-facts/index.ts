import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wineName, producer, region, country, vintage } = await req.json();
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

    if (!PERPLEXITY_API_KEY) {
      // Return empty facts if no key
      return new Response(
        JSON.stringify({ summary: "", sources: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-small-online",
        messages: [{
          role: "user",
          content: `Sök snabbt på webben och ge en mycket kort faktasammanfattning om detta vin eller producent (2–3 meningar på svenska) samt lista 2–4 källor (URL).
VIN: ${wineName}
PRODUCENT: ${producer}
REGION: ${region}, ${country}
ÅRGÅNG: ${vintage}`
        }],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      console.warn("Perplexity error:", response.status);
      return new Response(
        JSON.stringify({ summary: "", sources: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const urls = Array.from(
      new Set(
        (text.match(/https?:\/\/\S+/g) || [])
          .map((u: string) => u.replace(/[)\],.]+$/, ""))
          .slice(0, 4)
      )
    );

    const summary = text.replace(/https?:\/\/\S+/g, "").trim();
    
    return new Response(
      JSON.stringify({ summary, sources: urls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ summary: "", sources: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
