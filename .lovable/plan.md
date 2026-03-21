

# Releaseplan – WineSnap

## Klart ✅
1. **OG-bild** – Egen bild genererad (`public/og-image.png`), `index.html` uppdaterad.
2. **RLS-policy** – `event_logs` INSERT begränsad till `TO authenticated`.
3. **GDPR/integritet** – Datainformation tillagd på About-sida och samtycketext på Login.

## Kvarvarande (ej kritiska)
4. **Premium-flagga** – `useUserSettings.ts` returnerar `isPremium: true` hårdkodat. Bestäm om premium ska vara med i release.
5. **Stor fil-test** – Verifiera felmeddelande vid fil >10 MB i WineSnap.tsx.
6. **Smoke-test** – Kör igenom alla routes manuellt.

## Accepterade risker
- **Leaked password protection** – Inte relevant, appen använder magic link + Google OAuth.
- **event_logs `WITH CHECK (true)`** – Begränsad till `TO authenticated`, acceptabelt för telemetri.
