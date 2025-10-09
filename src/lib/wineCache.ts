// Simple cache for wine analysis results using localStorage

const CACHE_KEY_PREFIX = 'wine_analysis_';

interface StoredWineAnalysisV1 {
  version: 1;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
}

type StoredWineAnalysis = WineAnalysisResult | StoredWineAnalysisV1;

export interface CachedWineAnalysisEntry {
  key: string;
  timestamp: string;
  result: WineAnalysisResult;
  imageData?: string;
}

// Normalize OCR text: trim, lowercase, remove non-alphanumeric
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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
  detekterat_språk?: string;
  originaltext?: string;
}

function parseStoredValue(key: string, raw: string | null): CachedWineAnalysisEntry | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredWineAnalysis;

    if (parsed && typeof parsed === 'object' && 'version' in parsed) {
      const v1 = parsed as StoredWineAnalysisV1;
      return {
        key,
        timestamp: v1.timestamp,
        result: v1.result,
        imageData: v1.imageData,
      };
    }

    if (parsed && typeof parsed === 'object') {
      // Legacy entries were just the result object without metadata
      return {
        key,
        timestamp: new Date().toISOString(),
        result: parsed as WineAnalysisResult,
      };
    }
  } catch (error) {
    console.error('Error parsing cached wine analysis:', error);
  }

  return null;
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

export function setCachedAnalysis(ocrText: string, result: WineAnalysisResult, imageData?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getCacheKey(ocrText);
    const payload: StoredWineAnalysisV1 = {
      version: 1,
      timestamp: new Date().toISOString(),
      result,
      imageData,
    };
    localStorage.setItem(key, JSON.stringify(payload));
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

export function removeCachedAnalysis(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing cached analysis:', error);
  }
}
