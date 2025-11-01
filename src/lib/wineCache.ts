// Simple cache for wine analysis results using localStorage

const CACHE_KEY_PREFIX = 'wine_analysis_';
const DEMO_CACHE_PREFIX = `${CACHE_KEY_PREFIX}demo_`;

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

    const demoEntries: StoredWineAnalysisV1[] = [
      {
        version: 1,
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
      },
      {
        version: 1,
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
      },
      {
        version: 1,
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
      },
    ];

    demoEntries.forEach((entry, index) => {
      const key = `${DEMO_CACHE_PREFIX}${index + 1}`;
      localStorage.setItem(key, JSON.stringify(entry));
      seeded.push({
        key,
        timestamp: entry.timestamp,
        result: entry.result,
        imageData: entry.imageData,
      });
    });
  } catch (error) {
    console.error('Error seeding demo analyses:', error);
  }

  return seeded;
}
