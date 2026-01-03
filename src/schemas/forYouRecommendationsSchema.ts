import { z } from "zod";

const normalizedText = z.string().trim();

export const forYouRecommendationCardSchema = z.object({
  id: normalizedText.min(1),
  type: normalizedText.min(1),
  title: normalizedText.min(1),
  subtitle: normalizedText.optional(),
  items: z.array(normalizedText).optional(),
  cta: z.object({
    label: normalizedText.min(1),
    href: normalizedText.url().optional(),
    action: normalizedText.optional(),
  }).partial().optional(),
}).passthrough();

export const forYouRecommendationsSchema = z.object({
  cards: z.array(forYouRecommendationCardSchema).default([]),
  generated_at: normalizedText,
  overall_confidence: z.coerce.number().min(0).max(1),
  notes: z.array(normalizedText).default([]),
}).passthrough();

export type ForYouRecommendationCard = z.infer<typeof forYouRecommendationCardSchema>;
export type ForYouRecommendations = z.infer<typeof forYouRecommendationsSchema>;
