import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingScans, getRecentScans, markSynced, putScan, type LocalScanPayload } from "../scanLocalStore";

type MockCursor = {
  value: LocalScanPayload;
  continue: () => Promise<MockCursor | null>;
};

const createCursor = (items: LocalScanPayload[], position: number): MockCursor | null => {
  if (position >= items.length) return null;

  return {
    value: items[position],
    continue: () => Promise.resolve(createCursor(items, position + 1)),
  };
};

const createMockDb = () => {
  const store = new Map<string, LocalScanPayload>();

  return {
    objectStoreNames: { contains: () => true },
    transaction: (_storeName: string, _mode?: string) => {
      const buildCreatedAtCursor = () =>
        Array.from(store.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));

      return {
        store: {
          put: async (value: LocalScanPayload) => {
            store.set(value.id, value);
          },
          get: async (id: string) => store.get(id) ?? null,
          index: (name: string) => {
            if (name === "created_at") {
              return {
                openCursor: async (_query?: unknown, direction?: string) => {
                  const items = buildCreatedAtCursor();
                  const ordered = direction === "prev" ? items : [...items].reverse();
                  return createCursor(ordered, 0);
                },
              };
            }

            if (name === "synced") {
              return {
                getAll: async (range?: { lower?: boolean }) => {
                  const target = range?.lower;
                  return Array.from(store.values()).filter((item) =>
                    typeof target === "boolean" ? item.synced === target : true,
                  );
                },
              };
            }

            throw new Error(`Unknown index ${name}`);
          },
        },
        done: Promise.resolve(),
      };
    },
  };
};

const mockOpenDb = vi.hoisted(() => vi.fn());
const mockUpgradeDb = {
  objectStoreNames: { contains: () => true },
  transaction: { objectStore: () => ({ indexNames: { contains: () => true }, createIndex: vi.fn() }) },
  createObjectStore: () => ({ indexNames: { contains: () => true }, createIndex: vi.fn() }),
};

vi.mock("idb", () => ({
  openDB: mockOpenDb,
}));

describe("scanLocalStore", () => {
  beforeEach(() => {
    const mockDbInstance = createMockDb();

    mockOpenDb.mockImplementation(async (_name: string, _version: number, options?: { upgrade?: (db: unknown) => void }) => {
      options?.upgrade?.(mockUpgradeDb);
      return mockDbInstance;
    });

    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("IDBKeyRange", { only: (value: unknown) => ({ lower: value }) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockOpenDb.mockReset();
    vi.useRealTimers();
  });

  it("stores scans with generated metadata when fields are missing", async () => {
    vi.useFakeTimers();
    const now = new Date("2024-05-01T12:00:00.000Z");
    vi.setSystemTime(now);

    const saved = await putScan({ id: "scan-1", label_hash: "abc", analysis_json: { note: "hello" } });

    expect(saved).toMatchObject({
      id: "scan-1",
      label_hash: "abc",
      synced: false,
      created_at: now.toISOString(),
    });
  });

  it("returns recent scans ordered by newest first and respects limits", async () => {
    await putScan({
      id: "scan-old",
      label_hash: null,
      analysis_json: null,
      created_at: "2023-01-01T00:00:00.000Z",
      synced: false,
    });

    await putScan({
      id: "scan-new",
      label_hash: null,
      analysis_json: null,
      created_at: "2024-01-01T00:00:00.000Z",
      synced: true,
    });

    const [first] = await getRecentScans(1);

    expect(first?.id).toBe("scan-new");
  });

  it("fetches pending scans sorted by creation date", async () => {
    await putScan({
      id: "synced-scan",
      label_hash: "123",
      analysis_json: null,
      created_at: "2024-01-01T00:00:00.000Z",
      synced: true,
    });

    await putScan({
      id: "pending-old",
      label_hash: "123",
      analysis_json: null,
      created_at: "2024-02-01T00:00:00.000Z",
      synced: false,
    });

    await putScan({
      id: "pending-new",
      label_hash: "456",
      analysis_json: null,
      created_at: "2024-03-01T00:00:00.000Z",
      synced: false,
    });

    const pending = await getPendingScans();

    expect(pending).toHaveLength(2);
    expect(pending.map((scan) => scan.id)).toEqual(["pending-new", "pending-old"]);
  });

  it("marks scans as synced and removes them from pending list", async () => {
    await putScan({
      id: "pending-1",
      label_hash: null,
      analysis_json: null,
      created_at: "2024-04-01T00:00:00.000Z",
      synced: false,
    });

    const initialPending = await getPendingScans();
    expect(initialPending).toHaveLength(1);

    const updated = await markSynced("pending-1");
    const pendingAfterUpdate = await getPendingScans();

    expect(updated).toBe(true);
    expect(pendingAfterUpdate).toHaveLength(0);
  });
});
