import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";

const googleApiKey = Deno.env.get("GOOGLE_API_KEY");

interface WineHeuristics {
  druva?: string;
  region?: string;
  typ?: string;
  servering?: string;
  preset?: boolean;
  [key: string]: string | boolean | undefined;
}

interface WineAnalysis {
  vin?: string;
  typ?: string;
  druva?: string;
  region?: string;
  stil_smak?: string;
  servering?: string;
  att_till?: unknown;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!googleApiKey) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_API_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { ocrText, lang = 'sv' } = await req.json();

    if (!ocrText) {
      return new Response(
        JSON.stringify({ error: 'ocrText is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Analyzing wine with language: ${lang}`);

    // Quick heuristics to detect specific wines from OCR text
    function quickHeuristics(txt: string): WineHeuristics {
      const t = txt.toLowerCase();
      const hints: WineHeuristics = {};
      
      // Tokaji Furmint detection
      if (t.includes("tokaji") && t.includes("furmint")) {
        hints.druva = "Furmint";
        hints.region = "Tokaj, Ungern";
        hints.typ = "Vitt";
        hints.servering = "8–10 °C";
        hints.preset = true;
      }
      
      // Other grape varieties
      if (t.includes("riesling")) hints.druva = "Riesling";
      if (t.includes("merlot")) hints.druva = "Merlot";
      if (t.includes("pinot")) hints.druva = "Pinot";
      if (t.includes("sangiovese")) hints.druva = "Sangiovese";
      if (t.includes("chardonnay")) hints.druva = "Chardonnay";
      if (t.includes("cabernet")) hints.druva = "Cabernet";
      
      return hints;
    }

    const heuristics = quickHeuristics(ocrText);

    const prompt = `Du är en strikt vinexpert. Du får OCR-text från en vinetikett.

Regler:
- Använd ENDAST OCR-texten (inget gissande från färg/design).
- Om något saknas: skriv "Okänt".
- Returnera ENDAST JSON enligt schema nedan.
- Om texten innehåller "Tokaji" och "Furmint": sätt typ=Vitt, druva=Furmint, region=Tokaj, Ungern.
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

${heuristics.preset ? `VIKTIGT: OCR-texten innehåller "${heuristics.druva}" från ${heuristics.region}. Använd denna information.` : ''}

Språk: Svenska om lang='sv', engelska om lang='en'.

OCR-text från vinetikett:
"""
${ocrText}
"""

${Object.keys(heuristics).length > 0 ? `Detekterade ledtrådar:
${JSON.stringify(heuristics, null, 2)}` : ''}

Språk: ${lang}
Returnera strikt JSON enligt schema.`;

    const url = `${GEMINI_API}/${GEMINI_MODEL}:generateContent?key=${googleApiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'API key invalid or quota exceeded.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to analyze wine' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const analysisText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!analysisText) {
      console.error('Gemini returned empty content:', data);
      return new Response(
        JSON.stringify({ error: 'Gemini returned empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analysis response:', analysisText);


    // Parse the JSON response robustly (handle code fences or extra text)
    let analysis: WineAnalysis;
    try {
      let jsonText = (analysisText || "").trim();

      // Strip ```json ... ``` fences if present
      jsonText = jsonText.replace(/^```json/i, "").replace(/```$/i, "").trim();

      // If still not pure JSON, try extracting between first { and last }
      if (!(jsonText.startsWith('{') && jsonText.endsWith('}'))) {
        const first = jsonText.indexOf('{');
        const last = jsonText.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          jsonText = jsonText.slice(first, last + 1);
        }
      }

      analysis = JSON.parse(jsonText) as WineAnalysis;
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, analysisText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply heuristics if we have preset values
    if (heuristics.preset) {
      if (!analysis.druva || analysis.druva === "Okänt") analysis.druva = heuristics.druva;
      if (!analysis.servering) analysis.servering = heuristics.servering;
      if (!analysis.region || analysis.region === "Okänt") analysis.region = heuristics.region;
      if (!analysis.typ || analysis.typ === "Okänt") analysis.typ = heuristics.typ;
    }

    // Map to final response format
    const result = {
      vin: analysis.vin ?? "Okänt",
      typ: analysis.typ ?? "Okänt",
      druva: analysis.druva ?? "Okänt",
      region: analysis.region ?? "Okänt",
      stil_smak: analysis.stil_smak ?? "Okänt",
      servering: analysis.servering ?? "Okänt",
      att_till: Array.isArray(analysis.att_till) ? analysis.att_till.slice(0, 5) : []
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyzeWineAI function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
