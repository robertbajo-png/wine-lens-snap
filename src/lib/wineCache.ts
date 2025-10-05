// Simple cache for wine analysis results using localStorage

const CACHE_KEY_PREFIX = 'wine_analysis_';

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

export function getCachedAnalysis(ocrText: string): WineAnalysisResult | null {
  try {
    const key = getCacheKey(ocrText);
    const cached = localStorage.getItem(key);
    if (cached) {
      return JSON.parse(cached) as WineAnalysisResult;
    }
  } catch (error) {
    console.error('Error reading from cache:', error);
  }
  return null;
}

export function setCachedAnalysis(ocrText: string, result: WineAnalysisResult): void {
  try {
    const key = getCacheKey(ocrText);
    localStorage.setItem(key, JSON.stringify(result));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

export function clearCache(): void {
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
