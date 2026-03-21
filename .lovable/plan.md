

# Releaseplan – WineSnap

## Status: Nästan redo
Appen har fungerande scanning, historik, profil, auth (magic link + Google), PWA med service worker, dark/light-tema och i18n. Databasschema med RLS finns. Nedan listas kvarvarande punkter innan release.

---

## 1. OG-bild och sociala metadata
**Problem:** `og:image` och `twitter:image` pekar på Lovables standard-bild (`lovable.dev/opengraph-image-p98pqg.png`), inte WineSnap-branding.
**Åtgärd:** Skapa en egen OG-bild (1200×630) och uppdatera `index.html` rad 23 och 27.

## 2. RLS-policy med `USING (true)` på skrivoperationer
**Problem:** Databaslinter varnar för minst en tabell med `USING (true)` på INSERT/UPDATE/DELETE – potentiellt öppen för alla.
**Åtgärd:** Identifiera vilken tabell det gäller och strama åt policyn till `auth.uid()`.

## 3. Leaked password protection
**Problem:** Lösenordsläckageskydd (HaveIBeenPwned-check) är inaktiverat. Appen använder magic link/Google men detta bör aktiveras om lösenord läggs till.
**Åtgärd:** Kan ignoreras för release om appen enbart erbjuder magic link + OAuth. Dokumentera beslutet.

## 4. Premium-flagga är hårdkodad
**Problem:** `useUserSettings.ts` har en TODO som visar att premium-check är bortkopplad och returnerar ett hårdkodat värde.
**Åtgärd:** Bestäm om premium-funktionalitet ska vara med i release. Om inte, rensa bort premium-UI:t. Om ja, koppla tillbaka premiumlogiken.

## 5. Felhantering – edge case vid stor fil
**Problem:** `WineSnap.tsx` har `MAX_FILE_SIZE_BYTES = 10 MB` men det behöver verifieras att felmeddelande visas snyggt för användaren vid överskridande.
**Åtgärd:** Testa flödet med en fil >10 MB och bekräfta att meddelandet visas korrekt.

## 6. Integritetstänk (GDPR-yta)
**Problem:** `device_id` genereras och sparas utan explicit samtycke. Ingen synlig integritetspolicy länkas i appen.
**Åtgärd:** Lägg till länk till integritetspolicy i login-vy och/eller About-sida. Minimalt: en kort text som förklarar vilken data som sparas.

## 7. Smoke-test på alla routes
Kör igenom alla routes manuellt och verifiera att inget kraschar:
`/`, `/scan`, `/for-you`, `/explore`, `/me`, `/me/wines`, `/login`, `/om`, `/wine/:id`, `/404`

---

## Prioritetsordning
| # | Uppgift | Svårighet | Kritisk? |
|---|---------|-----------|----------|
| 1 | OG-bild | Lätt | Ja |
| 2 | RLS-policy | Medel | Ja |
| 3 | Password protection | Trivial | Nej (magic link) |
| 4 | Premium TODO | Lätt | Nej |
| 5 | Stor fil-test | Trivial | Nej |
| 6 | GDPR/integritet | Medel | Ja |
| 7 | Smoke-test | Lätt | Ja |

