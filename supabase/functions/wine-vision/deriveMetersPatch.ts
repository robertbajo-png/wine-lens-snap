// Auto-generate meter values (0–5) from descriptive text
export function deriveMetersFromText(sourceText: string) {
  const t = (sourceText || "").toLowerCase();
  let sötma = 2.0, fyllighet = 2.5, fruktighet = 2.6, fruktsyra = 2.6;

  if (/dessert|asz[uú]|sweet|dolce|late\s*harvest|passito|ice\s*wine|tokaji|sött/.test(t)) sötma = 4.2;
  else if (/halvtorr|halvsöt|off[-\s]?dry|semi[-\s]?(sec|seco|sweet)|amabile|lieblich/.test(t)) sötma = 3.0;
  else if (/torr|dry|crisp|miner(al|ality)/.test(t)) sötma = 1.2;

  if (/kraftfull|fyllig|full[-\s]?bodied|barrique|amarone|cabernet|syrah|shiraz|malbec|reserva/.test(t)) fyllighet = 4.3;
  else if (/lätt|elegant|frisk|spritsig|pinot\s+noir|riesling|vinho\s+verde/.test(t)) fyllighet = 1.8;

  if (/fruktig|berry|bär|plommon|jordgubb|körsbär|cherry|tropical|svartvinbär|blåbär/.test(t)) fruktighet = 3.8;
  else if (/miner(al|ality)|neutral|ört|örtig/.test(t)) fruktighet = 2.0;

  if (/hög\s*syra|frisk|crisp|citron|citrus|äpple|acid(ic)?/.test(t)) fruktsyra = 3.8;
  else if (/mjuk|len|smooth|rund/.test(t)) fruktsyra = 2.0;

  const clamp05 = (n: number) => Math.max(0, Math.min(5, Math.round(n * 10) / 10));
  return { sötma: clamp05(sötma), fyllighet: clamp05(fyllighet), fruktighet: clamp05(fruktighet), fruktsyra: clamp05(fruktsyra) };
}

export function ensureMetersFromText(finalData: any) {
  const current = finalData?.meters || {};
  const allNullOrMissing = !current || ['sötma','fyllighet','fruktighet','fruktsyra'].every(k => current[k] == null);

  const textSource = [
    finalData?.karaktär || '',
    finalData?.smak || '',
    finalData?.servering || '',
    Array.isArray(finalData?.passar_till) ? finalData.passar_till.join(', ') : ''
  ].join(' ');

  const derived = deriveMetersFromText(textSource);

  if (allNullOrMissing) { finalData.meters = derived; return finalData; }

  finalData.meters = {
    sötma:      current.sötma      ?? derived.sötma,
    fyllighet:  current.fyllighet  ?? derived.fyllighet,
    fruktighet: current.fruktighet ?? derived.fruktighet,
    fruktsyra:  current.fruktsyra  ?? derived.fruktsyra
  };
  return finalData;
}
