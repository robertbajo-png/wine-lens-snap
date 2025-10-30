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
  [key: string]: unknown;
}

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
