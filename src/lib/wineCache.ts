// Simple cache for wine analysis results using localStorage

const CACHE_KEY_PREFIX = 'wine_analysis_';
const DEMO_CACHE_PREFIX = `${CACHE_KEY_PREFIX}demo_`;
const CACHE_UPDATED_EVENT = 'wine-cache:update';

interface StoredWineAnalysisV1 {
  version: 1;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
}

interface StoredWineAnalysisV2 {
  version: 2;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
  syncReady: boolean;
}

interface StoredWineAnalysisV3 {
  version: 3;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
  syncReady: boolean;
  remoteId?: string | null;
  labelHash?: string | null;
  ocrText?: string | null;
}

interface StoredWineAnalysisV4 {
  version: 4;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
  syncReady: boolean;
  remoteId?: string | null;
  labelHash?: string | null;
  ocrText?: string | null;
  saved: boolean;
}

type StoredWineAnalysis =
  | WineAnalysisResult
  | StoredWineAnalysisV1
  | StoredWineAnalysisV2
  | StoredWineAnalysisV3
  | StoredWineAnalysisV4;

export interface CachedWineAnalysisEntry {
  key: string;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
  syncReady: boolean;
  remoteId?: string | null;
  labelHash?: string | null;
  ocrText?: string | null;
  saved: boolean;
}

// Normalize OCR text: trim, lowercase, remove non-alphanumeric
function normalizeText(text: string): string {
  return text
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// Simple hash function for strings
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function getCacheKey(ocrText: string): string {
  const normalized = normalizeText(ocrText);
  const hash = hashString(normalized);
  return `${CACHE_KEY_PREFIX}${hash}`;
}

export function computeLabelHash(text?: string | null): string | null {
  if (!text) return null;
  const normalized = normalizeText(text);
  if (!normalized) return null;
  return hashString(normalized);
}

function emitCacheUpdatedEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CACHE_UPDATED_EVENT));
}

export const WINE_CACHE_UPDATED_EVENT = CACHE_UPDATED_EVENT;

function deriveLabelHash(
  ocrText: string | null | undefined,
  result: WineAnalysisResult,
  explicitHash?: string | null,
): string | null {
  if (explicitHash) {
    return explicitHash;
  }

  const candidates: (string | undefined | null)[] = [
    ocrText,
    result.originaltext,
    result.evidence?.etiketttext,
    result.vin,
  ];

  for (const candidate of candidates) {
    const hash = computeLabelHash(candidate);
    if (hash) {
      return hash;
    }
  }

  return null;
}

export interface WineAnalysisResult {
  vin: string;
  land_region: string;
  producent: string;
  druvor: string;
  årgång: string;
  typ: string;
  färgtyp: string;
  klassificering: string;
  alkoholhalt: string;
  volym: string;
  karaktär: string;
  smak: string;
  passar_till: string[];
  servering: string;
  sockerhalt: string;
  syra: string;
  källa: string;
  meters?: {
    sötma: number | null;
    fyllighet: number | null;
    fruktighet: number | null;
    fruktsyra: number | null;
  };
  evidence?: {
    etiketttext: string;
    webbträffar: string[];
  };
  källstatus?: {
    source: "web" | "heuristic";
    evidence_links: string[];
  };
  _meta?: {
    meters_source?: "web" | "derived";
    confidence?: {
      meters?: number;
      [key: string]: number | undefined;
    };
    [key: string]: unknown;
  };
  detekterat_språk?: string;
  originaltext?: string;
}

function parseStoredValue(key: string, raw: string | null): CachedWineAnalysisEntry | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredWineAnalysis;

    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      if ((parsed as StoredWineAnalysisV4).version === 4) {
        const v4 = parsed as StoredWineAnalysisV4;
        return {
          key,
          timestamp: v4.timestamp,
          result: v4.result,
          imageData: v4.imageData,
          syncReady: Boolean(v4.syncReady),
          remoteId: v4.remoteId ?? null,
          labelHash: v4.labelHash ?? null,
          ocrText: v4.ocrText ?? null,
          saved: Boolean(v4.saved),
        };
      }

      if ((parsed as StoredWineAnalysisV3).version === 3) {
        const v3 = parsed as StoredWineAnalysisV3;
        return {
          key,
          timestamp: v3.timestamp,
          result: v3.result,
          imageData: v3.imageData,
          syncReady: Boolean(v3.syncReady),
          remoteId: v3.remoteId ?? null,
          labelHash: v3.labelHash ?? null,
          ocrText: v3.ocrText ?? null,
          saved: true,
        };
      }

      if ((parsed as StoredWineAnalysisV2).version === 2) {
        const v2 = parsed as StoredWineAnalysisV2;
        return {
          key,
          timestamp: v2.timestamp,
          result: v2.result,
          imageData: v2.imageData,
          syncReady: Boolean(v2.syncReady),
          remoteId: null,
          labelHash: deriveLabelHash(null, v2.result),
          ocrText: null,
          saved: true,
        };
      }

      const v1 = parsed as StoredWineAnalysisV1;
      return {
        key,
        timestamp: v1.timestamp,
        result: v1.result,
        imageData: v1.imageData,
        syncReady: false,
        remoteId: null,
        labelHash: deriveLabelHash(null, v1.result),
        ocrText: null,
        saved: true,
      };
    }

    if (parsed && typeof parsed === 'object') {
      // Legacy entries were just the result object without metadata
      return {
        key,
        timestamp: new Date().toISOString(),
        result: parsed as WineAnalysisResult,
        syncReady: false,
        remoteId: null,
        labelHash: deriveLabelHash(null, parsed as WineAnalysisResult),
        ocrText: null,
        saved: true,
      };
    }
  } catch (error) {
    console.error('Error parsing cached wine analysis:', error);
  }

  return null;
}

function createStoredPayload(data: {
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
  syncReady: boolean;
  remoteId?: string | null;
  labelHash?: string | null;
  ocrText?: string | null;
  saved: boolean;
}): StoredWineAnalysisV4 {
  return {
    version: 4,
    timestamp: data.timestamp,
    result: data.result,
    imageData: data.imageData,
    syncReady: data.syncReady,
    remoteId: data.remoteId ?? null,
    labelHash: data.labelHash ?? null,
    ocrText: data.ocrText ?? null,
    saved: data.saved,
  };
}

export function getCachedAnalysis(ocrText: string): WineAnalysisResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getCacheKey(ocrText);
    const cached = parseStoredValue(key, localStorage.getItem(key));
    if (cached) {
      return cached.result;
    }
  } catch (error) {
    console.error('Error reading from cache:', error);
  }
  return null;
}

export function getCachedAnalysisEntry(ocrText: string): CachedWineAnalysisEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getCacheKey(ocrText);
    return parseStoredValue(key, localStorage.getItem(key));
  } catch (error) {
    console.error('Error reading cached analysis entry:', error);
  }
  return null;
}

export function getCachedAnalysisEntryByKey(key: string): CachedWineAnalysisEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseStoredValue(key, localStorage.getItem(key));
  } catch (error) {
    console.error('Error reading cached analysis by key:', error);
  }
  return null;
}

export function setCachedAnalysis(
  ocrText: string,
  result: WineAnalysisResult,
  options: {
    imageData?: string;
    rawOcr?: string | null;
    remoteId?: string | null;
    labelHash?: string | null;
    saved?: boolean;
  } = {},
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getCacheKey(ocrText);
    const rawOcr = options.rawOcr ?? null;
    const remoteId = options.remoteId ?? null;
    const labelHash = deriveLabelHash(rawOcr, result, options.labelHash);
    const payload = createStoredPayload({
      timestamp: new Date().toISOString(),
      result,
      imageData: options.imageData,
      syncReady: false,
      remoteId,
      labelHash,
      ocrText: rawOcr,
      saved: Boolean(options.saved),
    });
    localStorage.setItem(key, JSON.stringify(payload));
    emitCacheUpdatedEvent();
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

export function clearCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    emitCacheUpdatedEvent();
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export function getAllCachedAnalyses(): CachedWineAnalysisEntry[] {
  if (typeof window === 'undefined') return [];

  const entries: CachedWineAnalysisEntry[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_KEY_PREFIX)) continue;

      const parsed = parseStoredValue(key, localStorage.getItem(key));
      if (parsed) {
        entries.push(parsed);
      }
    }
  } catch (error) {
    console.error('Error getting cached analyses:', error);
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getSavedAnalyses(): CachedWineAnalysisEntry[] {
  return getAllCachedAnalyses().filter(entry => entry.saved);
}

export function removeCachedAnalysis(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
    emitCacheUpdatedEvent();
  } catch (error) {
    console.error('Error removing cached analysis:', error);
  }
}

export function setAnalysisSavedState(key: string, saved: boolean): CachedWineAnalysisEntry | null {
  return updateCachedAnalysisEntry(key, entry => {
    const timestamp = saved ? new Date().toISOString() : entry.timestamp;
    return {
      ...entry,
      saved,
      timestamp,
      syncReady: saved ? true : entry.syncReady,
    };
  });
}

function updateCachedAnalysisEntry(
  key: string,
  updater: (entry: CachedWineAnalysisEntry) => CachedWineAnalysisEntry | null,
): CachedWineAnalysisEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = parseStoredValue(key, localStorage.getItem(key));
    if (!parsed) {
      return null;
    }

    const updated = updater(parsed);
    if (!updated) {
      localStorage.removeItem(key);
      emitCacheUpdatedEvent();
      return null;
    }

    const payload = createStoredPayload({
      timestamp: updated.timestamp,
      result: updated.result,
      imageData: updated.imageData,
      syncReady: updated.syncReady,
      remoteId: updated.remoteId ?? null,
      labelHash: updated.labelHash ?? null,
      ocrText: updated.ocrText ?? null,
      saved: updated.saved,
    });
    localStorage.setItem(key, JSON.stringify(payload));
    emitCacheUpdatedEvent();
    return updated;
  } catch (error) {
    console.error('Error updating cached analysis:', error);
  }

  return null;
}

export function markAnalysesReadyForSync(): number {
  if (typeof window === 'undefined') return 0;

  let updated = 0;

  try {
    const keysToUpdate: { key: string; entry: CachedWineAnalysisEntry }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_KEY_PREFIX)) continue;

      const parsed = parseStoredValue(key, localStorage.getItem(key));
      if (parsed && parsed.saved && !parsed.syncReady && !parsed.remoteId) {
        keysToUpdate.push({ key, entry: parsed });
      }
    }

    keysToUpdate.forEach(({ key, entry }) => {
      const payload = createStoredPayload({
        timestamp: entry.timestamp,
        result: entry.result,
        imageData: entry.imageData,
        syncReady: true,
        remoteId: entry.remoteId ?? null,
        labelHash: entry.labelHash ?? null,
        ocrText: entry.ocrText ?? null,
        saved: entry.saved,
      });
      localStorage.setItem(key, JSON.stringify(payload));
      updated += 1;
    });

    if (updated > 0) {
      emitCacheUpdatedEvent();
    }
  } catch (error) {
    console.error('Error marking analyses ready for sync:', error);
  }

  return updated;
}

export function getAnalysesPendingSync(): CachedWineAnalysisEntry[] {
  return getAllCachedAnalyses().filter(entry => entry.syncReady && !entry.remoteId);
}

export function markAnalysisSynced(key: string, remoteId: string): CachedWineAnalysisEntry | null {
  return updateCachedAnalysisEntry(key, entry => ({
    ...entry,
    remoteId,
    syncReady: false,
  }));
}

function removeExistingDemoEntries() {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DEMO_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      emitCacheUpdatedEvent();
    }
  } catch (error) {
    console.error('Error removing demo entries:', error);
  }
}

export function seedDemoAnalyses(): CachedWineAnalysisEntry[] {
  if (typeof window === 'undefined') return [];

  const seeded: CachedWineAnalysisEntry[] = [];

  try {
    removeExistingDemoEntries();

    const now = Date.now();
    const createTimestamp = (offsetMs: number) => new Date(now - offsetMs).toISOString();

    const demoEntries = [
      {
        timestamp: createTimestamp(1000 * 60 * 60 * 6),
        result: {
          vin: 'Langhe Nebbiolo',
          land_region: 'Italien, Piemonte',
          producent: 'G.D. Vajra',
          druvor: 'Nebbiolo',
          årgång: '2021',
          typ: 'Rött vin',
          färgtyp: 'Rött',
          klassificering: 'DOC',
          alkoholhalt: '14%',
          volym: '750 ml',
          karaktär: 'Elegant med rosor och röda bär.',
          smak: 'Frisk syra, silkeslena tanniner och lång eftersmak.',
          passar_till: ['Tryffelpasta', 'Charkuterier', 'Kantareller'],
          servering: '18°C',
          sockerhalt: 'Torr',
          syra: 'Hög',
          källa: 'Demoanalys',
          meters: {
            sötma: 1,
            fyllighet: 3,
            fruktighet: 4,
            fruktsyra: 4,
          },
          evidence: {
            etiketttext: 'Langhe Nebbiolo',
            webbträffar: ['https://example.com/langhe-nebbiolo'],
          },
          detekterat_språk: 'sv',
          originaltext: 'Langhe Nebbiolo DOC 2021',
        },
        ocrText: 'Langhe Nebbiolo DOC 2021',
      },
      {
        timestamp: createTimestamp(1000 * 60 * 60 * 24 * 2),
        result: {
          vin: 'Sancerre Les Terres Blanches',
          land_region: 'Frankrike, Loire',
          producent: 'Domaine Fournier',
          druvor: 'Sauvignon Blanc',
          årgång: '2022',
          typ: 'Vitt vin',
          färgtyp: 'Vitt',
          klassificering: 'AOC',
          alkoholhalt: '13%',
          volym: '750 ml',
          karaktär: 'Mineraldriven med citrus och krusbär.',
          smak: 'Krispig syra med toner av lime och flinta.',
          passar_till: ['Getost', 'Skaldjur', 'Grön sparris'],
          servering: '10°C',
          sockerhalt: 'Torr',
          syra: 'Hög',
          källa: 'Demoanalys',
          meters: {
            sötma: 1,
            fyllighet: 2,
            fruktighet: 3,
            fruktsyra: 4,
          },
          evidence: {
            etiketttext: 'Sancerre Les Terres Blanches',
            webbträffar: ['https://example.com/sancerre'],
          },
          detekterat_språk: 'sv',
          originaltext: 'Sancerre Les Terres Blanches AOC 2022',
        },
        ocrText: 'Sancerre Les Terres Blanches AOC 2022',
      },
      {
        timestamp: createTimestamp(1000 * 60 * 60 * 24 * 7),
        result: {
          vin: 'Cava Brut Reserva',
          land_region: 'Spanien, Penedès',
          producent: 'Segura Viudas',
          druvor: 'Macabeo • Parellada • Xarel-lo',
          årgång: 'NV',
          typ: 'Mousserande vin',
          färgtyp: 'Vitt',
          klassificering: 'DO Cava',
          alkoholhalt: '11.5%',
          volym: '750 ml',
          karaktär: 'Pigga bubblor med citrus och rostat bröd.',
          smak: 'Fräsch och livlig med toner av grönt äpple.',
          passar_till: ['Aperitif', 'Friterat', 'Tapas'],
          servering: '8°C',
          sockerhalt: 'Brut',
          syra: 'Medel',
          källa: 'Demoanalys',
          meters: {
            sötma: 2,
            fyllighet: 2,
            fruktighet: 3,
            fruktsyra: 3,
          },
          evidence: {
            etiketttext: 'Cava Brut Reserva',
            webbträffar: ['https://example.com/cava-brut'],
          },
          detekterat_språk: 'sv',
          originaltext: 'Segura Viudas Cava Brut Reserva',
        },
        ocrText: 'Segura Viudas Cava Brut Reserva',
      },
    ];

    demoEntries.forEach((entry, index) => {
      const payload = createStoredPayload({
        timestamp: entry.timestamp,
        result: entry.result,
        imageData: undefined,
        syncReady: false,
        remoteId: null,
        labelHash: computeLabelHash(entry.ocrText),
        ocrText: entry.ocrText,
        saved: true,
      });
      const key = `${DEMO_CACHE_PREFIX}${index + 1}`;
      const raw = JSON.stringify(payload);
      localStorage.setItem(key, raw);
      const parsed = parseStoredValue(key, raw);
      if (parsed) {
        seeded.push(parsed);
      }
    });

    if (demoEntries.length > 0) {
      emitCacheUpdatedEvent();
    }
  } catch (error) {
    console.error('Error seeding demo analyses:', error);
  }

  return seeded;
}
