# Final design QA – dark mode

## Scope
- Samtliga pages och modaler i appen (se listor nedan).
- Fokus på dark-mode-regressioner: kontrast, hover/focus, spacing, klippning, fel färger.

## Testmiljöer och breakpoints
- iOS (Safari): 390×844, 430×932.
- Android (Chrome): 360×800, 412×915.
- Desktop (Chrome/Firefox): 1280×800, 1440×900, 1920×1080.

## Pages som ingår
- `/` (WineSnap start/scan)
- `/for-you`
- `/explore`
- `/history`
- `/me`
- `/about`
- `/login`
- `/login/callback`
- `/wine/:id` (WineDetail)
- `/404` (NotFound)

## Modaler och dialogs som ingår
- ImageModal (zoom av bild i scan-resultat)
- Förfina resultat (Refine dialog)
- Analys-feedback ("Berätta vad som inte stämmer")
- Skapa lista (Wine list dialog)
- Edit profile (Me → profilredigering)
- Dev/test tools (History → testverktyg)

## QA-checklista (dark mode)
- Text och rubriker: ingen text försvinner mot bakgrund.
- Spacing/marginaler: inga överlapp eller layoutglapp.
- Listor/kort: inga avklippta texter, korrekt padding.
- Knappar: disabled/hover/focus/active har tydlig state.
- Badges/ikoner: synliga i dark mode, korrekt padding.
- Modaler: overlay/close-knapp synliga, scroll/centering OK.
- Formfält: placeholder/label/validation har korrekt kontrast.
- Tomtillstånd: läsbara och korrekt kontrast.

## Resultat
- Inga visuella regressioner hittades i dark mode på listade pages/modaler.
- Hover/focus states och kontraster upplevs konsekventa mellan breakpoints.

## Eventuella regressions/tickets
- Inga nya regressioner noterade i detta pass.

## Design freeze
Från och med detta QA-pass gäller **design freeze**:
- Inga fler stilmixar eller visuella omtag.
- Endast små, riktade bugfixar för regressions accepteras.
- Alla designändringar efter detta kräver explicit godkännande.
