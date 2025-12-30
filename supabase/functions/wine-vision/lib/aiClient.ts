// AI Client Wrapper for Google Gemini & Perplexity (Direct API)
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

// Google Gemini native types
interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

// Perplexity types
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
  citations?: string[];
}

export interface PerplexityResult {
  data: Record<string, unknown>;
  citations: string[];
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const PERPLEXITY_API = "https://api.perplexity.ai/chat/completions";

// Model mapping - convert friendly names to Google API model names
function getGeminiModelName(model: string): string {
  // Remove "google/" prefix if present and map to API model names
  const cleanModel = model.replace("google/", "");
  
  // Use stable model names that are always available
  const modelMap: Record<string, string> = {
    "gemini-2.5-flash": "gemini-2.0-flash",
    "gemini-2.5-pro": "gemini-1.5-pro",
    "gemini-2.5-flash-lite": "gemini-2.0-flash",
    "gemini-3-pro-preview": "gemini-1.5-pro",
  };
  
  return modelMap[cleanModel] || cleanModel;
}

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

  const modelName = getGeminiModelName("gemini-2.5-flash");
  const url = `${GEMINI_API}/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: fixPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2500,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini repair failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error("Gemini repair returned empty content");
  }

  return parseJsonObject(content);
}

/**
 * Call Gemini directly via Google Generative AI API
 * @example
 * const result = await gemini("Translate to Swedish", { json: true });
 * const ocr = await gemini("Read text", { imageUrl: base64Image });
 */
async function gemini(prompt: string, options?: GeminiTextOptions): Promise<string>;
async function gemini(prompt: string, options: GeminiJsonOptions): Promise<Record<string, unknown>>;
async function gemini(prompt: string, options: GeminiOptions = {}): Promise<string | Record<string, unknown>> {
  const {
    model = "gemini-2.5-flash",
    json = false,
    temperature = 0.1,
    maxTokens = 2500,
    imageUrl,
    timeoutMs = 30000,
  } = options;

  // Log image size for debugging
  if (imageUrl) {
    const imgSize = imageUrl.length;
    console.log(`[aiClient.gemini] Image size: ${Math.round(imgSize / 1024)}KB, model: ${model}`);
  }

  const googleApiKey = Deno.env.get("GOOGLE_API_KEY");
  if (!googleApiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  // Build parts array for Google's native format
  const parts: GeminiPart[] = [];

  if (imageUrl) {
    // Extract base64 data and mime type
    let base64Data = imageUrl;
    let mimeType = "image/jpeg";

    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    parts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }

  parts.push({ text: prompt });

  const modelName = getGeminiModelName(model);
  const url = `${GEMINI_API}/${modelName}:generateContent?key=${googleApiKey}`;

  const body: GeminiRequestBody = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (json) {
    body.generationConfig.responseMimeType = "application/json";
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
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
      if (response.status === 403) throw new Error("api_key_invalid");

      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawContent !== "string") {
      throw new Error("Gemini response missing content");
    }

    if (json) {
      const cleaned = rawContent.trim().replace(/^```json|```$/g, "").replace(/^```|```$/g, "");
      try {
        return parseJsonObject(cleaned);
      } catch {
        // Attempt JSON repair with Gemini
        console.log("[aiClient.gemini] JSON parse failed, attempting forceJson repair...");
        console.log("[aiClient.gemini] Raw content (full):", cleaned);
        const schemaHint = "WineSummary schema with vin, producent, druvor, land_region, argang, alkohol, volym, farg, smakprofil, servering, mat_kombination, beskrivning, evidence";
        try {
          return await forceJson(cleaned, schemaHint, googleApiKey);
        } catch (repairError) {
          console.error("[aiClient.gemini] forceJson repair also failed:", repairError);
          throw new Error("Gemini did not return valid JSON");
        }
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
async function perplexity(prompt: string, options: PerplexityOptions = {}): Promise<PerplexityResult> {
  const {
    model = "sonar",
    siteWhitelist = [],
    temperature = 0.0,
    maxTokens = 600,
    timeoutMs = 20000,
    systemPrompt,
    schemaHint,
  } = options;

  const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");
  const googleApiKey = Deno.env.get("GOOGLE_API_KEY");

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

    const responseData = (await response.json()) as PerplexityResponse;
    const rawContent = responseData?.choices?.[0]?.message?.content ?? "{}";
    // Extract citations from Perplexity response
    const citations = responseData?.citations ?? [];

    console.log(`[aiClient.perplexity] Got ${citations.length} citations:`, citations.slice(0, 3));

    if (typeof rawContent !== "string") {
      throw new Error("Perplexity response missing content");
    }

    // Clean markdown code blocks if present
    const cleaned = rawContent.trim().replace(/^```json\s*|```$/g, "");

    let parsedData: Record<string, unknown>;

    // Use forceJson if schema hint is provided
    if (schemaHint && googleApiKey) {
      console.log("Using forceJson for Perplexity response...");
      parsedData = await forceJson(cleaned, schemaHint, googleApiKey);
    } else {
      // Otherwise try direct parse
      try {
        parsedData = parseJsonObject(cleaned);
      } catch (parseError) {
        console.error("Perplexity JSON parse error:", parseError);
        console.error("Raw content (first 500 chars):", cleaned.substring(0, 500));
        throw new Error("Perplexity did not return valid JSON");
      }
    }

    // Return both parsed data and citations
    return {
      data: parsedData,
      citations: citations.filter((url: string) => typeof url === "string" && url.startsWith("http")),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "request_timeout") {
      throw new Error("perplexity_timeout");
    }
    throw error;
  }
}

// Export the AI client
export const aiClient = {
  gemini,
  perplexity,
};

export default aiClient;
