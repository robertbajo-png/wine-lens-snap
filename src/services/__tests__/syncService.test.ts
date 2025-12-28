import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { syncPendingScans } from "../syncService";
import { getPendingScans, markSynced } from "../scanLocalStore";
import { logEvent } from "@/lib/logger";
import { supabase } from "@/lib/supabaseClient";

vi.mock("@/lib/logger", () => ({
  logEvent: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => {
  const selectMock = vi.fn();
  const inMock = vi.fn();
  const gteMock = vi.fn();
  const lteMock = vi.fn();
  const upsertMock = vi.fn();
  const queryBuilder = { select: selectMock, in: inMock, gte: gteMock, lte: lteMock, upsert: upsertMock };
  const fromMock = vi.fn(() => queryBuilder);
  return { selectMock, inMock, gteMock, lteMock, upsertMock, queryBuilder, fromMock };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: supabaseMocks.fromMock },
}));

vi.mock("../scanLocalStore", () => ({
  getPendingScans: vi.fn(),
  markSynced: vi.fn(),
}));

const mockedSupabase = vi.mocked(supabase);
const mockedGetPendingScans = vi.mocked(getPendingScans);
const mockedMarkSynced = vi.mocked(markSynced);
const mockedLogEvent = vi.mocked(logEvent);

describe("syncPendingScans", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    supabaseMocks.selectMock.mockReset();
    supabaseMocks.inMock.mockReset();
    supabaseMocks.gteMock.mockReset();
    supabaseMocks.lteMock.mockReset();
    supabaseMocks.upsertMock.mockReset();
    supabaseMocks.fromMock.mockReset();
    mockedGetPendingScans.mockReset();
    mockedMarkSynced.mockReset();
    mockedLogEvent.mockReset();

    supabaseMocks.selectMock.mockReturnValue(supabaseMocks.queryBuilder);
    supabaseMocks.inMock.mockReturnValue(supabaseMocks.queryBuilder);
    supabaseMocks.gteMock.mockReturnValue(supabaseMocks.queryBuilder);
    supabaseMocks.lteMock.mockReturnValue(Promise.resolve({ data: [], error: null }));
    supabaseMocks.upsertMock.mockResolvedValue({ data: null, error: null });
    supabaseMocks.fromMock.mockReturnValue(supabaseMocks.queryBuilder);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks scans as synced when a remote duplicate exists", async () => {
    mockedGetPendingScans.mockResolvedValue([
      {
        id: "local-1",
        label_hash: "abc",
        created_at: "2024-01-01T00:00:00.000Z",
        analysis_json: {},
        synced: false,
      },
    ]);

    supabaseMocks.lteMock.mockResolvedValueOnce({
      data: [{ id: "remote-1", label_hash: "abc", created_at: "2024-01-01T00:03:00.000Z" }],
      error: null,
    });

    const result = await syncPendingScans("user-123");

    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(supabaseMocks.upsertMock).not.toHaveBeenCalled();
    expect(mockedMarkSynced).toHaveBeenCalledWith("local-1");
    expect(mockedLogEvent).toHaveBeenCalledWith("sync_scan_succeeded", {
      localId: "local-1",
      duplicate: true,
    });
    expect(mockedSupabase.from).toHaveBeenCalledWith("scans");
  });

  it("retries sync and succeeds after transient errors", async () => {
    mockedGetPendingScans.mockResolvedValue([
      {
        id: "local-2",
        label_hash: null,
        created_at: "2024-02-02T00:00:00.000Z",
        analysis_json: { note: "test" },
        synced: false,
      },
    ]);

    supabaseMocks.upsertMock
      .mockResolvedValueOnce({ error: { message: "temporary" } })
      .mockResolvedValueOnce({ error: { message: "temporary" } })
      .mockResolvedValueOnce({ error: null });

    const syncPromise = syncPendingScans("user-456");
    await vi.runAllTimersAsync();
    const result = await syncPromise;

    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(supabaseMocks.upsertMock).toHaveBeenCalledTimes(3);
    expect(mockedMarkSynced).toHaveBeenCalledWith("local-2");
    expect(mockedLogEvent).toHaveBeenCalledWith("sync_scan_succeeded", {
      localId: "local-2",
      duplicate: false,
    });
  });

  it("logs failure after exhausting retries", async () => {
    mockedGetPendingScans.mockResolvedValue([
      {
        id: "local-3",
        label_hash: null,
        created_at: "2024-03-03T00:00:00.000Z",
        analysis_json: {},
        synced: false,
      },
    ]);

    supabaseMocks.upsertMock.mockResolvedValue({ error: { message: "permanent failure" } });

    const syncPromise = syncPendingScans("user-789");
    await vi.runAllTimersAsync();
    const result = await syncPromise;

    expect(result).toEqual({ synced: 0, failed: 1 });
    expect(supabaseMocks.upsertMock).toHaveBeenCalledTimes(3);
    expect(mockedMarkSynced).not.toHaveBeenCalled();
    expect(mockedLogEvent).toHaveBeenCalledWith("sync_scan_failed", {
      localId: "local-3",
      reason: "permanent failure",
    });
  });
});
