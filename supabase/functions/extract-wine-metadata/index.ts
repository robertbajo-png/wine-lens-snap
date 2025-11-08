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
    const { imageBase64, mimeType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            },
            {
              type: "text",
              text: "Analysera vin-etiketten och returnera ENBART JSON enligt detta schema:\n{\n  \"wineName\": string,\n  \"producer\": string,\n  \"grapeVariety\": string[],\n  \"region\": string,\n  \"country\": string,\n  \"vintage\": string\n}\n\nSvenska fält. vintage = \"N/V\" om okänt. Inga markdown eller extra text."
            }
          ]
        }],
        response_format: { type: "json_object" },
        temperature: 0.2,
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
    const metadata = JSON.parse(jsonText);

    // Validate
    const noName = !metadata.wineName || String(metadata.wineName).trim().length === 0;
    const noGrapes = !Array.isArray(metadata.grapeVariety) || metadata.grapeVariety.length === 0;
    const noRegion = !metadata.region || String(metadata.region).trim().length === 0;
    
    if (noName && noGrapes && noRegion) {
      return new Response(
        JSON.stringify({ error: "CONTENT_UNREADABLE: Label could not be reliably read (name/grapes/region empty)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(metadata),
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
