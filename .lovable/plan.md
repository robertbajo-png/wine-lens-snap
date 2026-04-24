## Mål
Ta reda på exakt vad Perplexity och Gemini Vision returnerar i `wine-vision`-funktionen, så vi kan förstå varför resultat klassas som `label_only` trots att webbsökning körs.

## Bakgrund
- `wine-vision` accepterar **inte** ren OCR-text — den kräver `imageBase64` (en riktig vinetikettbild). Funktionen kör först Gemini Vision för OCR, sedan parallellt Perplexity (web) + Gemini Vision (label) via `parallelWeb()`.
- Klassificeringen `label_only` triggas på rad 813 i `index.ts` när `sources.length === 0`, dvs. när inga giltiga `http(s)`-URL:er hittas i `evidence_links`.
- För att se faktiska råsvar krävs antingen ett anrop med en riktig bild eller inspektion av loggar från en användarskanning.

## Tillvägagångssätt (3 steg)

### Steg 1 — Lägg till diagnostisk loggning (tillfälligt)
Utöka `parallelWeb()` och Perplexity-anropet i `supabase/functions/wine-vision/index.ts` med kompakta `console.log`-rader som dumpar:
- Perplexity: `pplx_status`, antal `citations`, första 500 tecken av råsvaret, antal extraherade web-URL:er
- Gemini Vision: status, antal `evidence.items`, om `webbträffar`-arrayen innehåller URL:er
- Slutgiltig `mode`-bestämning: vilka URL:er som faktiskt hamnade i `sources` (eller varför listan är tom)

Loggarna prefixas `[diag]` så de är lätta att filtrera bort senare.

### Steg 2 — Kör testanrop med en riktig vinetikettbild
Använd `supabase--curl_edge_functions` mot `/wine-vision` med:
```json
{
  "imageBase64": "<base64 av en känd vinetikett, t.ex. Barolo eller Tokaji>",
  "skipCache": true,
  "labelOnly": false
}
```
Vi använder en publik vinetikettbild (hämtas via `code--fetch_website` som screenshot eller bas64-kodas från en testbild i `public/`).

### Steg 3 — Läs `supabase--edge_function_logs` för `wine-vision`
Filtrera på `[diag]`-prefixet och sammanställ:
- Returnerar Perplexity faktiska URL:er i `citations`-fältet?
- Filtreras URL:erna bort av `.filter(url => url.startsWith("http"))` i `aiClient.ts`?
- Hamnar Perplexity-data i `webbträffar` men utan att citations-arrayen fylls?
- Är det timeout (`pplx_status === "timeout"`) som sker oftast?

## Tekniska detaljer
- Filer som rörs:
  - `supabase/functions/wine-vision/index.ts` — diagnostisk loggning runt rad 813 (mode-bestämning), rad 2025–2068 (parallelWeb-resultat) och i `parallelWeb()` självt.
  - Inga schemaändringar, ingen frontend-påverkan.
- Loggraderna är `console.log` och syns direkt i edge function logs.
- Efter analys (separat steg, ej en del av denna plan) tar vi bort `[diag]`-loggarna eller flyttar dem bakom en `DEBUG`-flagga.

## Vad denna plan **inte** gör
- Den ändrar inte logiken som klassar resultat som `label_only`. Det är ett separat fix som bör göras först **efter** att vi sett rådata och vet om problemet är (a) Perplexity returnerar tomt, (b) URL:erna filtreras bort felaktigt, eller (c) timeout.

## Resultat
Efter att planen körts har vi konkret bevis för varför `label_only` triggas, och kan föreslå rätt fix (justera filter, höja timeout, eller räkna Perplexity-data som "web" även utan citations).
