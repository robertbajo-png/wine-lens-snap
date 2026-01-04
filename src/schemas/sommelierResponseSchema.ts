import { z } from "zod";

const trimmedString = (minLength = 0) =>
  z.string().min(minLength).transform((value) => value.trim());

export const sommelierRecommendationSchema = z.object({
  title: trimmedString(1),
  why: trimmedString(1),
  scan_id: z.string().optional(),
  from_collection: z.boolean().optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
}).passthrough();

export const sommelierResponseSchema = z.object({
  recommendations: z.array(sommelierRecommendationSchema).default([]),
  overall_confidence: z.coerce.number().min(0).max(1).optional().nullable(),
  notes: z.array(trimmedString()).default([]),
  next_actions: z.array(trimmedString()).default([]),
}).passthrough();

export type SommelierRecommendation = z.infer<typeof sommelierRecommendationSchema>;
export type SommelierResponse = z.infer<typeof sommelierResponseSchema>;
