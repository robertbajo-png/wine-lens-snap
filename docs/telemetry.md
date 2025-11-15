# Telemetrievent

WineSnap loggar en uppsättning minimala telemetrievent till konsolen via `trackEvent` i `src/lib/telemetry.ts`. Händelserna kan enkelt bytas ut mot en annan transport om vi i framtiden vill skicka dem till ett externt system.

## Eventöversikt

| Event | När triggas det? | Nyttolast |
| --- | --- | --- |
| `tab_select` | När användaren byter tabb i bottmennyn. | `tab` (måltabb), `from` (föregående tabb om känd), `targetPath` (rutt som öppnas). |
| `scan_start` | När en skanning startar i WineSnap. | `trigger` (`camera`, `auto` eller `upload`), `hasSource` (om bildkälla finns), `retried` (om skanningen startades på en befintlig bild). |
| `scan_success` | När en skanning slutförs utan fel, oavsett om resultatet kom från cache eller ny analys. | `source` (`cache`, `analysis` eller backendnotering), `noTextFound` (om OCR hittade lite eller ingen text). |
| `scan_fail` | När bildanalysen misslyckas. | `reason` (felsymtom som visas för användaren), `name` (feltyp om tillgänglig). |
| `history_open` | När historiksidan visas och datan har laddats. | `entries` (antalet synliga poster). |
| `profile_open` | När profilsidan öppnas första gången i en session. | `language`, `theme`, `notificationsEnabled` (aktuella inställningar). |

## Loggning

Alla event hamnar i webbkonsolen med prefixet `[telemetry]` samt tidsstämpel i ISO-format. I utvecklingsläge används `console.info`, annars `console.log`.

## Utökning

Nya event definieras genom att:

1. Lägga till namnet i unionstypen `TelemetryEventName` i `src/lib/telemetry.ts`.
2. Beskriva nyttolastfältet i tabellen ovan.
3. Anropa `trackEvent` från relevant komponent.

För avancerad telemetri kan `trackEvent` kompletteras med nätverksanrop eller buffring utan att ändra anropande kod.
