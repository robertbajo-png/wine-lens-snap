export interface WineMeters {
  sötma: number | null;
  fyllighet: number | null;
  fruktighet: number | null;
  fruktsyra: number | null;
}

export interface WineEvidence {
  etiketttext: string;
  webbträffar: string[];
}

export interface WineSummary {
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
  servering: string;
  källa: string;
  passar_till: string[];
  meters: WineMeters;
  evidence: WineEvidence;
  källstatus?: {
    source: "web" | "heuristic";
    evidence_links: string[];
  };
  [key: string]: unknown;
}

export type WineAnalysisResult = WineSummary & {
  sockerhalt?: string;
  syra?: string;
  grapeVariety?: string[];
  region?: string | null;
  country?: string | null;
  wineName?: string;
  producer?: string;
  foodPairing?: string[];
  tastingNotes?: string;
};

export interface WineSearchResult {
  vin?: string;
  producent?: string;
  druvor?: string;
  land_region?: string;
  årgång?: string;
  alkoholhalt?: string;
  volym?: string;
  klassificering?: string;
  karaktär?: string;
  smak?: string;
  servering?: string;
  passar_till?: string[];
  källa?: string;
  källor?: string[];
  text?: string;
  fallback_mode?: boolean;
  meters?: WineMeters;
  evidence?: WineEvidence;
  [key: string]: unknown;
}

export interface TasteProfile {
  sotma: number; // 1..5 (0.5 steg ok)
  fyllighet: number; // 1..5
  fruktighet: number; // 1..5
  syra: number; // 1..5
  tannin: number; // 1..5
  ek: number; // 1..5
}

export type WineStyle = "white" | "red" | "rosé" | "sparkling" | "dessert";

export interface TasteAIResponse {
  tasteProfile: TasteProfile;
  confidence: Partial<Record<keyof TasteProfile, number>>;
  rationale: string[];
  assumptions: string[];
  usedSignals: {
    grapes: string[];
    region: string | null;
    country: string | null;
    style: WineStyle | null;
    abv: string | null;
    sweetness: "dry" | "off-dry" | "medium" | "sweet" | null;
    oakMentioned: boolean | null;
    labelNotes: string;
  };
  summary: string; // praktiskt alias till tasteProfile-beskrivning
}

