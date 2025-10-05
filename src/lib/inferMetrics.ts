type WineData = {
  vin: string;
  land_region: string;
  producent: string;
  druvor: string;
  karaktär: string;
  smak: string;
  passar_till: string[];
  servering: string;
  årgång: string;
  alkoholhalt: string;
  volym: string;
  sockerhalt: string;
  syra: string;
};

type Metrics = {
  sötma: number;
  fyllighet: number;
  fruktighet: number;
  fruktsyra: number;
};

/**
 * Infererar mätarvärden 0–5 baserat på heuristik från vindata.
 */
export function inferMetrics(data: WineData): Metrics {
  // Sammanställ all text som gemener för enklare matchning
  const allText = [
    data.vin,
    data.karaktär,
    data.smak,
    data.druvor,
    data.land_region,
    data.sockerhalt,
    data.syra
  ]
    .join(" ")
    .toLowerCase();

  // Bas: 2.5 för alla
  let sötma = 2.5;
  let fyllighet = 2.5;
  let fruktighet = 2.5;
  let fruktsyra = 2.5;

  // ========================
  // SÖTMA (överskriv i ordning)
  // ========================
  if (/brut nature|pas dosé/.test(allText)) {
    sötma = 0;
  } else if (/extra brut/.test(allText)) {
    sötma = 0.5;
  } else if (/\bbrut\b/.test(allText)) {
    sötma = 1;
  } else if (/extra dry|extra-dry/.test(allText)) {
    sötma = 1.5;
  } else if (/\bdry\b|secco/.test(allText)) {
    sötma = 2;
  } else if (/demi-sec|semi-seco|medium dry/.test(allText)) {
    sötma = 3.5;
  } else if (/dolce|sweet|sött/.test(allText)) {
    sötma = 4.5;
  }

  // ========================
  // FRUKTSYRA
  // ========================
  if (/frisk|hög syra|citrus|mineral|crisp|fresh/.test(allText)) {
    fruktsyra = Math.min(5, fruktsyra + 1);
  }
  if (/mjuk syra|låg syra|mild/.test(allText)) {
    fruktsyra = Math.max(0, fruktsyra - 1);
  }
  if (/mousserande|sparkling|prosecco|cava|champagne/.test(allText)) {
    fruktsyra = Math.max(3, fruktsyra);
  }

  // ========================
  // FRUKTIGHET
  // ========================
  if (/rosé|jordgubb|hallon|bärig|aromatisk|tropisk/.test(allText)) {
    fruktighet = Math.max(3.5, fruktighet);
  }
  if (/neutralt|mineraliskt/.test(allText)) {
    fruktighet = Math.max(0, fruktighet - 0.5);
  }

  // ========================
  // FYLLIGHET
  // ========================
  if (/fylligt|oak|ekfat|smörigt|malolaktisk|barrel/.test(allText)) {
    fyllighet = Math.min(5, fyllighet + 1);
  }
  if (/lätt|lättare|light-bodied/.test(allText)) {
    fyllighet = 1.5;
  }
  if (/mousserande|sparkling/.test(allText)) {
    fyllighet = Math.max(1.5, Math.min(2.0, fyllighet));
  }

  // ========================
  // SÄRFALL
  // ========================
  if (/prosecco/.test(allText)) {
    sötma = Math.max(1, Math.min(2, sötma));
    fruktighet = Math.max(3, Math.min(4, fruktighet));
    fruktsyra = Math.max(3, Math.min(4, fruktsyra));
    fyllighet = Math.max(1.5, Math.min(2, fyllighet));
  }

  if (/tokaji/.test(allText) && /furmint/.test(allText)) {
    // Tokaji Furmint (torr version)
    if (sötma > 2) {
      // Om inte explicit söt/demi-sec
      sötma = 1;
    }
    fruktsyra = Math.max(3.5, Math.min(4, fruktsyra));
    fruktighet = 3;
    fyllighet = 2;
  }

  return {
    sötma: clamp(sötma, 0, 5),
    fyllighet: clamp(fyllighet, 0, 5),
    fruktighet: clamp(fruktighet, 0, 5),
    fruktsyra: clamp(fruktsyra, 0, 5)
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
