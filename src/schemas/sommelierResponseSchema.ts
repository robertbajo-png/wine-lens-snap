import { z } from "zod";

const normalizeText = z.string().transform((value) => value.trim());

export const sommelierRecommendationSchema = z.object({
  title: normalizeText.min(1),
  why: normalizeText.min(1),
  scan_id: z.string().optional(),
  from_collection: z.boolean().optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
}).passthrough();

export const sommelierResponseSchema = z.object({
  recommendations: z.array(sommelierRecommendationSchema).default([]),
  overall_confidence: z.coerce.number().min(0).max(1).optional().nullable(),
  notes: z.array(normalizeText).default([]),
  next_actions: z.array(normalizeText).default([]),
}).passthrough();

export type SommelierRecommendation = z.infer<typeof sommelierRecommendationSchema>;
export type SommelierResponse = z.infer<typeof sommelierResponseSchema>;
