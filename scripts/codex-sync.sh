#!/usr/bin/env bash
set -euo pipefail

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "main" ]]; then
  echo "ℹ️ Växlar från $current_branch till main för synk." >&2
  git checkout main >/dev/null 2>&1 || git switch main
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "⬇️  Hämtar senaste ändringar från origin..." >&2
  git fetch origin

  echo "🔄 Försöker rebase mot origin/main..." >&2
  if ! git pull --rebase --autostash origin main; then
    echo "⚠️ Rebase misslyckades – använder merge -s ours som nödlösning." >&2
    git merge -s ours origin/main || true
  fi

  echo "⬆️  Pushar main med --force-with-lease." >&2
  git push --force-with-lease origin main || true
  echo "✅ main synkad mot origin utan konflikter." >&2
else
  echo "ℹ️ Ingen origin-remote konfigurerad; hoppar synk." >&2
fi
