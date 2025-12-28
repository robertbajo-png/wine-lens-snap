import { openDB, type IDBPDatabase } from "idb";

export type LocalScanPayload = {
  id: string;
  label_hash: string | null;
  created_at: string;
  analysis_json: unknown;
  synced: boolean;
};

type PutScanPayload = Omit<LocalScanPayload, "created_at" | "synced"> &
  Partial<Pick<LocalScanPayload, "created_at" | "synced">>;

interface ScanLocalStoreDB {
  scans: {
    key: string;
    value: LocalScanPayload;
    indexes: {
      created_at: string;
      synced: boolean;
    };
  };
}

const DB_NAME = "scan-local-store";
const DB_VERSION = 1;

const isIndexedDbAvailable = () => typeof indexedDB !== "undefined";

const openScanDb = async (): Promise<IDBPDatabase<ScanLocalStoreDB> | null> => {
  if (!isIndexedDbAvailable()) return null;

  return openDB<ScanLocalStoreDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("scans")) {
        const store = db.createObjectStore("scans", { keyPath: "id" });
        store.createIndex("created_at", "created_at");
        store.createIndex("synced", "synced");
      } else {
        const tx = (db as unknown as IDBDatabase).transaction("scans", "readonly");
        const store = tx.objectStore("scans");
        if (!store.indexNames.contains("created_at")) {
          (store as unknown as IDBObjectStore).createIndex("created_at", "created_at");
        }
        if (!store.indexNames.contains("synced")) {
          (store as unknown as IDBObjectStore).createIndex("synced", "synced");
        }
      }
    },
  });
};

export const putScan = async (scan: PutScanPayload): Promise<LocalScanPayload | null> => {
  const db = await openScanDb();
  if (!db) return null;

  const record: LocalScanPayload = {
    ...scan,
    created_at: scan.created_at ?? new Date().toISOString(),
    synced: scan.synced ?? false,
  };

  const tx = db.transaction("scans", "readwrite");
  await tx.store.put(record);
  await tx.done;

  return record;
};

export const getRecentScans = async (limit = 20): Promise<LocalScanPayload[]> => {
  const db = await openScanDb();
  if (!db) return [];

  const tx = db.transaction("scans", "readonly");
  const index = tx.store.index("created_at");
  const scans: LocalScanPayload[] = [];

  let cursor = await index.openCursor(null, "prev");
  while (cursor && scans.length < limit) {
    scans.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return scans;
};

export const getPendingScans = async (): Promise<LocalScanPayload[]> => {
  const db = await openScanDb();
  if (!db) return [];

  const tx = db.transaction("scans", "readonly");
  const index = tx.store.index("synced");
  const pending = await index.getAll(IDBKeyRange.only(false));

  await tx.done;
  return pending.sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const markSynced = async (id: string): Promise<boolean> => {
  const db = await openScanDb();
  if (!db) return false;

  const tx = db.transaction("scans", "readwrite");
  const record = await tx.store.get(id);

  if (!record) {
    await tx.done;
    return false;
  }

  await tx.store.put({ ...record, synced: true });
  await tx.done;

  return true;
};
