import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const systemPrompt = `You are a sommelier. Based on ONLY the OCR label text, produce a confident, consumer-friendly summary that maximizes usefulness while avoiding fabricated specifics.

Return JSON only:
{
  "grape": "string",
  "style": "string",
  "serve_temp_c": "string",
  "pairing": ["string", "string", "string", "string"]
}

Rules:
- If grape is explicit in OCR, use it. If not, infer from region/classic styles and mark uncertainty inline in 'style' (e.g., "troligen Sangiovese").
- Keep 'style' vivid but concise (≤ 180 chars), avoid jargon.
- 'serve_temp_c' as a range (e.g., "14–16").
- Pairings: 3–4 short Swedish (or English if lang='en') dish names the average user recognizes.
- No winery/vintage unless clearly present.

Language: Swedish if lang='sv', English if lang='en'.

Output JSON only. No markdown, no comments.`;

    const userPrompt = `OCR label text:
"""
${ocrText}
"""

Language: ${lang}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded, please try again shortly.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to analyze wine' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    console.log('Analysis response:', analysisText);

    // Parse the JSON response robustly (handle code fences or extra text)
    let analysis;
    try {
      let jsonText = analysisText.trim();

      // Strip ```json ... ``` fences if present
      const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced && fenced[1]) {
        jsonText = fenced[1].trim();
      }

      // If still not pure JSON, try extracting between first { and last }
      if (!(jsonText.startsWith('{') && jsonText.endsWith('}'))) {
        const first = jsonText.indexOf('{');
        const last = jsonText.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          jsonText = jsonText.slice(first, last + 1);
        }
      }

      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, analysisText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(analysis), {
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
