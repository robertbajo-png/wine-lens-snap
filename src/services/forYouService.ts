import type { TasteProfile } from "@/services/tasteProfileService";
import { getTasteProfileForUser } from "@/services/tasteProfileService";
import { supabase } from "@/lib/supabaseClient";

export type ForYouCard = {
  id: string;
  type: "ai-suggestion";
  name: string;
  reason: string;
  region?: string;
  grape?: string;
};

export type AISuggestionResponse = {
  suggestions: Array<{
    name: string;
    reason: string;
    region?: string;
    grape?: string;
  }>;
  error?: string;
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

    if (!data?.suggestions || !Array.isArray(data.suggestions)) {
      return [];
    }

    return data.suggestions.map((suggestion, index) => ({
      id: `ai-suggestion-${index}`,
      type: "ai-suggestion" as const,
      name: suggestion.name,
      reason: suggestion.reason,
      region: suggestion.region,
      grape: suggestion.grape,
    }));
  } catch (error) {
    console.error("AI suggestions fetch failed:", error);
    return [];
  }
};

const hasTasteProfileData = (tasteProfile: TasteProfile): boolean =>
  tasteProfile.topGrapes.length > 0 ||
  tasteProfile.topRegions.length > 0 ||
  tasteProfile.topStyles.length > 0 ||
  tasteProfile.topPairings.length > 0 ||
  [tasteProfile.avgSweetness, tasteProfile.avgAcidity, tasteProfile.avgTannin].some(
    (value) => typeof value === "number",
  );

export const getForYouCards = async (userId: string): Promise<ForYouCard[]> => {
  if (!userId) return [];

  try {
    const tasteProfile = await getTasteProfileForUser(userId, 80);

    if (!hasTasteProfileData(tasteProfile)) {
      return [];
    }

    return await fetchAISuggestions(tasteProfile);
  } catch (error) {
    console.error("Failed to build ForYou cards", error);
    return [];
  }
};
