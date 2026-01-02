import { describe, expect, it, beforeEach, vi } from "vitest";
import { getForYouCards } from "../forYouService";
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

describe("getForYouCards", () => {
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

    const cards = await getForYouCards("user-1");

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
    const cards = await getForYouCards("");

    expect(cards).toEqual([]);
    expect(mockGetTasteProfileForUser).not.toHaveBeenCalled();
    expect(supabaseMock.invoke).not.toHaveBeenCalled();
  });

  it("returns empty array when taste profile is empty", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(createProfile({}));

    const cards = await getForYouCards("user-3");

    expect(cards).toEqual([]);
    expect(supabaseMock.invoke).not.toHaveBeenCalled();
  });

  it("returns empty array when AI suggestions fail", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        topRegions: [{ value: "Bordeaux", count: 2 }],
      }),
    );

    supabaseMock.invoke.mockResolvedValue({ data: null, error: new Error("oops") });

    const cards = await getForYouCards("user-4");

    expect(cards).toEqual([]);
  });
});
