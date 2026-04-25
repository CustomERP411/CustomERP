#!/usr/bin/env bash
#
# One-shot theme-token migration.
# Rewrites raw Tailwind palette classes (slate/indigo/blue/rose/emerald/amber/
# violet/teal/purple/red/black) used in component files to the semantic
# `app-*` tokens defined in src/index.css.
#
# This is a MECHANICAL rename only. The semantic tokens (bg-app-surface,
# text-app-text, bg-app-success-soft, …) are defined once in src/index.css
# and exposed via tailwind.config.js — that is the single source of truth.
#
# Idempotent: safe to re-run. Does NOT touch existing `app-*` tokens.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")"/.. && pwd)"
SRC="$ROOT/src"

# Files to migrate (everything under src/ except files that are already fully
# tokenised: index.css, Button/Input, Sidebar/Header/MobileTopbar, settings,
# projects list, project card, new-project modal, theme toggle, language
# selector, protected route).
mapfile -t FILES < <(find "$SRC" -type f \( -name '*.tsx' -o -name '*.ts' \))

# Replacement pairs, applied in order.
#   "<find>|<replace>"
declare -a PAIRS=(
  # ── neutrals ────────────────────────────────────────────────────────────
  'text-slate-900|text-app-text'
  'text-slate-800|text-app-text'
  'text-slate-700|text-app-text'
  'text-slate-600|text-app-text-muted'
  'text-slate-500|text-app-text-muted'
  'text-slate-400|text-app-text-subtle'
  'text-slate-300|text-app-text-subtle'
  'text-slate-200|text-app-text-subtle'

  'bg-slate-50|bg-app-surface-muted'
  'bg-slate-100|bg-app-surface-hover'
  'bg-slate-200|bg-app-surface-hover'
  'bg-slate-900/50|bg-app-overlay'
  'bg-black/40|bg-app-overlay'
  'bg-black/50|bg-app-overlay'
  'bg-black/60|bg-app-overlay'

  'border-slate-100|border-app-border'
  'border-slate-200|border-app-border'
  'border-slate-300|border-app-border-strong'
  'border-slate-400|border-app-border-strong'

  'hover:bg-slate-50|hover:bg-app-surface-hover'
  'hover:bg-slate-100|hover:bg-app-surface-hover'
  'hover:bg-slate-200|hover:bg-app-surface-hover'
  'hover:text-slate-700|hover:text-app-text'
  'hover:text-slate-900|hover:text-app-text'
  'hover:border-slate-300|hover:border-app-border-strong'

  'divide-slate-100|divide-app-border'
  'divide-slate-200|divide-app-border'
  'ring-slate-200|ring-app-border'

  # ── indigo → blue accent (no indigo anywhere in the brand palette) ────
  'text-indigo-600|text-app-accent-blue'
  'text-indigo-700|text-app-accent-dark-blue'
  'text-indigo-500|text-app-accent-blue'
  'text-indigo-400|text-app-accent-blue'
  'text-indigo-300|text-app-accent-blue'
  'text-indigo-800|text-app-accent-dark-blue'
  'bg-indigo-600|bg-app-accent-blue'
  'bg-indigo-700|bg-app-accent-dark-blue'
  'bg-indigo-500|bg-app-accent-blue'
  'bg-indigo-300|bg-app-accent-blue/40'
  'bg-indigo-200|bg-app-info-soft'
  'bg-indigo-100|bg-app-info-soft'
  'bg-indigo-50|bg-app-info-soft'
  'hover:bg-indigo-700|hover:bg-app-accent-dark-blue'
  'hover:bg-indigo-600|hover:bg-app-accent-dark-blue'
  'hover:bg-indigo-100|hover:bg-app-info-soft'
  'hover:bg-indigo-50|hover:bg-app-info-soft'
  'hover:border-indigo-300|hover:border-app-accent-blue/40'
  'hover:text-indigo-700|hover:text-app-accent-dark-blue'
  'border-indigo-700|border-app-accent-dark-blue'
  'border-indigo-600|border-app-accent-blue'
  'border-indigo-500|border-app-accent-blue'
  'border-indigo-300|border-app-info-border'
  'border-indigo-200|border-app-info-border'
  'border-indigo-100|border-app-info-border'
  'ring-indigo-500|ring-app-focus'
  'ring-indigo-200|ring-app-focus'
  'focus:ring-indigo-500|focus:ring-app-focus'

  # ── blue (kept but mapped to accent + info semantic) ──────────────────
  'text-blue-600|text-app-accent-blue'
  'text-blue-700|text-app-info'
  'text-blue-800|text-app-info'
  'text-blue-500|text-app-accent-blue'
  'text-blue-400|text-app-accent-blue'
  'text-blue-200|text-app-text-inverse/70'
  'bg-blue-700|bg-app-accent-dark-blue'
  'bg-blue-600|bg-app-accent-blue'
  'bg-blue-500|bg-app-accent-blue'
  'bg-blue-100|bg-app-info-soft'
  'bg-blue-50|bg-app-info-soft'
  'hover:bg-blue-700|hover:bg-app-accent-dark-blue'
  'hover:bg-blue-600|hover:bg-app-accent-blue'
  'hover:border-blue-200|hover:border-app-info-border'
  'hover:text-blue-600|hover:text-app-accent-blue'
  'border-blue-700|border-app-accent-dark-blue'
  'border-blue-600|border-app-accent-blue'
  'border-blue-500|border-app-accent-blue'
  'border-blue-300|border-app-info-border'
  'border-blue-200|border-app-info-border'
  'ring-blue-500|ring-app-focus'
  'ring-blue-200|ring-app-focus'
  'focus:ring-blue-500|focus:ring-app-focus'
  'focus:border-blue-500|focus:border-app-accent-blue'

  # ── red / rose → danger ───────────────────────────────────────────────
  'text-red-900|text-app-danger'
  'text-red-800|text-app-danger'
  'text-red-700|text-app-danger'
  'text-red-600|text-app-danger'
  'text-red-500|text-app-danger'
  'text-red-400|text-app-danger'
  'text-red-200|text-app-danger'
  'bg-red-700|bg-app-danger'
  'bg-red-600|bg-app-danger'
  'bg-red-500|bg-app-danger'
  'bg-red-100|bg-app-danger-soft'
  'bg-red-50|bg-app-danger-soft'
  'hover:bg-red-700|hover:opacity-90'
  'hover:bg-red-50|hover:bg-app-danger-soft'
  'border-red-600|border-app-danger'
  'border-red-500|border-app-danger'
  'border-red-300|border-app-danger-border'
  'border-red-200|border-app-danger-border'
  'ring-red-500|ring-app-danger/40'
  'focus:ring-red-500|focus:ring-app-danger/40'

  'text-rose-700|text-app-danger'
  'text-rose-600|text-app-danger'
  'text-rose-500|text-app-danger'
  'text-rose-400|text-app-danger'
  'bg-rose-700|bg-app-danger'
  'bg-rose-600|bg-app-danger'
  'bg-rose-100|bg-app-danger-soft'
  'bg-rose-50|bg-app-danger-soft'
  'hover:text-rose-700|hover:opacity-90'
  'hover:bg-rose-700|hover:opacity-90'
  'border-rose-200|border-app-danger-border'
  'border-rose-500|border-app-danger'
  'ring-rose-500|ring-app-danger/40'
  'focus:ring-rose-500|focus:ring-app-danger/40'

  # ── emerald / green → success ─────────────────────────────────────────
  'text-emerald-800|text-app-success'
  'text-emerald-700|text-app-success'
  'text-emerald-600|text-app-success'
  'text-emerald-500|text-app-success'
  'text-emerald-400|text-app-success'
  'bg-emerald-600|bg-app-success'
  'bg-emerald-500|bg-app-success'
  'bg-emerald-100|bg-app-success-soft'
  'bg-emerald-50|bg-app-success-soft'
  'hover:bg-emerald-50|hover:bg-app-success-soft'
  'border-emerald-500|border-app-success'
  'border-emerald-400|border-app-success-border'
  'border-emerald-300|border-app-success-border'
  'border-emerald-200|border-app-success-border'

  'text-green-700|text-app-success'
  'text-green-600|text-app-success'
  'bg-green-100|bg-app-success-soft'
  'bg-green-50|bg-app-success-soft'

  # ── amber / yellow → warning ──────────────────────────────────────────
  'text-amber-800|text-app-warning'
  'text-amber-700|text-app-warning'
  'text-amber-600|text-app-warning'
  'text-amber-500|text-app-warning'
  'text-amber-400|text-app-warning'
  'bg-amber-600|bg-app-warning'
  'bg-amber-500|bg-app-warning'
  'bg-amber-100|bg-app-warning-soft'
  'bg-amber-50|bg-app-warning-soft'
  'border-amber-300|border-app-warning-border'
  'border-amber-200|border-app-warning-border'

  'text-yellow-700|text-app-warning'
  'text-yellow-600|text-app-warning'
  'bg-yellow-100|bg-app-warning-soft'
  'bg-yellow-50|bg-app-warning-soft'

  # ── violet / purple → hr module ──────────────────────────────────────
  'text-violet-800|text-app-mod-hr'
  'text-violet-700|text-app-mod-hr'
  'text-violet-600|text-app-mod-hr'
  'text-violet-500|text-app-mod-hr'
  'bg-violet-500|bg-app-mod-hr'
  'bg-violet-100|bg-app-mod-hr-soft'
  'bg-violet-50|bg-app-mod-hr-soft'
  'border-violet-500|border-app-mod-hr'
  'border-violet-200|border-app-mod-hr-border'
  'hover:border-violet-300|hover:border-app-mod-hr-border'
  'hover:bg-violet-50|hover:bg-app-mod-hr-soft'

  'text-purple-700|text-app-mod-hr'
  'text-purple-600|text-app-mod-hr'
  'bg-purple-100|bg-app-mod-hr-soft'
  'bg-purple-50|bg-app-mod-hr-soft'
  'border-purple-200|border-app-mod-hr-border'

  # ── teal (chatbot source badge) → info ───────────────────────────────
  'text-teal-700|text-app-info'
  'text-teal-600|text-app-info'
  'bg-teal-100|bg-app-info-soft'
  'bg-teal-50|bg-app-info-soft'

  # ── white text stays as text-app-text-inverse on accent buttons ───────
  # (kept as plain 'text-white' for simplicity; accent buttons already map
  #  their own foreground via tokens where we rewrote them).

  # ── gray-* legacy ─────────────────────────────────────────────────────
  'text-gray-600|text-app-text-muted'
  'text-gray-500|text-app-text-muted'
  'text-gray-400|text-app-text-subtle'
  'bg-gray-100|bg-app-surface-hover'
  'bg-gray-50|bg-app-surface-muted'
  'border-gray-200|border-app-border'
  'border-gray-300|border-app-border-strong'

  # ── second-pass catches ──────────────────────────────────────────────
  # bg-white inside component trees is an elevated-surface (cards/modals).
  # The page background is already `bg-app-bg` (body default).
  'hover:bg-white|hover:bg-app-surface'
  'bg-white/60|bg-app-surface/60'
  'bg-white/10|bg-app-surface/10'
  'bg-white|bg-app-surface'

  # leftover slate shades
  'bg-slate-300|bg-app-border-strong'
  'bg-slate-400|bg-app-text-subtle'
  'bg-slate-500|bg-app-text-subtle'
  'bg-slate-800|bg-app-surface-sunken'
  'bg-slate-900|bg-app-surface-sunken'
  'hover:bg-slate-800|hover:bg-app-surface-muted'
  'hover:bg-slate-300|hover:bg-app-border-strong'

  # leftover single colour stragglers the first pass missed
  'text-emerald-900|text-app-success'
  'text-emerald-100|text-app-success-soft'
  'hover:bg-emerald-700|hover:opacity-90'
  'border-emerald-600|border-app-success'
  'hover:bg-emerald-800|hover:opacity-90'
  'text-amber-900|text-app-warning'
  'border-amber-500|border-app-warning'
  'border-amber-400|border-app-warning-border'
  'border-blue-100|border-app-info-border'
  'focus:border-indigo-400|focus:border-app-accent-blue'
  'hover:bg-white/10|hover:bg-app-surface-hover'
  'hover:border-indigo-400|hover:border-app-accent-blue'
  'hover:text-indigo-400|hover:text-app-accent-blue'
  'hover:bg-indigo-400|hover:bg-app-accent-blue'
  'hover:bg-indigo-200|hover:bg-app-info-soft'
  'hover:bg-indigo-300|hover:bg-app-accent-blue/40'
)

for f in "${FILES[@]}"; do
  for pair in "${PAIRS[@]}"; do
    find="${pair%%|*}"
    repl="${pair##*|}"
    # Use '#' as sed delimiter so slashes inside class names (e.g. `bg-app/40`)
    # don't have to be escaped. Escape only the few metacharacters that still
    # have special meaning with '#' as the delimiter: '#', '&', '\'.
    find_esc=$(printf '%s' "$find" | sed -e 's/[\\&#.]/\\&/g')
    repl_esc=$(printf '%s' "$repl" | sed -e 's/[\\&#]/\\&/g')
    sed -i "s#${find_esc}#${repl_esc}#g" "$f"
  done
done

echo "Theme-token migration complete."
