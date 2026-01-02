import { sommelierResponseSchema, type SommelierResponse } from "@/schemas/sommelierResponseSchema";

const FALLBACK_MESSAGE = "Prova igen";

const fallbackResponse: SommelierResponse = {
  recommendations: [],
  overall_confidence: null,
  notes: [FALLBACK_MESSAGE],
  next_actions: [],
};

type ParseResult = {
  data: SommelierResponse;
  isValid: boolean;
};

export const parseSommelierResponse = (payload: unknown): ParseResult => {
  const candidate = typeof payload === "string" ? safeJsonParse(payload) : payload;
  const parsed = sommelierResponseSchema.safeParse(candidate);

  if (parsed.success) {
    return { data: parsed.data, isValid: true };
  }

  console.warn("[sommelier] Invalid response", parsed.error.issues);
  return { data: fallbackResponse, isValid: false };
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[sommelier] Failed to parse JSON response", error);
    return null;
  }
};

export { FALLBACK_MESSAGE };
