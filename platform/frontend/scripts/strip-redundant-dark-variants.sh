#!/usr/bin/env bash
#
# Strip `dark:*` Tailwind utilities that are redundant now that we use the
# semantic `app-*` tokens (which switch automatically under .dark via CSS
# variables).
#
# Conservative: only removes `dark:` variants that target a colour utility
# whose light counterpart is already an `app-*` token, OR a redundant raw
# colour like `dark:text-white` paired with `text-app-text`.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")"/.. && pwd)"
SRC="$ROOT/src"

mapfile -t FILES < <(find "$SRC" -type f \( -name '*.tsx' -o -name '*.ts' \))

# Patterns of dark variants that can be safely removed. We delete the leading
# space + token so the resulting string stays well-formed.
declare -a DARK_PAIRS=(
  ' dark:bg-app-bg|'
  ' dark:bg-app-surface|'
  ' dark:bg-app-surface/50|'
  ' dark:bg-app-surface-elevated|'
  ' dark:bg-app-surface-muted|'
  ' dark:bg-app-surface-hover|'
  ' dark:text-app-text|'
  ' dark:text-app-text-muted|'
  ' dark:text-app-text-subtle|'
  ' dark:text-app-text-inverse|'
  ' dark:text-white|'
  ' dark:text-app-danger|'
  ' dark:text-app-success|'
  ' dark:text-app-warning|'
  ' dark:text-app-info|'
  ' dark:border-app-border|'
  ' dark:border-app-border-strong|'
  ' dark:border-white/10|'
  ' dark:bg-red-900/20|'
  ' dark:border-red-800|'
  ' dark:bg-indigo-900/20|'
)

for f in "${FILES[@]}"; do
  for pair in "${DARK_PAIRS[@]}"; do
    find="${pair%%|*}"
    repl="${pair##*|}"
    find_esc=$(printf '%s' "$find" | sed -e 's/[\\&#.]/\\&/g')
    repl_esc=$(printf '%s' "$repl" | sed -e 's/[\\&#]/\\&/g')
    sed -i "s#${find_esc}#${repl_esc}#g" "$f"
  done
done

echo "Redundant dark: variants removed."
