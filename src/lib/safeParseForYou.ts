import { forYouRecommendationsSchema, type ForYouRecommendations } from "@/schemas/forYouRecommendationsSchema";

const buildFallbackRecommendations = (): ForYouRecommendations => ({
  cards: [],
  generated_at: new Date().toISOString(),
  overall_confidence: 0,
  notes: [],
});

type ParseResult = {
  data: ForYouRecommendations;
  isValid: boolean;
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[for-you] Failed to parse JSON response", error);
    return null;
  }
};

export const safeParseForYou = (payload: unknown): ParseResult => {
  const candidate = typeof payload === "string" ? safeJsonParse(payload) : payload;
  const parsed = forYouRecommendationsSchema.safeParse(candidate);

  if (parsed.success) {
    return { data: parsed.data, isValid: true };
  }

  console.warn("[for-you] Invalid response", parsed.error.issues);
  return { data: buildFallbackRecommendations(), isValid: false };
};
