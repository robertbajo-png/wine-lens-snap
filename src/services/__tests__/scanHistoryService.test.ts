import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRemoteScan } from "../scanHistoryService";
import type { WineAnalysisResult } from "@/lib/wineCache";

const supabaseMocks = vi.hoisted(() => {
  const singleMock = vi.fn();
  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const insertMock = vi.fn().mockReturnValue({ select: selectMock });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
  return { singleMock, selectMock, insertMock, fromMock };
});

const { computeLabelHashMock } = vi.hoisted(() => ({
  computeLabelHashMock: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: supabaseMocks.fromMock,
  },
}));

vi.mock("@/lib/wineCache", () => ({
  computeLabelHash: computeLabelHashMock,
  getCacheKey: vi.fn(),
  setAnalysisSavedState: vi.fn(),
  setCachedAnalysis: vi.fn(),
}));

const baseResult: WineAnalysisResult = {
  vin: "Test Wine",
  land_region: "Frankrike",
  producent: "Test Producent",
  druvor: "Merlot",
  årgång: "2015",
  typ: "Rött",
  färgtyp: "Rött",
  klassificering: "AOC",
  alkoholhalt: "13%",
  volym: "750ml",
  karaktär: "Rund",
  smak: "Fyllig",
  passar_till: ["Kött"],
  servering: "18°C",
  sockerhalt: "3 g/l",
  syra: "Hög",
  källa: "web",
  meters: { sötma: 1, fyllighet: 2, fruktighet: 3, fruktsyra: 4 },
  evidence: { etiketttext: " Etiketttext 2015 ", webbträffar: [] },
  källstatus: { source: "web", evidence_links: [] },
  mode: "label+web",
  detekterat_språk: "sv",
  originaltext: " 2015 Test Wine ",
};

beforeEach(() => {
  vi.clearAllMocks();
  computeLabelHashMock.mockReturnValue("label-hash-123");
  supabaseMocks.singleMock.mockResolvedValue({ data: { id: "remote-id" }, error: null });
});

describe("createRemoteScan", () => {
  it("skickar normaliserad payload till Supabase", async () => {
    const id = await createRemoteScan({ results: baseResult, previewImage: "thumb-data" });

    expect(id).toBe("remote-id");
    expect(computeLabelHashMock).toHaveBeenCalledWith("2015 Test Wine");
    expect(supabaseMocks.insertMock).toHaveBeenCalledWith([
      {
        label_hash: "label-hash-123",
        raw_ocr: "2015 Test Wine",
        image_thumb: "thumb-data",
        analysis_json: baseResult as unknown,
        vintage: 2015,
      },
    ]);
  });

  it("kastar fel när Supabase returnerar ett fel", async () => {
    supabaseMocks.singleMock.mockResolvedValueOnce({ data: null, error: { message: "DB-fel" } });

    await expect(createRemoteScan({ results: baseResult, previewImage: null })).rejects.toThrow("DB-fel");
  });

  it("kastar fel när inget id returneras", async () => {
    supabaseMocks.singleMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(createRemoteScan({ results: baseResult, previewImage: null })).rejects.toThrow(
      "Kunde inte spara skanningen.",
    );
  });
});
