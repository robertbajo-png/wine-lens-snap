import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTasteProfile, getTasteProfileForUser, type WineScan } from "../tasteProfileService";
import type { WineAnalysisResult } from "@/lib/wineCache";

const supabaseMocks = vi.hoisted(() => {
  const limitMock = vi.fn();
  const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
  const eqMock = vi.fn().mockReturnValue({ order: orderMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  const fromMock = vi.fn().mockReturnValue({ select: selectMock });
  return { fromMock, selectMock, eqMock, orderMock, limitMock };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: supabaseMocks.fromMock,
  },
}));

const makeScan = (id: string, analysis: Partial<WineAnalysisResult> | null): WineScan => ({
  id,
  created_at: "2024-01-01T00:00:00Z",
  analysis_json: analysis,
  image_thumb: null,
  label_hash: null,
  raw_ocr: null,
  user_id: "user-1",
  vintage: null,
});

describe("buildTasteProfile", () => {
  it("räknar vanligaste druvor, regioner och stilar", () => {
    const scans: WineScan[] = [
      makeScan("1", {
        grapes: ["Merlot", "Cabernet Sauvignon"],
        land_region: "Frankrike, Bordeaux",
        style: "Rött",
      }),
      makeScan("2", {
        grapes: ["Merlot"],
        land_region: "Bordeaux",
        style: "Rött",
      }),
      makeScan("3", {
        grapes: ["Chardonnay"],
        land_region: "USA / California",
        style: "Vitt",
      }),
    ];

    const profile = buildTasteProfile(scans);

    expect(profile.topGrapes).toEqual([
      { value: "Merlot", count: 2 },
      { value: "Cabernet Sauvignon", count: 1 },
      { value: "Chardonnay", count: 1 },
    ]);
    expect(profile.topRegions).toEqual([
      { value: "Bordeaux", count: 2 },
      { value: "California", count: 1 },
      { value: "Frankrike", count: 1 },
      { value: "USA", count: 1 },
    ]);
    expect(profile.topStyles).toEqual([
      { value: "Rött", count: 2 },
      { value: "Vitt", count: 1 },
    ]);
    expect(profile.topPairings).toEqual([]);
    expect(profile.avgSweetness).toBeNull();
    expect(profile.avgAcidity).toBeNull();
    expect(profile.avgTannin).toBeNull();
  });

  it("returnerar tom profil när analys saknas", () => {
    const scans: WineScan[] = [
      makeScan("1", null),
      makeScan("2", { grapes: [], land_region: "", style: null }),
    ];

    const profile = buildTasteProfile(scans);

    expect(profile).toEqual({
      topGrapes: [],
      topRegions: [],
      topStyles: [],
      topPairings: [],
      avgSweetness: null,
      avgAcidity: null,
      avgTannin: null,
    });
  });

  it("räknar ut parningar och medelvärden för sötma, syra och tannin", () => {
    const scans: WineScan[] = [
      makeScan(
        "1",
        {
          food_pairings: ["Steak", "Cheese"],
          meters: { sötma: 2, fruktsyra: 3 },
          strävhet: 4,
        } as Partial<WineAnalysisResult> & { strävhet: number },
      ),
      makeScan(
        "2",
        {
          food_pairings: ["Cheese", "Pasta"],
          meters: { sötma: 3.5, fruktsyra: 2.5 },
          tannin: 1,
        } as Partial<WineAnalysisResult> & { tannin: number },
      ),
    ];

    const profile = buildTasteProfile(scans);

    expect(profile.topPairings).toEqual([
      { value: "Cheese", count: 2 },
      { value: "Pasta", count: 1 },
      { value: "Steak", count: 1 },
    ]);
    expect(profile.avgSweetness).toBeCloseTo(2.75, 2);
    expect(profile.avgAcidity).toBeCloseTo(2.75, 2);
    expect(profile.avgTannin).toBeCloseTo(2.5, 2);
  });
});

describe("getTasteProfileForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.limitMock.mockResolvedValue({
      data: [
        {
          id: "scan-remote",
          created_at: "2024-01-02T00:00:00Z",
          analysis_json: {
            grapes: ["Syrah"],
            land_region: "Frankrike",
            style: "Rött",
          },
          image_thumb: null,
          label_hash: null,
          raw_ocr: null,
          user_id: "user-123",
          vintage: null,
        },
      ],
      error: null,
    });
  });

  it("hämtar senaste skanningar och bygger profil", async () => {
    const profile = await getTasteProfileForUser("user-123", 10);

    expect(profile.topGrapes).toEqual([{ value: "Syrah", count: 1 }]);
    expect(profile.topRegions).toEqual([{ value: "Frankrike", count: 1 }]);
    expect(profile.topStyles).toEqual([{ value: "Rött", count: 1 }]);
    expect(profile.avgSweetness).toBeNull();
    expect(profile.avgAcidity).toBeNull();
    expect(profile.avgTannin).toBeNull();

    expect(supabaseMocks.fromMock).toHaveBeenCalledWith("scans");
    expect(supabaseMocks.selectMock).toHaveBeenCalledWith(
      "id,created_at,analysis_json,image_thumb,label_hash,raw_ocr,user_id,vintage",
    );
    expect(supabaseMocks.eqMock).toHaveBeenCalledWith("user_id", "user-123");
    expect(supabaseMocks.orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(supabaseMocks.limitMock).toHaveBeenCalledWith(10);
  });

  it("returnerar tom profil utan användar-id", async () => {
    const profile = await getTasteProfileForUser("");

    expect(profile).toEqual({
      topGrapes: [],
      topRegions: [],
      topStyles: [],
      topPairings: [],
      avgSweetness: null,
      avgAcidity: null,
      avgTannin: null,
    });
    expect(supabaseMocks.fromMock).not.toHaveBeenCalled();
  });
});
