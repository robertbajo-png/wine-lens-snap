import { safeParseForYou } from "@/lib/safeParseForYou";
import { supabase } from "@/lib/supabaseClient";
import { type ForYouRecommendationCard } from "@/schemas/forYouRecommendationsSchema";
import { getTasteProfileForUser, type TasteProfile } from "@/services/tasteProfileService";

export type ForYouCard = ForYouRecommendationCard;

const CACHE_PREFIX = "for_you_cards_v1";
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface CachedForYouCards {
  userId: string;
  updatedAt: string;
  cards: ForYouCard[];
}

const getCacheKey = (userId: string) => `${CACHE_PREFIX}_${userId}`;

export const getCachedForYouCards = (userId: string): CachedForYouCards | null => {
  if (typeof window === "undefined" || !userId) return null;

  try {
    const raw = window.localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedForYouCards;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.cards) || !parsed.updatedAt) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to read cached For You cards", error);
    return null;
  }
};

const saveCachedForYouCards = (userId: string, cards: ForYouCard[]): string | null => {
  if (typeof window === "undefined" || !userId) return null;

  const updatedAt = new Date().toISOString();
  try {
    const payload: CachedForYouCards = {
      userId,
      updatedAt,
      cards,
    };

    window.localStorage.setItem(getCacheKey(userId), JSON.stringify(payload));
    return updatedAt;
  } catch (error) {
    console.error("Failed to store cached For You cards", error);
    return null;
  }
};

export const isForYouCacheStale = (cache: CachedForYouCards | null): boolean => {
  if (!cache?.updatedAt) return true;

  const parsed = new Date(cache.updatedAt);
  if (Number.isNaN(parsed.getTime())) return true;

  return Date.now() - parsed.getTime() > ONE_DAY_IN_MS;
};

const hasTasteProfileData = (tasteProfile: TasteProfile): boolean =>
  tasteProfile.topGrapes.length > 0 ||
  tasteProfile.topRegions.length > 0 ||
  tasteProfile.topStyles.length > 0 ||
  tasteProfile.topPairings.length > 0 ||
  [tasteProfile.avgSweetness, tasteProfile.avgAcidity, tasteProfile.avgTannin].some(
    (value) => typeof value === "number",
  );

const fetchServerCards = async (): Promise<ForYouCard[]> => {
  try {
    const { data, error } = await supabase.functions.invoke("for-you");

    if (error) {
      console.error("Failed to fetch For You cards:", error);
      return [];
    }

    const parsed = safeParseForYou(data);
    return parsed.data.cards;
  } catch (error) {
    console.error("For You fetch failed:", error);
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
    const serverCards = await fetchServerCards();
    if (serverCards.length > 0) {
      return serverCards;
    }

    const tasteProfile = await getTasteProfileForUser(userId, 80);
    if (!hasTasteProfileData(tasteProfile)) {
      return [];
    }

    return buildFallbackSuggestions(tasteProfile);
  } catch (error) {
    console.error("Failed to build ForYou AI cards", error);
    return [];
  }
};

export const getForYouCards = async (
  userId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<{ cards: ForYouCard[]; updatedAt: string | null; source: "cache" | "network" }> => {
  if (!userId) {
    return { cards: [], updatedAt: null, source: "cache" };
  }

  const cached = getCachedForYouCards(userId);
  const shouldUseCache = cached && !options.forceRefresh && !isForYouCacheStale(cached);

  if (shouldUseCache) {
    return { cards: cached.cards, updatedAt: cached.updatedAt, source: "cache" };
  }

  const freshCards = await getForYouRecommendations(userId);

  if (freshCards.length > 0 || !cached) {
    const updatedAt = saveCachedForYouCards(userId, freshCards) ?? cached?.updatedAt ?? null;
    return { cards: freshCards, updatedAt, source: "network" };
  }

  return { cards: cached.cards, updatedAt: cached.updatedAt, source: "cache" };
};
