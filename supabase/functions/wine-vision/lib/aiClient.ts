// AI Client Wrapper for Lovable AI Gateway & Perplexity
// Provides clean SDK-like interface while using fetch under the hood

interface GeminiSharedOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  imageUrl?: string;
  timeoutMs?: number;
}

interface GeminiJsonOptions extends GeminiSharedOptions {
  json: true;
}

interface GeminiTextOptions extends GeminiSharedOptions {
  json?: false;
}

type GeminiOptions = GeminiJsonOptions | GeminiTextOptions;

interface PerplexityOptions {
  model?: string;
  siteWhitelist?: string[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  schemaHint?: string;
}

type GeminiMessageRole = "system" | "user";

interface GeminiTextContent {
  type: "text";
  text: string;
}

interface GeminiImageContent {
  type: "image_url";
  image_url: { url: string };
}

type GeminiContent = string | (GeminiTextContent | GeminiImageContent)[];

interface GeminiMessage {
  role: GeminiMessageRole;
  content: GeminiContent;
}

interface GeminiRequestBody {
  model: string;
  temperature: number;
  max_tokens: number;
  messages: GeminiMessage[];
  response_format?: { type: "json_object" };
}

interface LovableGatewayChoice {
  message?: {
    content?: string;
  };
}

interface LovableGatewayResponse {
  choices?: LovableGatewayChoice[];
}

type PerplexityMessageRole = "system" | "user";

interface PerplexityMessage {
  role: PerplexityMessageRole;
  content: string;
}

interface PerplexityChoice {
  message?: {
    content?: string;
  };
}

interface PerplexityResponse {
  choices?: PerplexityChoice[];
}

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PERPLEXITY_API = "https://api.perplexity.ai/chat/completions";

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("request_timeout");
    }
    throw error;
  }
}

function parseJsonObject(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

// JSON repair function using Gemini
async function forceJson(raw: string, schemaHint: string, apiKey: string): Promise<Record<string, unknown>> {
  // 1) Direct parse
  try {
    return parseJsonObject(raw);
  } catch {
    // Ignore parse errors and attempt further recovery strategies.
  }

  // 2) Extract first JSON object
  const match = raw.match(/\{[\s\S]*\}$/m) || raw.match(/\{[\s\S]*?\}/m);
  if (match) {
    try {
      return parseJsonObject(match[0]);
    } catch {
      // Ignore parse errors and fall back to Gemini repair.
    }
  }

  // 3) Ask Gemini to repair to valid JSON according to schema
  console.log("Attempting JSON repair with Gemini...");
  const fixPrompt = `
Du får text som påstår sig vara JSON men inte är giltig.
Returnera ENDAST ett giltigt, minifierat JSON-objekt som följer detta schema:
${schemaHint}

Text att reparera:
<<<${raw}>>>
`;

  const response = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: fixPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini repair failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as LovableGatewayResponse;
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Gemini repair returned empty content");
  }

  return parseJsonObject(content);
}

/**
 * Call Gemini via Lovable AI Gateway
 * @example
 * const result = await gemini("Translate to Swedish", { json: true });
 * const ocr = await gemini("Read text", { imageUrl: base64Image });
 */
async function gemini(prompt: string, options?: GeminiTextOptions): Promise<string>;
async function gemini(prompt: string, options: GeminiJsonOptions): Promise<Record<string, unknown>>;
async function gemini(prompt: string, options: GeminiOptions = {}): Promise<string | Record<string, unknown>> {
  const {
    model = "google/gemini-2.5-flash",
    json = false,
    temperature = 0.1,
    maxTokens = 1200,
    imageUrl,
    timeoutMs = 20000,
  } = options;

  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const userContent: GeminiContent = imageUrl
    ? [
        {
          type: "image_url",
          image_url: {
            url: imageUrl.startsWith("data:") ? imageUrl : `data:image/jpeg;base64,${imageUrl}`,
          },
        },
        {
          type: "text",
          text: prompt,
        },
      ]
    : prompt;

  const body: GeminiRequestBody = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: userContent }],
  };

  if (json) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetchWithTimeout(
      LOVABLE_GATEWAY,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[aiClient.gemini] HTTP ${response.status}:`, errText);

      if (response.status === 429) throw new Error("rate_limit_exceeded");
      if (response.status === 402) throw new Error("payment_required");

      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = (await response.json()) as LovableGatewayResponse;
    const rawContent = data?.choices?.[0]?.message?.content;

    if (typeof rawContent !== "string") {
      throw new Error("Gemini response missing content");
    }

    if (json) {
      try {
        const cleaned = rawContent.trim().replace(/^```json|```$/g, "").replace(/^```|```$/g, "");
        return parseJsonObject(cleaned);
      } catch {
        throw new Error("Gemini did not return valid JSON");
      }
    }

    return rawContent;
  } catch (error) {
    if (error instanceof Error && error.message === "request_timeout") {
      throw new Error("gemini_timeout");
    }
    throw error;
  }
}

/**
 * Call Perplexity API with optional site whitelist and robust JSON parsing
 * @example
 * const result = await perplexity("Find wine info", {
 *   siteWhitelist: ["systembolaget.se", "vivino.com"],
 *   systemPrompt: "You are a JSON extractor",
 *   schemaHint: '{"vin": "", "producent": ""}'
 * });
 */
async function perplexity(prompt: string, options: PerplexityOptions = {}): Promise<Record<string, unknown>> {
  const {
    model = "sonar",
    siteWhitelist = [],
    temperature = 0.0,
    maxTokens = 600,
    timeoutMs = 12000,
    systemPrompt,
    schemaHint,
  } = options;

  const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  if (!perplexityApiKey) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  const messages: PerplexityMessage[] = [];

  // Add system message if provided
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  let finalPrompt = prompt;
  if (siteWhitelist.length > 0) {
    const siteQueries = siteWhitelist.map((domain) => `site:${domain}`).join(" OR ");
    finalPrompt = `${prompt}\n\nSearch only in: ${siteQueries}`;
  }

  messages.push({ role: "user", content: finalPrompt });

  try {
    const response = await fetchWithTimeout(
      PERPLEXITY_API,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages,
        }),
      },
      timeoutMs
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[aiClient.perplexity] HTTP ${response.status}:`, errText);
      throw new Error(`Perplexity error: ${response.status}`);
    }

    const data = (await response.json()) as PerplexityResponse;
    const rawContent = data?.choices?.[0]?.message?.content ?? "{}";

    if (typeof rawContent !== "string") {
      throw new Error("Perplexity response missing content");
    }

    // Clean markdown code blocks if present
    const cleaned = rawContent.trim().replace(/^```json\s*|```$/g, "");

    // Use forceJson if schema hint is provided
    if (schemaHint && lovableApiKey) {
      console.log("Using forceJson for Perplexity response...");
      return await forceJson(cleaned, schemaHint, lovableApiKey);
    }

    // Otherwise try direct parse
    try {
      return parseJsonObject(cleaned);
    } catch (parseError) {
      console.error("Perplexity JSON parse error:", parseError);
      console.error("Raw content (first 500 chars):", cleaned.substring(0, 500));
      throw new Error("Perplexity did not return valid JSON");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "request_timeout") {
      throw new Error("perplexity_timeout");
    }
    throw error;
  }
}

/**
 * Call GPT-5 via Lovable AI Gateway
 * @example
 * const result = await gpt5("Translate to Swedish", { json: true });
 * const ocr = await gpt5("Read text", { imageUrl: base64Image });
 */
async function gpt5(prompt: string, options: { json?: false; model?: string; imageUrl?: string; timeoutMs?: number; maxCompletionTokens?: number }): Promise<string>;
async function gpt5(prompt: string, options: { json: true; model?: string; imageUrl?: string; timeoutMs?: number; maxCompletionTokens?: number }): Promise<Record<string, unknown>>;
async function gpt5(
  prompt: string,
  options: {
    json?: boolean;
    model?: string;
    imageUrl?: string;
    timeoutMs?: number;
    maxCompletionTokens?: number;
  } = {}
): Promise<string | Record<string, unknown>> {
  const {
    model = "openai/gpt-5-mini",
    json = false,
    imageUrl,
    timeoutMs = 20000,
    maxCompletionTokens = 2000,
  } = options;

  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const userContent: GeminiContent = imageUrl
    ? [
        {
          type: "image_url",
          image_url: {
            url: imageUrl.startsWith("data:") ? imageUrl : `data:image/jpeg;base64,${imageUrl}`,
          },
        },
        {
          type: "text",
          text: prompt,
        },
      ]
    : prompt;

  const body: any = {
    model,
    max_completion_tokens: maxCompletionTokens,
    messages: [{ role: "user", content: userContent }],
  };

  if (json) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetchWithTimeout(
      LOVABLE_GATEWAY,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      timeoutMs
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[aiClient.gpt5] HTTP ${response.status}:`, errText);

      if (response.status === 429) throw new Error("rate_limit_exceeded");
      if (response.status === 402) throw new Error("payment_required");

      throw new Error(`GPT-5 error: ${response.status}`);
    }

    const data = (await response.json()) as LovableGatewayResponse;
    const rawContent = data?.choices?.[0]?.message?.content;

    if (typeof rawContent !== "string") {
      throw new Error("GPT-5 response missing content");
    }

    if (json) {
      try {
        const cleaned = rawContent.trim().replace(/^```json|```$/g, "").replace(/^```|```$/g, "");
        return parseJsonObject(cleaned);
      } catch {
        throw new Error("GPT-5 did not return valid JSON");
      }
    }

    return rawContent;
  } catch (error) {
    if (error instanceof Error && error.message === "request_timeout") {
      throw new Error("gpt5_timeout");
    }
    throw error;
  }
}

export const aiClient = {
  gemini,
  gpt5,
  perplexity,
};
