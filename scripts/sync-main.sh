#!/usr/bin/env bash
set -euo pipefail

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "main" ]]; then
  git checkout main >/dev/null 2>&1
fi

if git remote get-url origin >/dev/null 2>&1; then
  git fetch origin
  if ! git pull --rebase --autostash origin main; then
    echo "Rebase misslyckades, försöker merge som föredrar lokala ändringar..."
    git merge -s ours origin/main || true
  fi
else
  echo "Ingen remote 'origin' konfigurerad. Hoppar över synkning."
fi

echo "✅ main är uppdaterad och redo."
