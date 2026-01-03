import { safeParseForYou } from "@/lib/safeParseForYou";
import { supabase } from "@/lib/supabaseClient";
import { type ForYouRecommendationCard } from "@/schemas/forYouRecommendationsSchema";
import { getTasteProfileForUser, type TasteProfile } from "@/services/tasteProfileService";

export type ForYouCard = ForYouRecommendationCard;

const hasTasteProfileData = (tasteProfile: TasteProfile): boolean =>
  tasteProfile.topGrapes.length > 0 ||
  tasteProfile.topRegions.length > 0 ||
  tasteProfile.topStyles.length > 0 ||
  tasteProfile.topPairings.length > 0 ||
  [tasteProfile.avgSweetness, tasteProfile.avgAcidity, tasteProfile.avgTannin].some(
    (value) => typeof value === "number",
  );

const fetchAISuggestions = async (tasteProfile: TasteProfile): Promise<ForYouCard[]> => {
  try {
    const { data, error } = await supabase.functions.invoke("wine-suggestions", {
      body: { tasteProfile },
    });

    if (error) {
      console.error("Failed to fetch AI suggestions:", error);
      return [];
    }

    const parsed = safeParseForYou(data);
    return parsed.data.cards;
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
      title: `${topGrape} att utforska`,
      subtitle: `Baserat på dina senaste skanningar av ${topGrape}.`,
      items: [`Favoritdruva: ${topGrape}`],
    });
  }

  const topRegion = tasteProfile.topRegions[0]?.value;
  if (topRegion) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      title: `Fler viner från ${topRegion}`,
      subtitle: `Du återkommer ofta till flaskor från ${topRegion}.`,
      items: [`Favoritregion: ${topRegion}`],
    });
  }

  const topStyle = tasteProfile.topStyles[0]?.value;
  if (topStyle) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      title: `${topStyle} i din stil`,
      subtitle: `${topStyle} syns ofta i dina analyser.`,
      items: [`Stil: ${topStyle}`],
    });
  }

  const topPairing = tasteProfile.topPairings[0]?.value;
  if (topPairing) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      title: `Matcha med ${topPairing}`,
      subtitle: `Dina sparade matchningar visar ${topPairing}.`,
      items: [`Matchning: ${topPairing}`],
    });
  }

  if (suggestions.length === 0 && hasTasteProfileData(tasteProfile)) {
    suggestions.push({
      id: `fallback-${index++}`,
      type: "ai-suggestion",
      title: "Utforska fler rekommendationer",
      subtitle: "Vi använder dina senaste analyser för att hitta liknande flaskor.",
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
