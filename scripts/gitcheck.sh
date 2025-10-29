#!/usr/bin/env bash
set -euo pipefail

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "main" ]]; then
  echo "❌ gitcheck måste köras på main (nu: $current_branch)" >&2
  exit 1
fi

status_output=$(git status --short)

echo "🔍 Gitstatus inför commit:" >&2
if [[ -n "$status_output" ]]; then
  printf '%s\n' "$status_output"
else
  echo "(rent arbetskatalog)"
fi

if [[ -z "$status_output" ]]; then
  echo "✅ Arbetskatalogen är ren." >&2
else
  echo "⚠️ Granska listan ovan – städa eller committa innan du fortsätter." >&2
fi

if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  ahead=$(git rev-list --count @{u}..HEAD)
  behind=$(git rev-list --count HEAD..@{u})
  echo "🔁 Upstream-status: $ahead commits före, $behind commits efter @{u}." >&2
  if (( behind > 0 )); then
    echo "⚠️ Kör 'git pull --rebase --autostash' innan commit för att uppdatera main." >&2
  fi
else
  echo "ℹ️ Ingen upstream för main konfigurerad; hoppar upstream-kontroll." >&2
fi

echo "✅ gitcheck klar." >&2
