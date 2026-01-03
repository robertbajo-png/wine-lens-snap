import { supabase } from "@/lib/supabaseClient";
import { getTasteProfileForUser, type TasteProfile } from "@/services/tasteProfileService";

export type ForYouCard = {
  id: string;
  type: "ai-suggestion";
  name: string;
  reason: string;
  region?: string;
  grape?: string;
};

type AISuggestionResponse = {
  suggestions?: Array<{
    name: string;
    reason: string;
    region?: string;
    grape?: string;
  }>;
  error?: string;
};

const hasTasteProfileData = (tasteProfile: TasteProfile): boolean =>
  tasteProfile.topGrapes.length > 0 ||
  tasteProfile.topRegions.length > 0 ||
  tasteProfile.topStyles.length > 0 ||
  tasteProfile.topPairings.length > 0 ||
  [tasteProfile.avgSweetness, tasteProfile.avgAcidity, tasteProfile.avgTannin].some(
    (value) => typeof value === "number",
  );

const mapAISuggestionsToCards = (suggestions: AISuggestionResponse["suggestions"]): ForYouCard[] => {
  if (!suggestions || !Array.isArray(suggestions)) return [];

  return suggestions
    .filter((suggestion) => suggestion?.name && suggestion?.reason)
    .map((suggestion, index) => ({
      id: `ai-suggestion-${index}`,
      type: "ai-suggestion" as const,
      name: suggestion.name,
      reason: suggestion.reason,
      region: suggestion.region,
      grape: suggestion.grape,
    }));
};

const fetchAISuggestions = async (tasteProfile: TasteProfile): Promise<ForYouCard[]> => {
  try {
    const { data, error } = await supabase.functions.invoke<AISuggestionResponse>("wine-suggestions", {
      body: { tasteProfile },
    });

    if (error) {
      console.error("Failed to fetch AI suggestions:", error);
      return [];
    }

    if (data?.error) {
      console.warn("AI suggestion service error:", data.error);
      return [];
    }

    return mapAISuggestionsToCards(data?.suggestions);
  } catch (error) {
    console.error("AI suggestions fetch failed:", error);
    return [];
  }
};

const buildFallbackSuggestions = (tasteProfile: TasteProfile): ForYouCard[] => {
  const suggestions: ForYouCard[] = [];
  let index = 0;

  const topGrape = tasteProfile.topGrapes[0]?.value;
  if (topGrape) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      name: `${topGrape} att utforska`,
      reason: `Baserat på dina senaste skanningar av ${topGrape}.`,
      grape: topGrape,
    });
  }

  const topRegion = tasteProfile.topRegions[0]?.value;
  if (topRegion) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      name: `Fler viner från ${topRegion}`,
      reason: `Du återkommer ofta till flaskor från ${topRegion}.`,
      region: topRegion,
    });
  }

  const topStyle = tasteProfile.topStyles[0]?.value;
  if (topStyle) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      name: `${topStyle} i din stil`,
      reason: `${topStyle} syns ofta i dina analyser.`,
    });
  }

  const topPairing = tasteProfile.topPairings[0]?.value;
  if (topPairing) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      name: `Matcha med ${topPairing}`,
      reason: `Dina sparade matchningar visar ${topPairing}.`,
    });
  }

  if (suggestions.length === 0 && hasTasteProfileData(tasteProfile)) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      name: "Utforska fler rekommendationer",
      reason: "Vi använder dina senaste analyser för att hitta liknande flaskor.",
    });
  }

  return suggestions.slice(0, 4);
};

export const getForYouRecommendations = async (userId: string): Promise<ForYouCard[]> => {
  if (!userId) return [];

  try {
    const tasteProfile = await getTasteProfileForUser(userId, 80);

    if (!hasTasteProfileData(tasteProfile)) {
      return [];
    }

    const aiCards = await fetchAISuggestions(tasteProfile);
    if (aiCards.length > 0) {
      return aiCards;
    }

    return buildFallbackSuggestions(tasteProfile);
  } catch (error) {
    console.error("Failed to build ForYou AI cards", error);
    return [];
  }
};
