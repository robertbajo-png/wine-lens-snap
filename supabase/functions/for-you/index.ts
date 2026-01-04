// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FOR_YOU_EVENT_TYPE = "for_you_generation";
const SCENARIO_EVENT_TYPE = "for_you_scenario";

// Rate limits
const FOR_YOU_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h to stay within 6–12h target
const SCENARIO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h window for daily caps
const SCENARIO_DAILY_LIMIT = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TasteProfileEntry = { value: string; count: number };
type TasteProfile = {
  topGrapes: TasteProfileEntry[];
  topRegions: TasteProfileEntry[];
  topStyles: TasteProfileEntry[];
  topPairings: TasteProfileEntry[];
  avgSweetness: number | null;
  avgAcidity: number | null;
  avgTannin: number | null;
  totalScans: number;
  recentHighlights: string[];
};

type ForYouCard = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  items?: string[];
  cta?: {
    label?: string;
    href?: string;
    action?: string;
  };
};

type ForYouResponse = {
  cards: ForYouCard[];
  generated_at: string;
  overall_confidence: number;
  notes: string[];
};

type ScanRow = {
  id: string;
  created_at: string;
  analysis_json: unknown;
  raw_ocr: string | null;
  vintage?: number | null;
};

type ScenarioMode = "tonight" | "food" | "similar";

const respondJson = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const buildRateLimitResponse = (kind: "for-you" | "scenario") =>
  kind === "for-you"
    ? respondJson(
      {
        error: "rate_limit",
        message: "För dig kan uppdateras högst en gång var 12:e timme. Försök igen senare.",
      },
      429,
    )
    : respondJson(
      {
        error: "rate_limit",
        message: "Du har nått gränsen 20 scenariokort per dag. Försök igen imorgon.",
      },
      429,
    );

const getUserFromRequest = async (req: Request) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;

  const token = authHeader.replace(/bearer\s+/i, "");

  if (token === SUPABASE_ANON_KEY) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.warn("[for-you] Failed to resolve user:", error?.message);
    return null;
  }

  return data.user;
};

const splitCompositeField = (value: string): string[] =>
  value
    .split(/[,/|;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const normalizeToNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractStringValues = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .flatMap((value) => (typeof value === "string" ? splitCompositeField(value) : []))
      .filter((value) => value.trim().length > 0);
  }
  if (typeof raw === "string") {
    return splitCompositeField(raw);
  }
  return [];
};

const extractRegions = (rawRegion: unknown): string[] => {
  if (typeof rawRegion !== "string") return [];
  const trimmed = rawRegion.trim();
  if (!trimmed) return [];
  return splitCompositeField(trimmed);
};

const getMeterValue = (analysis: Record<string, unknown>, candidateKeys: string[]): number | null => {
  const meters = analysis.meters;
  if (meters && typeof meters === "object" && !Array.isArray(meters)) {
    for (const key of candidateKeys) {
      const meterValue = normalizeToNumber((meters as Record<string, unknown>)[key]);
      if (meterValue !== null) return meterValue;
    }
  }

  for (const key of candidateKeys) {
    const directValue = normalizeToNumber(analysis[key]);
    if (directValue !== null) return directValue;
  }

  return null;
};

const parseAnalysisPayload = (analysis: unknown): Record<string, unknown> | null => {
  if (analysis === null || analysis === undefined) return null;

  let candidate: unknown = analysis;
  if (typeof analysis === "string") {
    try {
      candidate = JSON.parse(analysis);
    } catch {
      return null;
    }
  }

  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return null;
  }

  return { ...(candidate as Record<string, unknown>) };
};

const normalizeScanAnalysis = (analysis: unknown) => {
  const parsed = parseAnalysisPayload(analysis);
  if (!parsed) return null;

  const normalized = { ...parsed };
  const grapes = extractStringValues(parsed.grapes ?? (parsed as Record<string, unknown>).druvor);
  if (grapes.length > 0) normalized.grapes = grapes;

  const pairings = extractStringValues(
    parsed.food_pairings ?? (parsed as Record<string, unknown>).passar_till ?? (parsed as Record<string, unknown>).att_till,
  );
  if (pairings.length > 0) normalized.food_pairings = pairings;

  if (parsed.meters && typeof parsed.meters === "object" && !Array.isArray(parsed.meters)) {
    const normalizedMeters: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(parsed.meters as Record<string, unknown>)) {
      normalizedMeters[key] = normalizeToNumber(value);
    }
    normalized.meters = normalizedMeters;
  }

  return normalized;
};

const addCount = (counter: Map<string, TasteProfileEntry>, rawValue: string) => {
  const normalized = rawValue.trim();
  if (!normalized) return;

  const key = normalized.toLowerCase();
  const existing = counter.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }

  counter.set(key, { value: normalized, count: 1 });
};

const sortEntries = (counter: Map<string, TasteProfileEntry>): TasteProfileEntry[] =>
  Array.from(counter.values()).sort((a, b) => {
    if (b.count === a.count) return a.value.localeCompare(b.value, "sv");
    return b.count - a.count;
  });

const countEventsSince = async (userId: string, eventType: string, since: Date) => {
  const { count, error } = await supabaseAdmin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("[for-you] Failed to count events", error.message);
    throw new Error("event_count_failed");
  }

  return count ?? 0;
};

const recordEvent = async (userId: string, eventType: string, payload: Record<string, unknown> = {}) => {
  const { error } = await supabaseAdmin.from("events").insert({
    user_id: userId,
    event_type: eventType,
    payload,
  });

  if (error) {
    console.error("[for-you] Failed to record event", error.message);
    throw new Error("event_record_failed");
  }
};

const safelyRecordEvent = async (userId: string, eventType: string, payload: Record<string, unknown> = {}) => {
  try {
    await recordEvent(userId, eventType, payload);
  } catch (error) {
    console.error("[for-you] Failed to log event", error);
  }
};

const computeAverage = (sum: number, count: number): number | null =>
  count > 0 ? Math.round((sum / count) * 100) / 100 : null;

const buildTasteProfile = (scans: ScanRow[]): TasteProfile => {
  const grapeCounts = new Map<string, TasteProfileEntry>();
  const regionCounts = new Map<string, TasteProfileEntry>();
  const styleCounts = new Map<string, TasteProfileEntry>();
  const pairingCounts = new Map<string, TasteProfileEntry>();

  let sweetnessSum = 0;
  let sweetnessCount = 0;
  let aciditySum = 0;
  let acidityCount = 0;
  let tanninSum = 0;
  let tanninCount = 0;

  const highlights: string[] = [];

  for (const scan of scans) {
    const analysis = normalizeScanAnalysis(scan.analysis_json);
    if (!analysis) continue;

    const grapes = extractStringValues(analysis.grapes);
    const regions = extractRegions(analysis.land_region);
    const styles = extractStringValues(analysis.style);
    const pairings = extractStringValues(
      analysis.food_pairings ?? (analysis as Record<string, unknown>).passar_till,
    );

    grapes.forEach((grape) => addCount(grapeCounts, grape));
    regions.forEach((region) => addCount(regionCounts, region));
    styles.forEach((style) => addCount(styleCounts, style));
    pairings.forEach((pairing) => addCount(pairingCounts, pairing));

    const sweetnessValue = getMeterValue(analysis, ["sötma", "sweetness"]);
    if (sweetnessValue !== null) {
      sweetnessSum += sweetnessValue;
      sweetnessCount += 1;
    }

    const acidityValue = getMeterValue(analysis, ["fruktsyra", "acidity"]);
    if (acidityValue !== null) {
      aciditySum += acidityValue;
      acidityCount += 1;
    }

    const tanninValue = getMeterValue(analysis, ["tannin", "tannins", "strävhet", "stravhet"]);
    if (tanninValue !== null) {
      tanninSum += tanninValue;
      tanninCount += 1;
    }

    if (highlights.length < 6) {
      const title =
        typeof analysis.vin === "string"
          ? analysis.vin
          : typeof (analysis as Record<string, unknown>).name === "string"
            ? (analysis as Record<string, unknown>).name
            : scan.raw_ocr?.slice(0, 80) ?? "Okänt vin";
      const region = regions[0] ?? "okänd region";
      const grapeList = grapes.slice(0, 3).join(", ") || "okänd druva";
      const style = styles[0] ?? "okänd stil";
      const highlight = `${title} — ${style}, ${region}. Druvor: ${grapeList}.`;
      highlights.push(highlight);
    }
  }

  return {
    topGrapes: sortEntries(grapeCounts),
    topRegions: sortEntries(regionCounts),
    topStyles: sortEntries(styleCounts),
    topPairings: sortEntries(pairingCounts),
    avgSweetness: computeAverage(sweetnessSum, sweetnessCount),
    avgAcidity: computeAverage(aciditySum, acidityCount),
    avgTannin: computeAverage(tanninSum, tanninCount),
    totalScans: scans.length,
    recentHighlights: highlights,
  };
};

const fetchRecentScans = async (userId: string, limit = 50): Promise<ScanRow[]> => {
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 50;

  // Recommendations are derived only from user's wine_scans
  const { data, error } = await supabaseAdmin
    .from("scans")
    .select("id,created_at,analysis_json,raw_ocr,vintage")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(resolvedLimit);

  if (error) {
    throw new Error(`Failed to fetch scans: ${error.message}`);
  }

  return data ?? [];
};

const formatTopEntries = (entries: TasteProfileEntry[], limit = 5) =>
  entries.slice(0, limit).map((entry) => `${entry.value} (${entry.count}x)`).join(", ") ||
  "Inga tydliga preferenser ännu";

const buildPrompt = (profile: TasteProfile) => {
  const sections = [
    `Totalt antal skanningar: ${profile.totalScans}`,
    `Favoritdruvor: ${formatTopEntries(profile.topGrapes)}`,
    `Favoritregioner: ${formatTopEntries(profile.topRegions)}`,
    `Stilar: ${formatTopEntries(profile.topStyles, 3)}`,
    `Matparningar: ${formatTopEntries(profile.topPairings, 3)}`,
    `Sötma: ${profile.avgSweetness ?? "okänt"}`,
    `Fruktsyra: ${profile.avgAcidity ?? "okänt"}`,
    `Tannin: ${profile.avgTannin ?? "okänt"}`,
  ];

  if (profile.recentHighlights.length > 0) {
    sections.push(
      "Senaste viner:",
      ...profile.recentHighlights.map((line) => `- ${line}`),
    );
  }

  return `Du är en svensk sommelier som bygger personliga "För dig"-kort baserat på en användares vinsamling.

Analysera smakprofilen och skapa 5–8 varierade kort av typer som:
- "Tonight pick" (vad ska drickas ikväll)
- "With food" (matcha med mat)
- "Because you like..." (betyg baserat på användarens smak)
- "Try next..." (utforska nya regioner/druvor nära preferenser)
- "Cellar/lagring" (om relevant)

Data om användaren:
${sections.join("\n")}

Krav:
- Skriv på svenska och håll det kort.
- Blanda korttyper och gör varje titel engagerande.
- Använd specifika druvor/regioner/matparningar från profilen när det går.
- Lägg till 1–3 bullet points i items för extra kontext när relevant.
- Sätt id som "ai-card-<index>" för varje kort.

Returnera ENDAST giltig JSON enligt följande schema:
{
  "cards": [
    { "id": "ai-card-0", "type": "Tonight pick", "title": "Titel", "subtitle": "Kort text", "items": ["punkt"] }
  ],
  "generated_at": "ISO timestamp",
  "overall_confidence": 0.0-1.0,
  "notes": ["korta noteringar"]
}
Ingen markdown, inga förklaringar – endast JSON.`;
};

const parseAiJson = (raw: string): ForYouResponse | null => {
  const jsonMatch = raw.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
  const candidate = jsonMatch?.[1]?.trim() ?? raw.trim();

  try {
    return JSON.parse(candidate);
  } catch (error) {
    console.error("[for-you] Failed to parse AI JSON", error);
    return null;
  }
};

const sanitizeCards = (cards: unknown[]): ForYouCard[] =>
  cards
    .filter((card) => card && (typeof card.title === "string" || typeof card.subtitle === "string"))
    .map((card, index) => {
      const title = typeof card.title === "string" ? card.title.trim() : "Rekommendation";
      const type = typeof card.type === "string" ? card.type.trim() : "ai-suggestion";
      const subtitle = typeof card.subtitle === "string" ? card.subtitle.trim() : undefined;
      const items = Array.isArray(card.items)
        ? card.items
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
        : undefined;
      const cta =
        card.cta && typeof card.cta === "object" && !Array.isArray(card.cta)
          ? {
            label: typeof card.cta.label === "string" ? card.cta.label.trim() : undefined,
            href: typeof card.cta.href === "string" ? card.cta.href.trim() : undefined,
            action: typeof card.cta.action === "string" ? card.cta.action.trim() : undefined,
          }
          : undefined;

      return {
        id: typeof card.id === "string" && card.id.trim().length > 0 ? card.id.trim() : `ai-card-${index}`,
        type,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(items && items.length > 0 ? { items } : {}),
        ...(cta && (cta.label || cta.href || cta.action) ? { cta } : {}),
      };
    })
    .filter((card) => card.title.length > 0)
    .slice(0, 8);

const buildFallbackFromProfile = (profile: TasteProfile): ForYouResponse => {
  const cards: ForYouCard[] = [];
  let index = 0;

  const topGrape = profile.topGrapes[0]?.value;
  if (topGrape) {
    cards.push({
      id: `fallback-${index++}`,
      type: "Because you like",
      title: `${topGrape} att utforska`,
      subtitle: `Vi ser många ${topGrape}-viner i dina skanningar.`,
      items: [`Favoritdruva: ${topGrape}`],
    });
  }

  const topRegion = profile.topRegions[0]?.value;
  if (topRegion) {
    cards.push({
      id: `fallback-${index++}`,
      type: "Try next",
      title: `Fler viner från ${topRegion}`,
      subtitle: "Ett säkert kort som matchar din smak.",
      items: [`Favoritregion: ${topRegion}`],
    });
  }

  const topStyle = profile.topStyles[0]?.value;
  if (topStyle) {
    cards.push({
      id: `fallback-${index++}`,
      type: "Tonight pick",
      title: `${topStyle} i din stil`,
      subtitle: `${topStyle} dyker ofta upp i din historik.`,
      items: [`Stil: ${topStyle}`],
    });
  }

  const topPairing = profile.topPairings[0]?.value;
  if (topPairing) {
    cards.push({
      id: `fallback-${index++}`,
      type: "With food",
      title: `Matcha med ${topPairing}`,
      subtitle: "Serveringstips baserat på dina matparningar.",
      items: [`Matchning: ${topPairing}`],
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: `fallback-${index++}`,
      type: "onboarding",
      title: "Skanna fler viner",
      subtitle: "Vi behöver fler skanningar för att skapa träffsäkra tips.",
      items: ["Skanna minst 3 viner för personliga rekommendationer."],
    });
  }

  return {
    cards,
    generated_at: new Date().toISOString(),
    overall_confidence: 0.3,
    notes: ["Fallback-profilsvar utan AI"],
  };
};

const buildOnboardingCards = (): ForYouResponse => ({
  cards: [
    {
      id: "onboarding-0",
      type: "onboarding",
      title: "Skanna 3 viner för personliga förslag",
      subtitle: "Vi behöver några skanningar för att bygga din smakprofil.",
    },
    {
      id: "onboarding-1",
      type: "onboarding",
      title: "Tips: fota hela etiketten",
      subtitle: "Det hjälper AI:n att förstå stil, druvor och producent.",
    },
  ],
  generated_at: new Date().toISOString(),
  overall_confidence: 0,
  notes: ["Onboarding – för få skanningar"],
});

const parseScenarioMode = (mode: unknown): ScenarioMode | null => {
  if (typeof mode !== "string") return null;
  const normalized = mode.toLowerCase();
  if (normalized === "tonight" || normalized === "food" || normalized === "similar") {
    return normalized;
  }
  return null;
};

const SCENARIO_LABELS: Record<ScenarioMode, { label: string; summary: string }> = {
  tonight: {
    label: "Ikväll",
    summary: "Snabba tips för vad du kan öppna ikväll baserat på din smak.",
  },
  food: {
    label: "Till mat",
    summary: "Maträtt + vin-stil som matchar dina preferenser.",
  },
  similar: {
    label: "Liknar",
    summary: "Viner som liknar din senaste historik och favoritstilar.",
  },
};

const enforceRateLimits = async (userId: string, scenarioMode: ScenarioMode | null) => {
  if (scenarioMode) {
    const since = new Date(Date.now() - SCENARIO_WINDOW_MS);
    const count = await countEventsSince(userId, SCENARIO_EVENT_TYPE, since);
    if (count >= SCENARIO_DAILY_LIMIT) {
      return buildRateLimitResponse("scenario");
    }
    return null;
  }

  const since = new Date(Date.now() - FOR_YOU_WINDOW_MS);
  const count = await countEventsSince(userId, FOR_YOU_EVENT_TYPE, since);
  if (count >= 1) {
    return buildRateLimitResponse("for-you");
  }
  return null;
};

const buildScenarioPrompt = (mode: ScenarioMode, profile: TasteProfile) => {
  const base = [
    `Scenario: ${SCENARIO_LABELS[mode].label} — ${SCENARIO_LABELS[mode].summary}`,
    `Totalt antal skanningar: ${profile.totalScans}`,
    `Favoritdruvor: ${formatTopEntries(profile.topGrapes, 4)}`,
    `Favoritregioner: ${formatTopEntries(profile.topRegions, 4)}`,
    `Stilar: ${formatTopEntries(profile.topStyles, 3)}`,
    `Matparningar: ${formatTopEntries(profile.topPairings, 3)}`,
  ];

  if (profile.recentHighlights.length > 0) {
    base.push(
      "Senaste viner:",
      ...profile.recentHighlights.map((line) => `- ${line}`),
    );
  }

  const scenarioHints: Record<ScenarioMode, string> = {
    tonight:
      "Fokus: 3–5 konkreta flasktyper att öppna ikväll. Prioritera favoritdruvor/regioner och lägg till serveringshintar (temp, karaff, lagring).",
    food:
      "Fokus: 3–5 kombinationer av vin + maträtt. Använd topp-parningar och förslag på kök (italiensk pasta, grill, ostbrickor).",
    similar:
      "Fokus: 3–5 viner som liknar användarens senaste skanningar. Lyft fram varför de matchar (druva, stil, region).",
  };

  return `Du är en svensk sommelier som svarar på snabba "För dig"-scenarier.

Bygg kort för scenariot "${SCENARIO_LABELS[mode].label}". ${scenarioHints[mode]}

Krav:
- Svara på svenska och håll varje kort kortfattat.
- Ge 3–5 kort. Lägg en engagerande titel och en kort förklaring i subtitle.
- items (1–3) ska ge konkreta tips (servering, mat, liknande viner).
- Sätt id som "scenario-${mode}-<index>" och type till "${SCENARIO_LABELS[mode].label}".

Data:
${base.join("\n")}

Returnera ENDAST JSON:
{
  "cards": [
    { "id": "scenario-${mode}-0", "type": "${SCENARIO_LABELS[mode].label}", "title": "Titel", "subtitle": "Kort text", "items": ["punkt"] }
  ],
  "generated_at": "ISO timestamp",
  "overall_confidence": 0.0-1.0,
  "notes": ["korta noteringar"]
}`;
};

const buildScenarioFallback = (mode: ScenarioMode, profile: TasteProfile): ForYouResponse => {
  const cards: ForYouCard[] = [];
  let index = 0;

  const addCard = (title: string, subtitle?: string, items?: string[]) => {
    cards.push({
      id: `scenario-${mode}-${index++}`,
      type: SCENARIO_LABELS[mode].label,
      title,
      ...(subtitle ? { subtitle } : {}),
      ...(items && items.length > 0 ? { items } : {}),
    });
  };

  if (mode === "tonight") {
    const style = profile.topStyles[0]?.value;
    const region = profile.topRegions[0]?.value;
    if (style || region) {
      addCard(
        `${style ?? "Stil"} från ${region ?? "din favoritregion"}`,
        "Öppna nu: lufta lätt och servera runt 15–17°C.",
        [style ? `Din stil: ${style}` : undefined, region ? `Region du gillar: ${region}` : undefined].filter(
          Boolean,
        ) as string[],
      );
    }
    if (profile.topGrapes[0]) {
      addCard(
        `${profile.topGrapes[0].value} ikväll`,
        "Säkert kort från din historik.",
        ["Välj en flaska med balans i syra och frukt", "Funkar fint som solo-sip"],
      );
    }
  } else if (mode === "food") {
    const pairing = profile.topPairings[0]?.value;
    const grape = profile.topGrapes[0]?.value;
    if (pairing) {
      addCard(`Till ${pairing}`, "Smakmatchning från dina tidigare parningar.", [
        `Servera med ${pairing.toLowerCase()}`,
        "Håll syran i balans för maten",
      ]);
    }
    if (grape) {
      addCard(
        `${grape} till middagen`,
        "Matvänligt val från din smakprofil.",
        ["Lägg till örter eller sälta", "Välj en producent du känner igen"],
      );
    }
  } else if (mode === "similar") {
    const highlight = profile.recentHighlights[0] ?? profile.topRegions[0]?.value ?? profile.topGrapes[0]?.value;
    if (highlight) {
      addCard(`Liknar ${highlight}`, "Baserat på dina senaste skanningar.", [
        "Hitta samma druva eller region",
        "Kolla efter liknande årgångar",
      ]);
    }
    if (profile.topStyles[0]) {
      addCard(
        `Mer av ${profile.topStyles[0].value}`,
        "Håller sig nära din stilpreferens.",
        ["Testa en annan producent", "Jämför prisnivåer"],
      );
    }
  }

  if (cards.length === 0) {
    addCard("Skanna några viner först", "Vi behöver fler datapunkter för att träffa rätt.", [
      "Skanna minst 3 viner",
      "Dina tips blir mer träffsäkra direkt efter en skanning",
    ]);
  }

  return {
    cards: cards.slice(0, 5),
    generated_at: new Date().toISOString(),
    overall_confidence: 0.35,
    notes: [`Fallbackscenario ${mode}`],
  };
};

const generateAiCards = async (profile: TasteProfile): Promise<ForYouResponse | null> => {
  if (!GOOGLE_API_KEY) {
    console.error("[for-you] Missing GOOGLE_API_KEY");
    return null;
  }

  const prompt = buildPrompt(profile);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[for-you] Gemini API error:", response.status, errorText);
    return null;
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!content) {
    console.error("[for-you] Gemini returned empty content", data);
    return null;
  }

  const parsed = parseAiJson(content);
  if (!parsed || !Array.isArray(parsed.cards)) {
    console.error("[for-you] Parsed AI response missing cards");
    return null;
  }

  const cards = sanitizeCards(parsed.cards);
  if (cards.length === 0) {
    console.error("[for-you] AI returned no usable cards");
    return null;
  }

  const confidence =
    typeof parsed.overall_confidence === "number" && Number.isFinite(parsed.overall_confidence)
      ? Math.max(0, Math.min(1, parsed.overall_confidence))
      : 0.6;

  return {
    cards,
    generated_at:
      typeof parsed.generated_at === "string" && parsed.generated_at.trim().length > 0
        ? parsed.generated_at
        : new Date().toISOString(),
    overall_confidence: confidence,
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((note: unknown) => typeof note === "string")
      : [],
  };
};

const generateScenarioCards = async (mode: ScenarioMode, profile: TasteProfile): Promise<ForYouResponse | null> => {
  if (!GOOGLE_API_KEY) {
    console.error("[for-you] Missing GOOGLE_API_KEY");
    return null;
  }

  const prompt = buildScenarioPrompt(mode, profile);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 900,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[for-you] Gemini API (scenario) error:", response.status, errorText);
    return null;
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!content) {
    console.error("[for-you] Gemini returned empty content for scenario", data);
    return null;
  }

  const parsed = parseAiJson(content);
  if (!parsed || !Array.isArray(parsed.cards)) {
    console.error("[for-you] Parsed AI scenario response missing cards");
    return null;
  }

  const cards = sanitizeCards(parsed.cards).map((card, index) => ({
    ...card,
    id: card.id || `scenario-${mode}-${index}`,
    type: SCENARIO_LABELS[mode].label,
  }));

  if (cards.length === 0) {
    console.error("[for-you] AI scenario returned no usable cards");
    return null;
  }

  const confidence =
    typeof parsed.overall_confidence === "number" && Number.isFinite(parsed.overall_confidence)
      ? Math.max(0, Math.min(1, parsed.overall_confidence))
      : 0.6;

  return {
    cards: cards.slice(0, 5),
    generated_at:
      typeof parsed.generated_at === "string" && parsed.generated_at.trim().length > 0
        ? parsed.generated_at
        : new Date().toISOString(),
    overall_confidence: confidence,
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((note: unknown) => typeof note === "string")
      : [],
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const urlMode = parseScenarioMode(url.searchParams.get("mode"));
    let body: Record<string, unknown> | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }

    const bodyMode = parseScenarioMode(body?.mode);
    const scenarioMode = bodyMode ?? urlMode;

    const user = await getUserFromRequest(req);
    if (!user) {
      return respondJson({ error: "auth_required" }, 401);
    }

    const rateLimitResponse = await enforceRateLimits(user.id, scenarioMode);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const scans = await fetchRecentScans(user.id, 50);
    if (!Array.isArray(scans) || scans.length < 3) {
      const onboarding = buildOnboardingCards();
      await safelyRecordEvent(user.id, scenarioMode ? SCENARIO_EVENT_TYPE : FOR_YOU_EVENT_TYPE, {
        reason: "onboarding",
        scenario: scenarioMode,
      });
      return respondJson(onboarding);
    }

    const tasteProfile = buildTasteProfile(scans);

    if (scenarioMode) {
      const scenarioResponse = await generateScenarioCards(scenarioMode, tasteProfile);
      if (scenarioResponse) {
        await safelyRecordEvent(user.id, SCENARIO_EVENT_TYPE, {
          scenario: scenarioMode,
          source: "ai",
          total_scans: tasteProfile.totalScans,
        });
        return respondJson(scenarioResponse);
      }

      const fallbackScenario = buildScenarioFallback(scenarioMode, tasteProfile);
      await safelyRecordEvent(user.id, SCENARIO_EVENT_TYPE, {
        scenario: scenarioMode,
        source: "fallback",
        total_scans: tasteProfile.totalScans,
      });
      return respondJson(fallbackScenario);
    }

    const aiResponse = await generateAiCards(tasteProfile);
    if (aiResponse) {
      await safelyRecordEvent(user.id, FOR_YOU_EVENT_TYPE, {
        source: "ai",
        total_scans: tasteProfile.totalScans,
      });
      return respondJson(aiResponse);
    }

    // Fallback without crashing the endpoint
    const fallbackResponse = buildFallbackFromProfile(tasteProfile);
    await safelyRecordEvent(user.id, FOR_YOU_EVENT_TYPE, {
      source: "fallback",
      total_scans: tasteProfile.totalScans,
    });
    return respondJson(fallbackResponse);
  } catch (error) {
    console.error("[for-you] Unexpected error", error);
    return respondJson({ error: "server_error", message: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
