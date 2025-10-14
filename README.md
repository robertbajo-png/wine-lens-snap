# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Open the repository in a Dev Container**

If you are using VS Code (or any editor that supports the [Dev Containers specification](https://containers.dev/)), you can open this project inside the provided `.devcontainer` setup. It uses the official TypeScript + Node base image so Node.js **and npm** are preinstalled in the container environment. After the container finishes building it will automatically run `npm install`, leaving you ready to start developing immediately.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/7c997ef9-6c8c-47c3-93ab-2c2355eb827e) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Hur kan jag testa appen?

Följ stegen nedan för att köra och testa WineSnap lokalt:

1. **Installera beroenden**
   ```sh
   npm install
   ```

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

### Testa användargränssnittet steg-för-steg

När utvecklingsservern körs kan du följa checklistan nedan för att verifiera gränssnittet och de viktigaste flödena:

1. **Landningssidan** – Besök `http://localhost:5173/` och kontrollera att hero-sektionen, call-to-action och bakgrundsgradienterna renderas korrekt i både mobil- och desktop-bredd (justera med devtools).
2. **Starta en skanning** – Klicka på knapparna "Starta WineSnap" eller "Ny skanning" och säkerställ att du hamnar på `/winesnap`. Där kan du ladda upp en bild (t.ex. valfri JPEG) och bekräfta att resultatkortet renderas när analysen är klar.
3. **Historikvy** – Navigera till `/historik` via länken "Sparade analyser" i sidhuvudet. Kontrollera att statistik-korten, listan med sparade analyser och tomt-läge ser korrekta ut.
4. **Interaktioner** – Öppna dialogen "Visa detaljer" på en sparad analys, testa knappen "Ta bort" samt "Ny skanning" för att säkerställa att alla knappar och länkar svarar.
5. **Responsivitet** – Använd webbläsarens verktyg för att testa i flera brytpunkter (320px, 768px, 1024px) och verifiera att layouten anpassas utan visuella buggar.

#### Snabbt fylla historiken med testdata

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

### Miljövariabler

Supabase-klienten använder följande variabler i en `.env`-fil (skapa filen i projektroten vid behov):

```
VITE_SUPABASE_URL=<din-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<din-supabase-nyckel>
```

När variablerna är satta kommer autentisering och datahämtning att fungera som förväntat i utvecklingsmiljön.
