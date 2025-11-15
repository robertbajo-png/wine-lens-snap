# QA-checklista

Kort checklista för manuell regressionstestning av WineSnap.

## Primära flöden

- [ ] **Skanning:** Starta en skanning via WineSnap-fliken, välj bild och bekräfta att progressindikatorn uppdateras och resultat/varningar visas.
- [ ] **Cachad analys:** Skanna samma vin igen och säkerställ att resultatet laddas från cache med banner.
- [ ] **Historik:** Öppna historiksidan, kontrollera att sparade poster listas och att dialogen för testverktyg fungerar.
- [ ] **Profil:** Öppna profilsidan, uppdatera språk, tema och notisinställningar och verifiera att växlarna behåller valen efter omladdning.
- [ ] **Navigation:** Byt mellan samtliga bottentabber och säkerställ att rätt vy och scrollposition återställs.

## Tillgänglighet

- [ ] Bekräfta att samtliga interaktiva komponenter har beskrivande `aria-label` eller synlig text.
- [ ] Kör en färgkontrastkontroll (t.ex. via [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)) för primära färgkombinationer: bakgrund/mot text, knappar och länkar.
- [ ] Testa tabb-navigering genom huvudflöden (skanning, historik, profil) och säkerställ att fokusmarkering är synlig.

Dokumentet ska uppdateras när nya flöden eller komponenter tillkommer.
