import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CachedWineAnalysisEntry } from "@/lib/wineCache";
import { SYNC_BACKOFF_INITIAL_MS, createSyncCoordinator } from "../useSyncScans";

describe("createSyncCoordinator", () => {
  const telemetryMock = vi.fn();
  const markReadyMock = vi.fn();
  const markSyncedMock = vi.fn();
  const clearScheduleMock = vi.fn();
  // Use a simple mock that stores calls for later inspection
  let scheduleCalls: Array<{ cb: () => Promise<void>; delay?: number }> = [];
  const scheduleMock = vi.fn((cb: () => Promise<void>, delay?: number) => {
    scheduleCalls.push({ cb, delay });
    return Date.now();
  }) as unknown as typeof window.setTimeout;
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
    scheduleCalls = [];
    telemetryMock.mockReset();
    markReadyMock.mockReset();
    markSyncedMock.mockReset();
    clearScheduleMock.mockReset();
    scheduleCalls = [];
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
    expect(scheduleCalls).toHaveLength(0);
  });

  it("applies exponential backoff on failure", async () => {
    syncMock.mockRejectedValueOnce(new Error("network"));
    syncMock.mockRejectedValueOnce(new Error("network"));
    const coordinator = buildCoordinator();

    await coordinator.runSync();

    expect(telemetryMock).toHaveBeenCalledWith("sync_failed", { message: "network" });
    expect(telemetryMock).toHaveBeenCalledWith("sync_backoff_scheduled", { delayMs: SYNC_BACKOFF_INITIAL_MS });
    expect(scheduleCalls).toHaveLength(1);
    expect(scheduleCalls[0].delay).toBe(SYNC_BACKOFF_INITIAL_MS);

    // Execute the retry callback
    const retryCallback = scheduleCalls[0].cb;
    await retryCallback();

    expect(telemetryMock).toHaveBeenCalledWith("sync_backoff_scheduled", {
      delayMs: SYNC_BACKOFF_INITIAL_MS * 2,
    });
    expect(scheduleCalls).toHaveLength(2);
    expect(scheduleCalls[1].delay).toBe(SYNC_BACKOFF_INITIAL_MS * 2);
  });
});

vi.mock("@/lib/telemetry", () => ({
  trackEvent: vi.fn(),
}));
