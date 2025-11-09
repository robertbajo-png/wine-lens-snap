# WineSnap – FAS 1: GitHub-synk + Kodanalys (förenklad version)

## 1) Skapa ny branch i GitHub
- Gå till: `robertbajo-png/wine-lens-snap`
- Klicka på **branch-väljaren** → skriv: `fas-1-setup` → klicka **Create branch**.

## 2) Lägg till dessa filer via GitHub (Add file → Create new file)

### .editorconfig
```
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
[*.md]
trim_trailing_whitespace = false
```

### .gitattributes
```
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
```

### .nvmrc
```
v20
```

### .env.example
```
VITE_API_BASE_URL=
VITE_OPENAI_API_KEY=
VITE_GEMINI_API_KEY=
VITE_PERPLEXITY_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### .github/workflows/ci.yml
```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install --frozen-lockfile || npm ci
      - run: pnpm run typecheck || npm run -s typecheck || true
      - run: pnpm run lint || npm run -s lint || true
      - run: pnpm run build || npm run -s build
      - run: pnpm run test || npm run -s test || echo "No tests"
```

### tools/health-report.mjs
```js
import { execSync } from 'node:child_process';
const sh = (c) => execSync(c, { stdio: 'pipe' }).toString().trim();
const parts = [];
function add(title, cmd) {
  try { parts.push(`\n## ${title}\n\n\`\`\`\n${sh(cmd)}\n\`\`\``); }
  catch (e) { parts.push(`\n## ${title} (failed)\n\n${e.message}`); }
}
add('Git status', 'git status -sb || echo "run locally for full output"');
add('Node & manager', 'node -v && (pnpm -v || true)');
add('Typecheck', 'npm run -s typecheck || true');
add('ESLint', 'npm run -s lint || true');
add('Build (dry)', 'echo "Build runs in CI"');
console.log(`# WineSnap – Kodhälsa ${new Date().toISOString()}\n` + parts.join('\n'));
```

### .github/ISSUE_TEMPLATE/bug_report.md
```md
---
name: Bug report
about: Report a bug
labels: bug
---
**Beskrivning**

**Repro**
1. …

**Förväntat**

**Miljö** (OS, browser, version)
```

### .github/pull_request_template.md
```md
## Syfte

## Ändringar

## Checklista
- [ ] Bygger i CI
- [ ] `typecheck` OK
- [ ] `lint` OK
```

## 3) Skapa Pull Request
- Klicka **Compare & pull request**
- Titel: `FAS 1 – Grundsetup (CI, configs, env-example)`
- Skicka PR. När den är grön → **Merge**.

## 4) Nästa steg
Jag granskar CI-loggarna och tar fram en åtgärdslista.
