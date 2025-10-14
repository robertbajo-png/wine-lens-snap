# 🍷 WineSnap – Självlärande vinanalys med Supabase + AI

WineSnap kombinerar Supabase, Tesseract OCR och GPT för att identifiera vinflaskor på sekunder. Den lokala cachen gör att appen **lär sig av tidigare sökningar** och blir snabbare och smartare över tid – perfekt både för den som bygger vidare och den som bara vill ta en bild och få svar.

Nedan hittar du en **svensk steg-för-steg-guide** för utveckling, test och Supabase-konfiguration samt ett **engelskt quickstart-avsnitt** från Lovable-projektet. Informationen är sammanfogad för att undvika framtida mergekonflikter mellan dokumentationen i reposet och innehållet som publiceras via Lovable.

---

## 🧩 1️⃣ Databasstruktur (Supabase)

Kör följande SQL i din Supabase SQL Editor för att skapa den cache-tabell som WineSnap använder vid analyser:

```sql
create table if not exists winesnap_cache (
  key text primary key,
  ocr_text text,
  data jsonb,
  hits integer default 0,
  embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_winesnap_embedding
  on winesnap_cache using ivfflat (embedding vector_cosine_ops);
```

> 💡 Kom ihåg att aktivera den vektorbaserade funktionen i Supabase-projektet (under **Database > Extensions**) om den inte redan är påslagen.

---

## 🛠️ Lokal utveckling

Följ stegen nedan för att köra och testa WineSnap lokalt:

1. **Installera beroenden**
   ```sh
   npm install
   ```

   > ℹ️ Om du använder en miljö där `npm` har en proxy-konfiguration i `.npmrc` kan du se varningen `Unknown env config "http-proxy"`. Det är en känd avisering i npm v10 och påverkar inte installationen av beroenden.

2. **Starta utvecklingsservern** för att testa funktioner interaktivt. Servern körs på `http://localhost:5173/` som standard.
   ```sh
   npm run dev
   ```

3. **Kör byggsteget** om du vill säkerställa att projektet kompilerar utan fel.
   ```sh
   npm run build
   ```

4. **Förhandsgranska produktionsbuilden** med en lokal server.
   ```sh
   npm run preview
   ```

5. **Kvalitetssäkra koden** genom att köra ESLint (observera att det kan finnas befintliga varningar/fel som behöver åtgärdas).
   ```sh
   npm run lint
   ```

### 📦 Dev Container (rekommenderat)

Om du använder VS Code – eller en editor som stödjer [Dev Containers-specifikationen](https://containers.dev/) – finns en färdig `.devcontainer`-konfiguration.

- Node.js **och npm** är förinstallerade.
- `npm install` körs automatiskt när containern startar första gången.
- Miljön matchar projektets versionskrav så att du slipper lokala avvikelser.

Öppna projektet i Dev Container genom att välja **“Reopen in Container”** när prompten visas.

### 💻 Andra sätt att arbeta

**Använd Lovable**  
Besök [Lovable-projektet](https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e) för att fortsätta iterera via promptar – ändringar som görs där commit:as automatiskt hit.

**Arbeta i din egen IDE**  
Klona repot, öppna det i valfri editor och följ stegen ovan för att installera beroenden och starta dev-servern.

**Redigera direkt på GitHub**  
Navigera till filen, klicka på pennikonen, gör dina ändringar och skapa en commit.

**Använd GitHub Codespaces**  
Starta en ny codespace från GitHub → Code → Codespaces för att jobba molnbaserat utan lokal setup.

---

## ⬆️ Så pushar du ändringar

1. **Kontrollera vilka filer som är ändrade**
   ```sh
   git status
   ```

2. **Lägg till filerna du vill committa**
   ```sh
   git add <fil1> <fil2>
   # eller för att inkludera alla ändringar
   git add .
   ```

3. **Skapa en commit med en tydlig beskrivning**
   ```sh
   git commit -m "Beskriv vad som ändrats"
   ```

4. **Skicka upp ändringarna till GitHub**
   ```sh
   git push origin <din-branch>
   ```

5. **Öppna en Pull Request** (om du arbetar på en feature-branch)
   - Gå till GitHub-repot i webbläsaren.
   - Klicka på bannern "Compare & pull request" eller skapa en ny PR manuellt.
   - Beskriv ändringarna och skicka in PR:en för granskning.

> 💡 Om du arbetar direkt på `main` och har rättigheter att pusha dit kan du hoppa över PR-steget, men det rekommenderas att använda feature-brancher och PR:er för bättre spårbarhet.

---

## 🔀 Lösa mergekonflikter

Om GitHub varnar för mergekonflikter när du öppnar en PR betyder det att någon annan har uppdaterat samma filer som du. Så här löser du det lokalt:

1. **Se till att du har en ren arbetsyta**
   ```sh
   git status
   ```
   Om filer är modifierade – committa dem eller stash:a innan du fortsätter.

2. **Hämta senaste ändringarna från `main`**
   ```sh
   git fetch origin
   git checkout <din-branch>
   git merge origin/main
   ```
   Git stoppar vid varje konflikt och markerar dem med `<<<<<<<`, `=======` och `>>>>>>>` i filerna.

3. **Öppna de markerade filerna och bestäm vad som ska behållas**
   - Läs igenom både din version och `main`-versionen.
   - Kombinera innehållet manuellt eller ta den variant som passar.
   - Ta bort konfliktmarkörerna när du är nöjd.

4. **Verifiera att du inte missade någon konflikt**
   ```sh
   rg '<<<<<<<'
   ```
   Kommandot ska inte hitta något när alla konflikter är lösta.

5. **Kör testerna och bygg projektet**
   ```sh
   npm run build
   ```
   Säkerställ att allt fortfarande fungerar efter hopslagningen.

6. **Commit:a de lösta konflikterna och fortsätt arbetet**
   ```sh
   git add <fil1> <fil2>
   git commit --no-edit
   git push
   ```

---

## 🌍 English quickstart (Lovable)

The following section mirrors the Lovable project README so att team som följer den engelska dokumentationen slipper konflikter när filer uppdateras automatiskt från plattformen.

### Project info

**URL**: https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e

### How can I edit this code?

There are several ways of editing your application.

**Use Lovable** – simply visit the [Lovable Project](https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e) and start prompting. Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE** – clone the repo locally, install Node.js & npm (for example via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)), install dependencies with `npm i` and start the dev server with `npm run dev`.

**Edit directly on GitHub** – open the file, click the pencil icon, make your edits and commit.

**Use GitHub Codespaces** – launch a codespace from the **Code → Codespaces** menu on GitHub, edit the files online and push your commits when you're done.

### What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### How can I deploy this project?

Open the [Lovable project](https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e) and click **Share → Publish**.

### Custom domain support

You can connect a domain under **Project → Settings → Domains** in Lovable. Read more in the [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain) guide.
   Använd `--no-edit` om du vill behålla den automatiska merge-committexten.

> 💡 Tips: Om du ofta får konflikter i `README.md` eller i sidfiler som `src/pages/Index.tsx`, fundera på att bryta ut gemensamma komponenter. Då blir överlappen mindre och framtida merge:ar enklare.

---

## 🧪 Manuell testning av gränssnittet

När utvecklingsservern körs kan du följa checklistan nedan för att verifiera gränssnittet och de viktigaste flödena:

1. **Landningssidan** – Besök `http://localhost:5173/` och kontrollera att hero-sektionen, call-to-action och bakgrundsgradienterna renderas korrekt i både mobil- och desktop-bredd (justera med devtools).
2. **Starta en skanning** – Klicka på knapparna "Starta WineSnap" eller "Ny skanning" och säkerställ att du hamnar på `/winesnap`. Där kan du ladda upp en bild (t.ex. valfri JPEG) och bekräfta att resultatkortet renderas när analysen är klar.
3. **Historikvy** – Navigera till `/historik` via länken "Sparade analyser" i sidhuvudet. Kontrollera att statistik-korten, listan med sparade analyser och tomt-läge ser korrekta ut.
4. **Interaktioner** – Öppna dialogen "Visa detaljer" på en sparad analys, testa knappen "Ta bort" samt "Ny skanning" för att säkerställa att alla knappar och länkar svarar.
5. **Responsivitet** – Använd webbläsarens verktyg för att testa i flera brytpunkter (320px, 768px, 1024px) och verifiera att layouten anpassas utan visuella buggar.

### ⚙️ Snabbt fylla historiken med testdata

Det finns två enkla sätt att fylla historiken inför manuella tester:

1. **Använd det inbyggda testverktyget** – Öppna sidan `Sparade analyser` och klicka på knappen **"Testverktyg"** uppe till höger. Där kan du fylla listan med tre demoposter eller rensa bort sparade analyser med ett klick.
2. **Via webbläsarkonsolen** – Om du föredrar att styra exakt vad som sparas kan du köra skriptet nedan medan historiksidan är öppen:

```js
localStorage.setItem(
  "wine_analysis_manualtest",
  JSON.stringify({
    version: 1,
    timestamp: new Date().toISOString(),
    imageData: "",
    result: {
      vin: "Testvin Rosso",
      land_region: "Italien, Toscana",
      producent: "Cantina Demo",
      druvor: "Sangiovese",
      årgång: "2020",
      typ: "Rött vin",
      färgtyp: "Rött",
      klassificering: "DOCG",
      alkoholhalt: "13%",
      volym: "750 ml",
      karaktär: "Fruktigt och balanserat",
      smak: "Körsbär, plommon och mjuka tanniner",
      passar_till: ["Pasta", "Grillat", "Ost"],
      servering: "16-18°C",
      sockerhalt: "Torr",
      syra: "Medel",
      källa: "Manuellt test",
      meters: {
        sötma: 2,
        fyllighet: 4,
        fruktighet: 3,
        fruktsyra: 3,
      },
      evidence: {
        etiketttext: "WineSnap demoetikett",
        webbträffar: ["https://example.com"],
      },
      detekterat_språk: "sv",
      originaltext: "Testetikett för WineSnap",
    },
  })
);
```

Uppdatera sedan historiksidan (F5) för att se posterna. Ta bort testdatan via **Testverktyg → Rensa historiken**, genom att klicka på "Ta bort" vid respektive post eller genom att rensa `localStorage` manuellt.

---

## 🌐 Miljövariabler

Supabase-klienten använder följande variabler i en `.env`-fil (skapa filen i projektroten vid behov):

```
VITE_SUPABASE_URL=<din-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<din-supabase-nyckel>
```

När variablerna är satta kommer autentisering och datahämtning att fungera som förväntat i utvecklingsmiljön.

---

## 🚀 Publicering & nästa steg

- Publicera via [Lovable](https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e) genom att klicka på **Share → Publish**.
- För att koppla en egen domän: gå till **Project > Settings > Domains** och följ guiden [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain).
- Fortsätt iterera på UI:t, förbättra AI-modellen och lägg gärna till fler Supabase-tabeller (t.ex. användarprofiler eller smaknoteringar) efter behov.

