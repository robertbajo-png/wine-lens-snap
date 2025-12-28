import { describe, expect, it, beforeEach, vi } from "vitest";
import { getForYouCards } from "../forYouService";
import { getTasteProfileForUser, type TasteProfile } from "../tasteProfileService";

vi.mock("../tasteProfileService", () => ({
  getTasteProfileForUser: vi.fn(),
}));

const mockGetTasteProfileForUser = vi.mocked(getTasteProfileForUser);

const createProfile = (overrides: Partial<TasteProfile>): TasteProfile => ({
  grapes: [],
  regions: [],
  styles: [],
  totalScans: 0,
  ...overrides,
});

describe("getForYouCards", () => {
  beforeEach(() => {
    mockGetTasteProfileForUser.mockReset();
  });

  it("returns Sangiovese based recommendations when Sangiovese is top grape", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        grapes: [{ value: "Sangiovese", count: 4 }],
      }),
    );

    const cards = await getForYouCards("user-1");

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      basis: "grape",
      matchValue: "Sangiovese",
      suggestions: ["Chianti Classico", "Brunello di Montalcino"],
    });
  });

  it("returns Rioja suggestion when top region is Bordeaux", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        regions: [{ value: "Bordeaux", count: 2 }],
      }),
    );

    const cards = await getForYouCards("user-2");

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      basis: "region",
      matchValue: "Bordeaux",
      suggestions: ["Rioja Reserva"],
    });
  });

  it("returns empty array when userId is missing", async () => {
    const cards = await getForYouCards("");
    expect(cards).toEqual([]);
    expect(mockGetTasteProfileForUser).not.toHaveBeenCalled();
  });

  it("returns empty array when no rule matches", async () => {
    mockGetTasteProfileForUser.mockResolvedValue(
      createProfile({
        grapes: [{ value: "Merlot", count: 3 }],
        regions: [{ value: "California", count: 1 }],
      }),
    );

    const cards = await getForYouCards("user-3");

    expect(cards).toEqual([]);
  });
});
