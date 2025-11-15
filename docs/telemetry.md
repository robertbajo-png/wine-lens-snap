# Telemetrievent

WineSnap loggar en uppsättning minimala telemetrievent via `trackEvent` i `src/lib/telemetry.ts`. Händelserna skrivs både till webbkonsolen och till Supabase-tabellen `telemetry_events`, vilket gör det enkelt att köra saved queries och dashboards i efterhand.

## Eventöversikt

| Event | När triggas det? | Nyttolast |
| --- | --- | --- |
| `tab_select` | När användaren byter tabb i bottmennyn. | `tab` (måltabb), `from` (föregående tabb om känd), `targetPath` (rutt som öppnas). |
| `scan_start` | När en skanning startar i WineSnap. | `trigger` (`camera`, `auto` eller `upload`), `hasSource` (om bildkälla finns), `retried` (om skanningen startades på en befintlig bild). |
| `scan_success` | När en skanning slutförs utan fel, oavsett om resultatet kom från cache eller ny analys. | `source` (`cache`, `analysis` eller backendnotering), `noTextFound` (om OCR hittade lite eller ingen text). |
| `scan_fail` | När bildanalysen misslyckas. | `reason` (felsymtom som visas för användaren), `name` (feltyp om tillgänglig). |
| `history_open` | När historiksidan visas och datan har laddats. | `entries` (antalet synliga poster). |
| `profile_open` | När profilsidan öppnas första gången i en session. | `language`, `theme`, `notificationsEnabled` (aktuella inställningar). |
| `explore_opened` | När Explore-sidan visas första gången under en session. | `hasUser`, `personalScanCount`, `curatedScanCount`, `quickFilterCount`, `seedLibrarySource`. |
| `explore_filter_changed` | När snabbfilter eller sökparametrar ändras. | `source` (`quick`, `manual`, `clear_all`), `field`, `value`, `quickFilterId`, `filters` (hela filteruppsättningen), `filterCount`, `manualFiltersActive`, `cleared` (om ett fält tömdes). |
| `explore_scan_opened` | När en kuraterad eller personlig skanning öppnas från Explore. | `scanId`, `source` (`mine` eller `curated`), `manualFiltersActive`, `quickFilterId`. |
| `explore_new_scan_cta_clicked` | När CTA:n "Ny skanning" klickas från Explore. | `manualFiltersActive`, `activeFilterCount`, `quickFilterId`, `personalScanCount`. |

## Loggning

Alla event hamnar i webbkonsolen med prefixet `[telemetry]` samt tidsstämpel i ISO-format. I utvecklingsläge används `console.info`, annars `console.log`. I bakgrunden buffras eventen asynkront till `telemetry_events` utan att blockera UI-tråden.

## Utökning

Nya event definieras genom att:

1. Lägga till namnet i unionstypen `TelemetryEventName` i `src/lib/telemetry.ts`.
2. Beskriva nyttolastfältet i tabellen ovan.
3. Anropa `trackEvent` från relevant komponent.

För avancerad telemetri kan `trackEvent` kompletteras med nätverksanrop eller buffring utan att ändra anropande kod.
