# analysis_json schema

Alla analyser som sparas i `scans.analysis_json` ska följa en stabil struktur. Fält som saknas i äldre poster fylls med standardvärden i klienten, så UI alltid kan lita på samma nycklar.

```jsonc
{
  "mode": "label_only" | "label+web",          // label_only = bara etikett/heuristik, label+web = verifierad webbkällor
  "confidence": 0.0,                             // 0–1, normaliserad i backend (label_only default 0.4, label+web 0.7)
  "sources": ["https://example.com"],           // webbkällor (rensade http/https-URL:er)
  "summary": "Kort smak/karaktär",
  "grapes": ["Riesling", "Pinot Gris"],        // extraherad från druvsträng eller schemafält
  "style": "Vitt",                              // typ/färg
  "food_pairings": ["skaldjur", "sushi"],
  "warnings": ["fallback: heuristics"]          // valfria varningar
}
```

Standardvärden i klienten:

- `mode`: `label_only`
- `confidence`: `0.4`
- `sources`: `[]`
- `summary`: `""` (faller tillbaka till `karaktär`/`smak`)
- `grapes`: tom lista eller parsade från `druvor`
- `style`: `typ`/`färgtyp` eller `null`
- `food_pairings`: `passar_till` eller tom lista
- `warnings`: `[]`

Backend (Gemini/OpenAI-funktionen) fyller ovan fält när en ny analys skapas, så nya poster följer schemat utan specialfall i UI.
