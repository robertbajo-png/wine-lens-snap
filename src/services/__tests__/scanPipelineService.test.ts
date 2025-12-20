import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WineAnalysisResult } from "@/lib/wineCache";
import { runFullScanPipeline } from "../scanPipelineService";

const telemetryMocks = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  trackEvent: telemetryMocks.trackEventMock,
}));

const workerMocks = vi.hoisted(() => ({
  prewarmOcrMock: vi.fn(),
  ocrRecognizeMock: vi.fn(),
}));

vi.mock("@/lib/ocrWorker", () => ({
  prewarmOcr: workerMocks.prewarmOcrMock,
  ocrRecognize: workerMocks.ocrRecognizeMock,
}));

const pipelineMocks = vi.hoisted(() => ({
  supportsOffscreenCanvasMock: vi.fn(),
  runPipelineOnMainMock: vi.fn(),
}));

vi.mock("@/lib/imagePipelineCore", () => ({
  supportsOffscreenCanvas: pipelineMocks.supportsOffscreenCanvasMock,
  runPipelineOnMain: pipelineMocks.runPipelineOnMainMock,
}));

const cacheMocks = vi.hoisted(() => ({
  getCachedAnalysisEntryMock: vi.fn(),
  getCacheKeyMock: vi.fn(),
  setCachedAnalysisMock: vi.fn(),
  computeLabelHashMock: vi.fn(),
}));

vi.mock("@/lib/wineCache", () => ({
  getCachedAnalysisEntry: cacheMocks.getCachedAnalysisEntryMock,
  getCacheKey: cacheMocks.getCacheKeyMock,
  setCachedAnalysis: cacheMocks.setCachedAnalysisMock,
  computeLabelHash: cacheMocks.computeLabelHashMock,
}));

const { normalizeAnalysisJsonMock } = vi.hoisted(() => ({
  normalizeAnalysisJsonMock: vi.fn((value) => value),
}));

vi.mock("@/lib/analysisSchema", () => ({
  normalizeAnalysisJson: normalizeAnalysisJsonMock,
}));

const ocrCacheMocks = vi.hoisted(() => ({
  getOcrCacheMock: vi.fn(),
  setOcrCacheMock: vi.fn(),
  sha1Base64Mock: vi.fn(),
}));

vi.mock("@/lib/ocrCache", () => ({
  getOcrCache: ocrCacheMocks.getOcrCacheMock,
  setOcrCache: ocrCacheMocks.setOcrCacheMock,
  sha1Base64: ocrCacheMocks.sha1Base64Mock,
}));

const fetchMock = vi.fn();

const baseSource = {
  dataUrl: "data:image/jpeg;base64,abc",
  buffer: new ArrayBuffer(8),
  type: "image/jpeg",
  orientation: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  telemetryMocks.trackEventMock.mockReset();
  fetchMock.mockReset();
  pipelineMocks.supportsOffscreenCanvasMock.mockReturnValue(false);
  pipelineMocks.runPipelineOnMainMock.mockResolvedValue({ base64: "processed-image", bitmap: null });
  workerMocks.prewarmOcrMock.mockResolvedValue(undefined);
  workerMocks.ocrRecognizeMock.mockResolvedValue("Detekterad text med vininfo");
  cacheMocks.getCachedAnalysisEntryMock.mockReturnValue(null);
  cacheMocks.getCacheKeyMock.mockImplementation((key: string) => `cache-${key}`);
  cacheMocks.computeLabelHashMock.mockImplementation((value) => (value ? `hash-${value}` : null));
  ocrCacheMocks.getOcrCacheMock.mockReturnValue(null);
  ocrCacheMocks.setOcrCacheMock.mockResolvedValue(undefined);
  ocrCacheMocks.sha1Base64Mock.mockResolvedValue("ocr-key");
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runFullScanPipeline", () => {
  it("returnerar cache-träff med telemetri", async () => {
    const cachedResult: WineAnalysisResult = {
      vin: "Cached Wine",
      land_region: "Spanien",
      producent: "Bodega",
      druvor: "Tempranillo",
      årgång: "2019",
      typ: "Rött",
      färgtyp: "Rött",
      klassificering: "DOCa",
      alkoholhalt: "14%",
      volym: "750ml",
      karaktär: "Kryddig",
      smak: "Fruktig",
      passar_till: ["Tapas"],
      servering: "16°C",
      sockerhalt: "2 g/l",
      syra: "Medel",
      källa: "cache",
      meters: { sötma: 1, fyllighet: 2, fruktighet: 3, fruktsyra: 4 },
      evidence: { etiketttext: "etikett", webbträffar: [] },
      källstatus: { source: "cache", evidence_links: [] },
      mode: "label_only",
      detekterat_språk: "sv",
      originaltext: "cached text",
    };

    cacheMocks.getCachedAnalysisEntryMock.mockReturnValue({ result: cachedResult, saved: true });

    const result = await runFullScanPipeline({
      source: baseSource,
      uiLang: "sv",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
    });

    expect(result.fromCache).toBe(true);
    expect(result.savedFromCache).toBe(true);
    expect(result.analysisMode).toBe("label_only");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(telemetryMocks.trackEventMock).toHaveBeenCalledWith(
      "analysis_cache_hit",
      expect.objectContaining({ saved: true }),
    );
  });

  it("kör full analys och cacher resultat", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          note: "analysis-note",
          data: {
            vin: "Full Wine",
            land_region: "Frankrike",
            producent: "Producent",
            druvor: "Merlot",
            årgång: "2020",
            typ: "Rött",
            färgtyp: "Rött",
            klassificering: "AOC",
            alkoholhalt: "13%",
            volym: "750ml",
            karaktär: "Rund",
            smak: "Fyllig",
            passar_till: ["Mat"],
            servering: "18°C",
            sockerhalt: "3 g/l",
            syra: "Hög",
            källa: "web",
            mode: "label+web",
            evidence: { etiketttext: "etikett", webbträffar: [] },
            meters: { sötma: 1, fyllighet: 2, fruktighet: 3, fruktsyra: 4 },
            källstatus: { source: "web", evidence_links: [] },
            detekterat_språk: "sv",
            originaltext: "Detekterad text",
            _meta: { scan_id: "remote-1" },
          },
          timings: { analysis: 1000 },
        }),
        { status: 200 },
      ),
    );

    const result = await runFullScanPipeline({
      source: baseSource,
      uiLang: "sv",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/wine-vision",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"labelOnly\":false"),
      }),
    );
    expect(result.analysisMode).toBe("full");
    expect(result.resolvedNote).toBe("analysis-note");
    expect(result.remoteScanId).toBe("remote-1");
    expect(cacheMocks.setCachedAnalysisMock).toHaveBeenCalledWith(
      "Detekterad text med vininfo",
      expect.objectContaining({ vin: "Full Wine" }),
      expect.objectContaining({ labelHash: "hash-Detekterad text med vininfo" }),
    );
  });

  it("faller tillbaka till etikettläge vid timeout/abort", async () => {
    const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
    fetchMock.mockRejectedValueOnce(abortError);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            vin: "Label only",
            land_region: "Frankrike",
            producent: "Producent",
            druvor: "Merlot",
            årgång: "2020",
            typ: "Rött",
            färgtyp: "Rött",
            klassificering: "AOC",
            alkoholhalt: "13%",
            volym: "750ml",
            karaktär: "Rund",
            smak: "Fyllig",
            passar_till: [],
            servering: "18°C",
            sockerhalt: "3 g/l",
            syra: "Hög",
            källa: "web",
            mode: "label_only",
            evidence: { etiketttext: "etikett", webbträffar: [] },
          },
        }),
        { status: 200 },
      ),
    );

    vi.useFakeTimers();

    const resultPromise = runFullScanPipeline({
      source: baseSource,
      uiLang: "sv",
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
    });

    vi.runOnlyPendingTimers();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0][1]?.body as string) ?? "{}");
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1]?.body as string) ?? "{}");

    expect(firstBody.labelOnly).toBe(false);
    expect(secondBody.labelOnly).toBe(true);
    expect(result.analysisMode).toBe("label_only");
    expect(result.resolvedNote).toBe("label_only_fallback");
    expect(telemetryMocks.trackEventMock).toHaveBeenCalledWith(
      "analysis_label_only_fallback",
      expect.objectContaining({ note: "label_only_fallback" }),
    );
  });

  it("kastar vänligt fel när rate-limit nås", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }),
    );

    await expect(
      runFullScanPipeline({
        source: baseSource,
        uiLang: "sv",
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon",
      }),
    ).rejects.toThrow("Rate limit överskriden – vänta en stund");
  });
});
