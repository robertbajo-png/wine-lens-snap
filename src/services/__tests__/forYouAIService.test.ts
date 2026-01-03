import { describe, expect, it, beforeEach, vi } from "vitest";
import { getForYouRecommendations } from "../forYouAIService";
import { getTasteProfileForUser, type TasteProfile } from "../tasteProfileService";

const supabaseMock = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: supabaseMock.invoke,
    },
  },
}));

vi.mock("../tasteProfileService", () => ({
  getTasteProfileForUser: vi.fn(),
}));

const mockGetTasteProfileForUser = vi.mocked(getTasteProfileForUser);

const createProfile = (overrides: Partial<TasteProfile>): TasteProfile => ({
  topGrapes: [],
  topRegions: [],
  topStyles: [],
  topPairings: [],
  avgSweetness: null,
  avgAcidity: null,
  avgTannin: null,
  ...overrides,
});

describe("getForYouRecommendations", () => {
  beforeEach(() => {
    mockGetTasteProfileForUser.mockReset();
    supabaseMock.invoke.mockReset();
  });

  it("returns AI suggestions when taste profile has data", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        topGrapes: [{ value: "Sangiovese", count: 4 }],
      }),
    );

    supabaseMock.invoke.mockResolvedValue({
      data: {
        suggestions: [
          { name: "Chianti Classico", reason: "Top grape match", region: "Toscana", grape: "Sangiovese" },
        ],
      },
      error: null,
    });

    const cards = await getForYouRecommendations("user-1");

    expect(cards).toEqual([
      {
        id: "ai-suggestion-0",
        type: "ai-suggestion",
        name: "Chianti Classico",
        reason: "Top grape match",
        region: "Toscana",
        grape: "Sangiovese",
      },
    ]);
    expect(supabaseMock.invoke).toHaveBeenCalledWith("wine-suggestions", {
      body: {
        tasteProfile: expect.objectContaining({
          topGrapes: [{ value: "Sangiovese", count: 4 }],
        }),
      },
    });
  });

  it("returns empty array when userId is missing", async () => {
    const cards = await getForYouRecommendations("");

    expect(cards).toEqual([]);
    expect(mockGetTasteProfileForUser).not.toHaveBeenCalled();
    expect(supabaseMock.invoke).not.toHaveBeenCalled();
  });

  it("returns empty array when taste profile is empty", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(createProfile({}));

    const cards = await getForYouRecommendations("user-3");

    expect(cards).toEqual([]);
    expect(supabaseMock.invoke).not.toHaveBeenCalled();
  });

  it("returns fallback suggestions when AI suggestions fail", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        topRegions: [{ value: "Bordeaux", count: 2 }],
      }),
    );

    supabaseMock.invoke.mockResolvedValue({ data: null, error: new Error("oops") });

    const cards = await getForYouRecommendations("user-4");

    expect(cards).toEqual([
      {
        id: "fallback-0",
        type: "ai-suggestion",
        name: "Fler viner från Bordeaux",
        reason: "Du återkommer ofta till flaskor från Bordeaux.",
        region: "Bordeaux",
      },
    ]);
  });
});
