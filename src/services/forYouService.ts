import type { TasteProfile } from "@/services/tasteProfileService";
import { getTasteProfileForUser } from "@/services/tasteProfileService";

export type ForYouCardType = "sangiovese-classics" | "bordeaux-rioja";

export type ForYouCard = {
  id: string;
  type: ForYouCardType;
  basis: "grape" | "region";
  matchValue: string;
  suggestions: string[];
};

type RecommendationRule = {
  type: ForYouCardType;
  basis: ForYouCard["basis"];
  match: (profile: TasteProfile) => string | null;
  suggestions: string[];
};

const normalizeValue = (value?: string | null): string => value?.trim().toLowerCase() ?? "";

const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    type: "sangiovese-classics",
    basis: "grape",
    match: (profile) => {
      const topGrape = profile.grapes[0]?.value ?? "";
      return normalizeValue(topGrape) === "sangiovese" ? topGrape : null;
    },
    suggestions: ["Chianti Classico", "Brunello di Montalcino"],
  },
  {
    type: "bordeaux-rioja",
    basis: "region",
    match: (profile) => {
      const topRegion = profile.regions[0]?.value ?? "";
      return normalizeValue(topRegion).includes("bordeaux") ? topRegion : null;
    },
    suggestions: ["Rioja Reserva"],
  },
];

export const getForYouCards = async (userId: string): Promise<ForYouCard[]> => {
  if (!userId) return [];

  try {
    const tasteProfile = await getTasteProfileForUser(userId, 80);

    return RECOMMENDATION_RULES.reduce<ForYouCard[]>((cards, rule) => {
      const matchValue = rule.match(tasteProfile);
      if (!matchValue) return cards;

      return cards.concat({
        id: `for-you-${rule.type}`,
        type: rule.type,
        basis: rule.basis,
        matchValue,
        suggestions: rule.suggestions,
      });
    }, []);
  } catch (error) {
    console.error("Failed to build ForYou cards", error);
    return [];
  }
};
