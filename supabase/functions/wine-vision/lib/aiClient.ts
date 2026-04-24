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
  // Remove "google/" prefix if present
  return model.replace("google/", "");
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

  const modelName = getGeminiModelName("gemini-3-flash-preview");
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
    model = "gemini-3-flash-preview",
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
// NOTE: Funktionen heter fortfarande `perplexity` för bakåtkompatibilitet,
// men använder nu Lovable AI Gateway (OpenAI GPT-5 + web_search-tool) istället.
// Originalkod finns i aiClient.ts.backup för enkel återställning.
interface LovableAIToolCall {
  function?: { name?: string; arguments?: string };
}
interface LovableAIAnnotation {
  type?: string;
  url?: string;
  url_citation?: { url?: string };
}
interface LovableAIMessage {
  content?: string | null;
  tool_calls?: LovableAIToolCall[];
  annotations?: LovableAIAnnotation[];
}
interface LovableAIResponse {
  choices?: Array<{ message?: LovableAIMessage }>;
}

async function perplexity(prompt: string, options: PerplexityOptions = {}): Promise<PerplexityResult> {
  const {
    siteWhitelist = [],
    timeoutMs = 25000,
    systemPrompt,
  } = options;

  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  let finalPrompt = prompt;
  if (siteWhitelist.length > 0) {
    const siteQueries = siteWhitelist.map((d) => `site:${d}`).join(" OR ");
    finalPrompt = `${prompt}\n\nPrioritera dessa källor: ${siteQueries}`;
  }

  // Be modellen returnera ren JSON i en tydlig kodblock-struktur (Gemini stödjer inte
  // function-calling tillsammans med google_search-grounding via Lovable Gateway).
  const jsonInstruction = `

VIKTIGT: Returnera ENDAST ett giltigt minifierat JSON-objekt (inget annat) med dessa fält:
{
  "vin": string,
  "producent": string,
  "druvor": string,
  "land_region": string,
  "årgång": string,
  "alkoholhalt": string,
  "volym": string,
  "klassificering": string,
  "karaktär": string,
  "smak": string,
  "servering": string,
  "passar_till": string[]  // max 3 förslag
}
Om ett fält är okänt, lämna det som tom sträng "".`;

  const messages: Array<{ role: string; content: string }> = [];
  messages.push({
    role: "system",
    content: systemPrompt
      ?? "Du är en sommelier-assistent. Använd webbsökning för att hitta vinfakta och returnera resultatet som ett rent JSON-objekt.",
  });
  messages.push({ role: "user", content: finalPrompt + jsonInstruction });

  try {
    const response = await fetchWithTimeout(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages,
          tools: [
            { type: "google_search" },
          ],
        }),
      },
      timeoutMs,
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[aiClient.perplexity→lovable/gemini] HTTP ${response.status}:`, errText);
      if (response.status === 429) throw new Error("rate_limit_exceeded");
      if (response.status === 402) throw new Error("payment_required");
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const responseData = (await response.json()) as LovableAIResponse;
    const message = responseData?.choices?.[0]?.message;
    const rawContent = message?.content ?? "";

    let parsedData: Record<string, unknown>;
    try {
      if (!rawContent) {
        throw new Error("Lovable AI returned empty content");
      }
      // Plocka första JSON-objektet ur svaret (kan vara inbäddat i markdown-codefence)
      const cleaned = rawContent
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "");
      const match = cleaned.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : cleaned;
      parsedData = parseJsonObject(jsonStr);
    } catch (parseError) {
      console.error("[aiClient.perplexity→lovable/gemini] JSON parse error:", parseError);
      console.error("Raw content (first 500):", rawContent.substring(0, 500));
      throw new Error("Lovable AI did not return valid JSON");
    }

    // Hämta citations från google_search-annotations
    const annotations = Array.isArray(message?.annotations) ? message!.annotations! : [];
    const citations = annotations
      .map((a) => a?.url_citation?.url ?? a?.url)
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"));

    console.log(`[aiClient.perplexity→lovable/gemini] Got ${citations.length} citations:`, citations.slice(0, 3));

    return {
      data: parsedData,
      citations,
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
