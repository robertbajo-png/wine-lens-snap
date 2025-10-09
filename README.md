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

### Miljövariabler

Supabase-klienten använder följande variabler i en `.env`-fil (skapa filen i projektroten vid behov):

```
VITE_SUPABASE_URL=<din-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<din-supabase-nyckel>
```

När variablerna är satta kommer autentisering och datahämtning att fungera som förväntat i utvecklingsmiljön.
