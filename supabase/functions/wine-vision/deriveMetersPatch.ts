export type SystembolagetMeters = {
  sötma: number;
  fyllighet: number;
  fruktighet: number;
  fruktsyra: number;
};

type MeterKey = keyof SystembolagetMeters;

type HeuristicRule =
  | { pattern: RegExp; delta: number }
  | { evaluate: (text: string) => number };

const BASE_VALUES: SystembolagetMeters = {
  sötma: 2.0,
  fyllighet: 2.4,
  fruktighet: 2.6,
  fruktsyra: 2.6,
};

const clamp05 = (n: number) => Math.max(0, Math.min(5, Math.round(n * 10) / 10));
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const SWEETNESS_RULES: HeuristicRule[] = [
  { pattern: /(dessert|asz[uú]|ice\s*wine|late\s*harvest|passito|vin\s*doux|tokaji|sött)/, delta: 1.8 },
  { pattern: /(halvtorr|halvsöt|off[-\s]?dry|semi[-\s]?(sec|seco|sweet)|amabile|lieblich|demi\s*sec)/, delta: 0.9 },
  { pattern: /(brut|extra\s*brut|nature|ultra\s*brut)/, delta: -1.1 },
  { pattern: /(torr|dry|sec\b|krispig|mineral|stram)/, delta: -0.7 },
  {
    evaluate: (text) => {
      const match = text.match(/sockerhalt[^0-9]*([0-9]+(?:[.,][0-9]+)?)\s*g/);
      if (!match) return 0;
      const grams = parseFloat(match[1].replace(",", "."));
      if (Number.isNaN(grams)) return 0;
      if (grams <= 7) return -1.2;
      if (grams <= 18) return -0.4;
      if (grams >= 45) return 1.2;
      return 0.5;
    },
  },
];

const BODY_RULES: HeuristicRule[] = [
  { pattern: /(kraftfull|fyllig|full[-\s]?bodied|barrique|amarone|cabernet|syrah|shiraz|malbec|gran\s*reserva|oak|fatlagrad)/, delta: 1.3 },
  { pattern: /(mellan|medel(?:fyllig)?)/, delta: 0.2 },
  { pattern: /(lätt|elegant|frisk|spritsig|pinot\s+noir|gamay|vinho\s+verde|riesling|mosel|petillant|slank)/, delta: -1.0 },
  {
    evaluate: (text) => {
      const match = text.match(/alkoholhalt[^0-9]*([0-9]+(?:[.,][0-9]+)?)/);
      if (!match) return 0;
      const abv = parseFloat(match[1].replace(",", "."));
      if (Number.isNaN(abv)) return 0;
      if (abv >= 14) return 0.5;
      if (abv <= 11) return -0.4;
      return 0;
    },
  },
];

const FRUIT_RULES: HeuristicRule[] = [
  { pattern: /(fruktig|frukt|bär|berry|plommon|jordgubb|körsbär|tropisk|tropical|svartvinbär|blåbär|hallon|citrus|äpple|päron|persika)/, delta: 1.0 },
  { pattern: /(blommig|aromatisk|aromatic|floral|parfymerad)/, delta: 0.5 },
  { pattern: /(miner(al|ality)|neutral|ört|örtig|jordig|nöt|kryddig|smörig|rostad)/, delta: -0.7 },
];

const ACIDITY_RULES: HeuristicRule[] = [
  { pattern: /(hög\s*syra|frisk|crisp|citron|citrus|lime|äpple|grape|acid(ic)?|spritzy|läskande|pigga\s*syror)/, delta: 1.1 },
  { pattern: /(mjuk|len|rund|låg\s*syra|milda\s*syror|smooth|soft\s*acidity)/, delta: -0.9 },
];

const RULES_BY_KEY: Record<MeterKey, HeuristicRule[]> = {
  sötma: SWEETNESS_RULES,
  fyllighet: BODY_RULES,
  fruktighet: FRUIT_RULES,
  fruktsyra: ACIDITY_RULES,
};

const intensifier = (text: string): number => {
  if (/(mycket|very|extremt|otroligt|intensivt)/.test(text)) return 0.3;
  if (/(något|hint|touch|lite grann)/.test(text)) return -0.2;
  return 0;
};

export function deriveMetersFromText(sourceText: string): SystembolagetMeters {
  const normalized = normalize(sourceText || "");

  return (Object.keys(BASE_VALUES) as MeterKey[]).reduce<SystembolagetMeters>((acc, key) => {
    const base = BASE_VALUES[key];
    const rules = RULES_BY_KEY[key];
    let value = base;

    for (const rule of rules) {
      if ("pattern" in rule) {
        if (rule.pattern.test(normalized)) {
          value += rule.delta;
        }
      } else {
        value += rule.evaluate(normalized);
      }
    }

    value += intensifier(normalized);
    acc[key] = clamp05(value);
    return acc;
  }, { ...BASE_VALUES });
}

export function ensureMetersFromText<T extends { meters?: Partial<SystembolagetMeters> | null } & Record<string, unknown>>(finalData: T): T & {
  meters: SystembolagetMeters;
} {
  const current = finalData?.meters ?? {};
  const meterKeys: MeterKey[] = ["sötma", "fyllighet", "fruktighet", "fruktsyra"];
  const allNullOrMissing = meterKeys.every((key) => current[key] == null);

  const record = finalData as Record<string, unknown>;
  const passar = record["passar_till"];

  const textSource = [
    typeof record["karaktär"] === "string" ? (record["karaktär"] as string) : "",
    typeof record["smak"] === "string" ? (record["smak"] as string) : "",
    typeof record["servering"] === "string" ? (record["servering"] as string) : "",
    Array.isArray(passar) ? passar.filter(Boolean).join(", ") : "",
  ]
    .filter(Boolean)
    .join(" ");

  const derived = deriveMetersFromText(textSource);

  if (allNullOrMissing) {
    return { ...finalData, meters: derived };
  }

  const merged: SystembolagetMeters = {
    sötma: current.sötma ?? derived.sötma,
    fyllighet: current.fyllighet ?? derived.fyllighet,
    fruktighet: current.fruktighet ?? derived.fruktighet,
    fruktsyra: current.fruktsyra ?? derived.fruktsyra,
  } as SystembolagetMeters;

  return { ...finalData, meters: merged };
}
