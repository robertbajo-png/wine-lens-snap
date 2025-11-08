import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WineMetadata {
  wineName: string;
  producer: string;
  grapeVariety: string[];
  region: string;
  country: string;
  vintage: string;
}

interface TasteProfile {
  sweetness: number;
  body: number;
  fruit: number;
  acidity: number;
  tannin?: number;
  oak?: number;
}

interface TasteResult {
  tasteProfile: TasteProfile;
  summary: string;
  foodPairing: string[];
  usedSignals: string[];
}

interface WineAnalysisResult extends WineMetadata, TasteResult {}

const clampSlider = (n: unknown) => {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  if (Number.isNaN(x)) return 3;
  const clamped = Math.min(5, Math.max(1, x));
  return Math.round(clamped * 2) / 2;
};

const isVague = (s: string) => {
  const t = (s || "").toLowerCase();
  if (t.length < 20) return true;
  const vagueWords = ["nice", "pleasant", "balanced", "good", "tasty", "lovely"];
  return vagueWords.some((w) => t.includes(w)) && t.length < 50;
};

async function callLovableAI(messages: any[], responseFormat: "json" | "text" = "json") {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: responseFormat === "json" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function extractMetadata(imageBase64: string): Promise<WineMetadata> {
  console.log("[extractMetadata] Starting...");
  const t0 = performance.now();

  const prompt = `Analysera vin-etiketten och returnera ENBART JSON med följande fält:
{
  "wineName": "vinets namn",
  "producer": "producent",
  "grapeVariety": ["druva1", "druva2"],
  "region": "region",
  "country": "land",
  "vintage": "årgång eller N/V"
}

Svenska fält. vintage = "N/V" om okänt. Inga markdown.`;

  const content = await callLovableAI([
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
        },
      ],
    },
  ], "json");

  const json = JSON.parse(content);
  
  const meta: WineMetadata = {
    wineName: String(json.wineName || "").trim(),
    producer: String(json.producer || "").trim(),
    grapeVariety: Array.isArray(json.grapeVariety)
      ? json.grapeVariety.map((g: unknown) => String(g).trim()).filter(Boolean)
      : [],
    region: String(json.region || "").trim(),
    country: String(json.country || "").trim(),
    vintage: String(json.vintage || "N/V").trim() || "N/V",
  };

  const dt = Math.round(performance.now() - t0);
  console.log(`[extractMetadata] Success (${dt}ms):`, meta);
  
  if (!meta.wineName || !meta.producer || !meta.region || !meta.country) {
    throw new Error("Missing required fields in metadata");
  }

  return meta;
}

async function generateTaste(meta: WineMetadata): Promise<TasteResult> {
  console.log("[generateTaste] Starting...");
  const t0 = performance.now();

  const prompt = `Du är sommelier. Baserat på etikettmetadata ska du returnera ENBART JSON (svenska):

METADATA:
- Namn: ${meta.wineName}
- Producent: ${meta.producer}
- Druvor: ${meta.grapeVariety.join(", ") || "okänt"}
- Region: ${meta.region}, ${meta.country}
- Årgång: ${meta.vintage}

Returnera JSON med:
{
  "tasteProfile": {
    "sweetness": number (1-5),
    "body": number (1-5),
    "fruit": number (1-5),
    "acidity": number (1-5),
    "tannin": number (1-5, valfritt),
    "oak": number (1-5, valfritt)
  },
  "summary": "exakt EN svensk mening (20-28 ord) som speglar siffrorna tydligt",
  "foodPairing": ["rätt1", "rätt2", "rätt3"],
  "usedSignals": ["ledtråd1", "ledtråd2", "ledtråd3"]
}

Halva steg ok (t.ex. 3.5). Inga markdown.`;

  const content = await callLovableAI([
    { role: "user", content: prompt },
  ], "json");

  const json = JSON.parse(content);

  const tp = json.tasteProfile || {};
  const tasteProfile: TasteProfile = {
    sweetness: clampSlider(tp.sweetness),
    body: clampSlider(tp.body),
    fruit: clampSlider(tp.fruit),
    acidity: clampSlider(tp.acidity),
    tannin: tp.tannin != null ? clampSlider(tp.tannin) : undefined,
    oak: tp.oak != null ? clampSlider(tp.oak) : undefined,
  };

  let summary: string = String(json.summary || "").trim();
  
  // Repair vague summary
  if (isVague(summary)) {
    console.log("[generateTaste] Summary is vague, repairing...");
    const repairPrompt = `Omformulera följande smakmening till exakt en svensk mening (20–28 ord) som speglar dessa siffror. Använd inga nya fakta.
Siffror: ${JSON.stringify(tasteProfile)}
Mening: "${summary}"`;
    
    const repaired = await callLovableAI([
      { role: "user", content: repairPrompt },
    ], "text");
    
    if (!isVague(repaired)) summary = repaired;
  }

  let food: string[] = Array.isArray(json.foodPairing)
    ? json.foodPairing.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  // Ensure exactly 3 food pairings
  if (food.length !== 3) {
    console.log("[generateTaste] Wrong number of food pairings, fixing...");
    const foodPrompt = `Skapa EXAKT 3 svenska maträtter baserat på denna smakprofil. Returnera JSON-array: ["rätt1", "rätt2", "rätt3"]
Smakprofil: ${JSON.stringify(tasteProfile)}`;
    
    const fixedFood = await callLovableAI([
      { role: "user", content: foodPrompt },
    ], "json");
    
    try {
      const parsed = JSON.parse(fixedFood);
      if (Array.isArray(parsed) && parsed.length === 3) {
        food = parsed.map((s: unknown) => String(s).trim());
      }
    } catch {
      // ignore repair failure
    }
  }

  const usedSignals: string[] = Array.isArray(json.usedSignals)
    ? json.usedSignals.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 5)
    : [];

  const result: TasteResult = {
    tasteProfile,
    summary,
    foodPairing: food.slice(0, 3),
    usedSignals,
  };

  const dt = Math.round(performance.now() - t0);
  console.log(`[generateTaste] Success (${dt}ms):`, result);

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing imageBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[wine-analysis-lovable] Starting analysis...");
    const totalStart = performance.now();

    // Extract metadata from image
    const metadata = await extractMetadata(imageBase64);

    // Generate taste profile
    const tasteResult = await generateTaste(metadata);

    const result: WineAnalysisResult = {
      ...metadata,
      ...tasteResult,
    };

    const totalTime = Math.round(performance.now() - totalStart);
    console.log(`[wine-analysis-lovable] Complete (${totalTime}ms)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[wine-analysis-lovable] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
