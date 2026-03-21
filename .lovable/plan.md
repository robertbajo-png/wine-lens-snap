
# Releaseplan – WineSnap

## Alla punkter klara ✅

1. ✅ **OG-bild** – Egen bild (`public/og-image.png`), `index.html` uppdaterad.
2. ✅ **RLS-policy** – `event_logs` INSERT begränsad till `TO authenticated`.
3. ✅ **GDPR/integritet** – Datainformation på About-sida + samtycketext på Login.
4. ✅ **Premium-flagga** – Återkopplad till riktig DB-check i `useUserSettings.ts`.
5. ✅ **Stor fil-hantering** – Verifierat: felmeddelande visas korrekt vid fil >10 MB.
6. ✅ **Leaked password** – Accepterad risk, appen använder enbart magic link + Google OAuth.

## Kvarstår manuellt
7. 🔲 **Smoke-test** – Testa alla routes manuellt: `/`, `/scan`, `/for-you`, `/explore`, `/me`, `/login`, `/om`
