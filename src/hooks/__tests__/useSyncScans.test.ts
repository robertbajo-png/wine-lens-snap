import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CachedWineAnalysisEntry } from "@/lib/wineCache";
import { SYNC_BACKOFF_INITIAL_MS, createSyncCoordinator } from "../useSyncScans";

describe("createSyncCoordinator", () => {
  const telemetryMock = vi.fn();
  const markReadyMock = vi.fn();
  const markSyncedMock = vi.fn();
  const clearScheduleMock = vi.fn();
  const scheduleMock = vi.fn<(cb: () => Promise<void>, delay?: number) => number>(() => Date.now());
  const isOnlineMock = vi.fn(() => true);
  const syncMock = vi.fn();
  let pending: CachedWineAnalysisEntry[];

  const buildCoordinator = () =>
    createSyncCoordinator({
      isOnline: isOnlineMock,
      getPending: () => pending,
      markReady: markReadyMock,
      markSynced: markSyncedMock,
      sync: syncMock,
      schedule: scheduleMock,
      clearSchedule: clearScheduleMock,
      telemetry: telemetryMock,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    telemetryMock.mockReset();
    markReadyMock.mockReset();
    markSyncedMock.mockReset();
    clearScheduleMock.mockReset();
    scheduleMock.mockReset();
    scheduleMock.mockImplementation(() => Date.now());
    isOnlineMock.mockReset();
    isOnlineMock.mockReturnValue(true);
    syncMock.mockReset();
    pending = [{ key: "cache-1" } as CachedWineAnalysisEntry];
    syncMock.mockResolvedValue({ inserted: [], duplicates: [] });
  });

  it("skips sync when offline and emits telemetry", async () => {
    isOnlineMock.mockReturnValue(false);
    const coordinator = buildCoordinator();

    await coordinator.runSync();

    expect(syncMock).not.toHaveBeenCalled();
    expect(telemetryMock).toHaveBeenCalledWith("sync_offline_skip", { pending: 1 });
  });

  it("synchronizes pending entries and resets backoff", async () => {
    syncMock.mockResolvedValue({
      inserted: [{ key: "cache-1", remoteId: "remote-1" }],
      duplicates: [{ key: "cache-2", remoteId: "remote-2" }],
    });
    const coordinator = buildCoordinator();

    await coordinator.runSync();

    expect(syncMock).toHaveBeenCalledWith(pending);
    expect(markSyncedMock).toHaveBeenCalledTimes(2);
    expect(telemetryMock).toHaveBeenCalledWith("sync_attempt", { pending: 1 });
    expect(telemetryMock).toHaveBeenCalledWith("sync_completed", { inserted: 1, duplicates: 1 });
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("applies exponential backoff on failure", async () => {
    syncMock.mockRejectedValueOnce(new Error("network"));
    syncMock.mockRejectedValueOnce(new Error("network"));
    const coordinator = buildCoordinator();
    const secondScheduleMock = vi.fn();

    scheduleMock.mockImplementationOnce((cb: () => Promise<void>, delay?: number) => {
      secondScheduleMock(delay);
      return cb.length ? cb.length : Date.now();
    });

    await coordinator.runSync();

    expect(telemetryMock).toHaveBeenCalledWith("sync_failed", { message: "network" });
    expect(telemetryMock).toHaveBeenCalledWith("sync_backoff_scheduled", { delayMs: SYNC_BACKOFF_INITIAL_MS });
    expect(secondScheduleMock).toHaveBeenCalledWith(SYNC_BACKOFF_INITIAL_MS);

    const retryCallback = scheduleMock.mock.calls[0][0] as () => Promise<void>;
    scheduleMock.mockImplementationOnce((cb: () => Promise<void>, delay?: number) => {
      secondScheduleMock(delay);
      return cb.length;
    });
    await retryCallback();

    expect(telemetryMock).toHaveBeenCalledWith("sync_backoff_scheduled", {
      delayMs: SYNC_BACKOFF_INITIAL_MS * 2,
    });
    expect(secondScheduleMock).toHaveBeenCalledWith(SYNC_BACKOFF_INITIAL_MS * 2);
  });
});
vi.mock("@/lib/telemetry", () => ({
  trackEvent: vi.fn(),
}));
