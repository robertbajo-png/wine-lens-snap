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
        cards: [
          {
            id: "ai-card-0",
            type: "ai-suggestion",
            title: "Chianti Classico",
            subtitle: "Top grape match",
            items: ["Toscana", "Sangiovese"],
          },
        ],
        generated_at: "2024-01-01T00:00:00.000Z",
        overall_confidence: 0.82,
        notes: ["note"],
      },
      error: null,
    });

    const cards = await getForYouRecommendations("user-1");

    expect(cards).toEqual([
      {
        id: "ai-card-0",
        type: "ai-suggestion",
        title: "Chianti Classico",
        subtitle: "Top grape match",
        items: ["Toscana", "Sangiovese"],
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
        title: "Fler viner från Bordeaux",
        subtitle: "Du återkommer ofta till flaskor från Bordeaux.",
        items: ["Favoritregion: Bordeaux"],
      },
    ]);
  });

  it("falls back when AI response is invalid", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        topStyles: [{ value: "Syrah", count: 3 }],
      }),
    );

    supabaseMock.invoke.mockResolvedValue({
      data: { message: "not following schema" },
      error: null,
    });

    const cards = await getForYouRecommendations("user-5");

    expect(cards).toEqual([
      {
        id: "fallback-0",
        type: "ai-suggestion",
        title: "Syrah i din stil",
        subtitle: "Syrah syns ofta i dina analyser.",
        items: ["Stil: Syrah"],
      },
    ]);
  });
});
