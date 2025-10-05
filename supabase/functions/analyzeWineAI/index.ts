import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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

    const systemPrompt = `You are a certified sommelier and wine educator. Based ONLY on the text from a wine label (OCR), identify the most likely grape variety (or blend), short style/tasting profile, recommended serving temperature, and 3–5 concise food pairings. If the grape cannot be determined, infer plausible grape(s) from region/cues and mark as "Unknown (best guess: ...)".

Return JSON only, no markdown or prose, using this schema:
{
  "grape": "string", 
  "style": "string",
  "serve_temp_c": "string",
  "pairing": ["string", "string", "string"]
}

Language rules:
- If lang="sv": respond in Swedish (values in JSON should be Swedish).
- If lang="en": respond in English.

Hard requirements:
- JSON only. No backticks, no code fences.
- Never invent specific winery names or vintages that are not in the OCR text.
- If multiple grapes are plausible, pick the most likely and optionally include a brief note in 'style' (e.g., 'kan vara blend').
- Keep style concise (max ~160 chars).
- Pairings must be common, practical dishes.`;

    const userPrompt = `OCR label text:
"""
${ocrText}
"""

Language: ${lang}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to analyze wine' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    console.log('Analysis response:', analysisText);

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, analysisText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
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
