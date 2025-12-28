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

    expect(profile.totalScans).toBe(3);
    expect(profile.grapes).toEqual([
      { value: "Merlot", count: 2 },
      { value: "Cabernet Sauvignon", count: 1 },
      { value: "Chardonnay", count: 1 },
    ]);
    expect(profile.regions).toEqual([
      { value: "Bordeaux", count: 2 },
      { value: "California", count: 1 },
      { value: "Frankrike", count: 1 },
      { value: "USA", count: 1 },
    ]);
    expect(profile.styles).toEqual([
      { value: "Rött", count: 2 },
      { value: "Vitt", count: 1 },
    ]);
  });

  it("returnerar tomma listor när analys saknas", () => {
    const scans: WineScan[] = [
      makeScan("1", null),
      makeScan("2", { grapes: [], land_region: "", style: null }),
    ];

    const profile = buildTasteProfile(scans);

    expect(profile).toEqual({
      grapes: [],
      regions: [],
      styles: [],
      totalScans: 2,
    });
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

    expect(profile.grapes).toEqual([{ value: "Syrah", count: 1 }]);
    expect(profile.regions).toEqual([{ value: "Frankrike", count: 1 }]);
    expect(profile.styles).toEqual([{ value: "Rött", count: 1 }]);
    expect(profile.totalScans).toBe(1);

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

    expect(profile).toEqual({ grapes: [], regions: [], styles: [], totalScans: 0 });
    expect(supabaseMocks.fromMock).not.toHaveBeenCalled();
  });
});
