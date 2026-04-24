import type { WineSearchResult } from "./types.ts";

// NOTE: Filen heter fortfarande api-perplexity.ts för bakåtkompatibilitet,
// men implementationen använder nu Lovable AI Gateway (OpenAI GPT-5 med web search).
// Originalkod finns i api-perplexity.ts.backup för enkel återställning.

interface LovableAIToolCall {
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface LovableAIMessage {
  content?: string | null;
  tool_calls?: LovableAIToolCall[];
  annotations?: Array<{
    type?: string;
    url?: string;
    url_citation?: { url?: string };
  }>;
}

interface LovableAIChoice {
  message?: LovableAIMessage;
}

interface LovableAIResponse {
  choices?: LovableAIChoice[];
}

function parseJsonObject(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

// Backward-compat helper – kept so other callers don't break.
export async function queryPerplexityJSON(prompt: string, _apiKey: string): Promise<Record<string, unknown>> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Lovable AI HTTP ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as LovableAIResponse;
  const text = data?.choices?.[0]?.message?.content ?? "{}";
  return parseJsonObject(text);
}

// Web search via Lovable AI Gateway (OpenAI GPT-5 + web_search tool)
// Behåller exakt samma signatur och returstruktur som Perplexity-versionen.
export async function searchWineWithPerplexity(
  ocrText: string,
  _apiKey: string,
  timeoutMs = 15000,
): Promise<{ data: WineSearchResult; sources: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const userPrompt = `Sök på webben och hitta fakta om detta vin från etiketten: "${ocrText.slice(0, 250)}"

Prioritera källor i denna ordning:
1. Systembolaget.se
2. Producentens officiella webbplats
3. Nordiska monopol (alko.fi, vinmonopolet.no, vinbudin.is)
4. Återförsäljare (vivino.com, wine-searcher.com, cellartracker.com)
5. Proffsmagasin (wine-spectator.com, decanter.com, robertparker.com)

Returnera resultatet via verktyget "return_wine_facts". Om ett fält saknas, använd "-". Max 3 passar_till-maträtter.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          {
            role: "system",
            content: "Du är en sommelier-assistent som söker efter vinfakta på webben och returnerar strukturerad data. Använd alltid web_search-verktyget innan du svarar.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [
          { type: "web_search" },
          {
            type: "function",
            function: {
              name: "return_wine_facts",
              description: "Returnera strukturerad vinfakta hittad via webbsökning.",
              parameters: {
                type: "object",
                properties: {
                  vin: { type: "string" },
                  producent: { type: "string" },
                  druvor: { type: "string" },
                  land_region: { type: "string" },
                  årgång: { type: "string" },
                  alkoholhalt: { type: "string" },
                  volym: { type: "string" },
                  klassificering: { type: "string" },
                  karaktär: { type: "string" },
                  smak: { type: "string" },
                  servering: { type: "string" },
                  passar_till: { type: "array", items: { type: "string" }, maxItems: 3 },
                },
                required: ["vin", "producent", "druvor", "land_region", "årgång"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_wine_facts" } },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) throw new Error("lovable_ai_rate_limit");
      if (res.status === 402) throw new Error("lovable_ai_payment_required");
      throw new Error(`Lovable AI HTTP ${res.status}: ${errText}`);
    }

    const resData = (await res.json()) as LovableAIResponse;
    const message = resData?.choices?.[0]?.message;
    const toolCall = message?.tool_calls?.find((tc) => tc.function?.name === "return_wine_facts");
    const argsJson = toolCall?.function?.arguments ?? "";

    let parsedData: WineSearchResult | null = null;
    try {
      if (argsJson) {
        parsedData = parseJsonObject(argsJson) as WineSearchResult;
      } else if (message?.content) {
        // Fallback: försök parsa content om tool call inte returnerades
        const cleanJson = message.content.trim().replace(/^```json\s*|```$/g, "");
        parsedData = parseJsonObject(cleanJson) as WineSearchResult;
      }
    } catch (parseError) {
      console.error("Lovable AI JSON parse error:", parseError);
      console.error("Raw tool args (first 500):", argsJson.substring(0, 500));
      throw new Error("Lovable AI did not return valid JSON");
    }

    // Extrahera källor från annotations (web_search ger url_citation)
    const annotations = Array.isArray(message?.annotations) ? message!.annotations! : [];
    const allUrls = annotations
      .map((a) => a?.url_citation?.url ?? a?.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    // Prioritera samma källordning som tidigare
    const systembolagetSources = allUrls.filter((url) => url.includes("systembolaget.se"));
    const nordicMonopolSources = allUrls.filter((url) =>
      url.includes("alko.fi") || url.includes("vinmonopolet.no") || url.includes("vinbudin.is")
    );
    const producerSources = allUrls.filter((url) =>
      !url.includes("systembolaget.se") &&
      !url.includes("alko.fi") &&
      !url.includes("vinmonopolet.no") &&
      !url.includes("vinbudin.is") &&
      (url.includes("winery") || url.includes("bodega") || url.includes("vineyard") || url.includes("chateau"))
    );
    const retailerSources = allUrls.filter((url) =>
      url.includes("vivino.com") || url.includes("wine-searcher.com") || url.includes("cellartracker.com")
    );
    const magazineSources = allUrls.filter((url) =>
      url.includes("wine-spectator.com") || url.includes("decanter.com") || url.includes("robertparker.com")
    );

    const prioritizedSources = [
      ...systembolagetSources.slice(0, 1),
      ...nordicMonopolSources.slice(0, 1),
      ...producerSources.slice(0, 1),
      ...retailerSources.slice(0, 1),
      ...magazineSources.slice(0, 1),
    ];

    // Om inga prioriterade matchningar – ta de första 3 unika
    const finalSources = (prioritizedSources.length > 0
      ? prioritizedSources
      : Array.from(new Set(allUrls)).slice(0, 3)
    ).slice(0, 3);

    return {
      data: parsedData ?? { text: message?.content ?? "" },
      sources: finalSources,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && (error.message.includes("abort") || error.message.includes("timeout"))) {
      throw new Error("perplexity_timeout");
    }
    throw error;
  }
}
