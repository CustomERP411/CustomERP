# Theme System — Single Source of Truth

The frontend now derives every colour from a single file:
**`platform/frontend/src/index.css`** (defines the CSS variables) which is then
exposed to Tailwind through **`platform/frontend/tailwind.config.js`**.

To re-skin the app you only have to touch `index.css`. Components MUST use the
semantic `app-*` Tailwind classes (e.g. `bg-app-surface`, `text-app-text`,
`border-app-mod-invoice`) and MUST NOT add `dark:` variants for theme tokens —
the `.dark` class on `<html>` automatically swaps the variables.

## Token Catalogue

### Layered surfaces (deepest → most elevated)
A clearly "shaded" depth stack so cards, modals, and recessed blocks read
distinctly in both light and dark modes.

| Token                       | Use                                                  |
| --------------------------- | ---------------------------------------------------- |
| `bg-app-bg`                 | Page background                                      |
| `bg-app-surface`            | Cards, panels, sidebar                               |
| `bg-app-surface-elevated`   | Modals, popovers, dropdowns                          |
| `bg-app-surface-muted`      | Recessed blocks (input on a surface, summary cards)  |
| `bg-app-surface-sunken`     | Strongly recessed strips                             |
| `bg-app-surface-hover`      | Hover state on a clickable surface                   |

### Text
| Token                  | Use                                  |
| ---------------------- | ------------------------------------ |
| `text-app-text`        | Primary text (titles, body)          |
| `text-app-text-muted`  | Secondary text (labels, descriptions)|
| `text-app-text-subtle` | Tertiary (placeholders, captions)    |
| `text-app-text-inverse`| Text on a filled accent button       |

### Borders
| Token                    | Use                                        |
| ------------------------ | ------------------------------------------ |
| `border-app-border`      | Default border                             |
| `border-app-border-strong` | Emphasized borders (separators, focus)   |

### Brand accents — **PRESERVED, do not change**
| Token                     | Hex       |
| ------------------------- | --------- |
| `bg-app-accent-blue`      | `#1274ec` |
| `bg-app-accent-dark-blue` | `#074ba0` |
| `bg-app-accent-orange`    | `#ff5400` |

Use `text-text-inverse` (i.e. white) on top of these.

### Semantic states
Each state has `DEFAULT` / `soft` / `border`:

| Group     | Foreground            | Soft background           | Border                      |
| --------- | --------------------- | ------------------------- | --------------------------- |
| Success   | `text-app-success`    | `bg-app-success-soft`     | `border-app-success-border` |
| Warning   | `text-app-warning`    | `bg-app-warning-soft`     | `border-app-warning-border` |
| Danger    | `text-app-danger`     | `bg-app-danger-soft`      | `border-app-danger-border`  |
| Info      | `text-app-info`       | `bg-app-info-soft`        | `border-app-info-border`    |

### Module entity colours
Used wherever an entity belongs to one of the three first-class modules. Each
module has `DEFAULT` / `soft` / `border` / `ring` so cards, badges, and
selection states stay consistent across the entire app:

| Module    | Foreground / dot         | Soft bg                       | Border                          | Ring                       |
| --------- | ------------------------ | ----------------------------- | ------------------------------- | -------------------------- |
| Inventory | `text-app-mod-inventory` | `bg-app-mod-inventory-soft`   | `border-app-mod-inventory-border` | `ring-app-mod-inventory-ring` |
| Invoice   | `text-app-mod-invoice`   | `bg-app-mod-invoice-soft`     | `border-app-mod-invoice-border`   | `ring-app-mod-invoice-ring`   |
| HR        | `text-app-mod-hr`        | `bg-app-mod-hr-soft`          | `border-app-mod-hr-border`        | `ring-app-mod-hr-ring`        |

A canonical place to use these is `MOD_STYLES` in
`src/components/project/projectConstants.tsx`, which the project-creation
question / module selector flows already consume.

### Misc
| Token              | Use                                  |
| ------------------ | ------------------------------------ |
| `bg-app-overlay`   | Modal backdrop (translucent black)   |
| `ring-app-focus`   | Default focus-ring colour            |

## How to re-skin the app

1. Open `platform/frontend/src/index.css`.
2. Edit the variables under `:root` (light mode) and `.dark` (dark mode).
3. That's it — every component picks the new values up automatically.

## Rules for component authors

- **Only** use `app-*` classes for colour. Never hardcode `bg-slate-*`,
  `text-gray-*`, `bg-white`, etc.
- **Never** add `dark:bg-…` etc. for theme tokens — the variables already flip.
  The only acceptable raw `dark:` modifiers are for non-token concerns (e.g.
  reducing image opacity in dark mode).
- For a brand-new entity / module type, add a new variable group in
  `index.css` (`--app-mod-foo`, `--app-mod-foo-soft`, `--app-mod-foo-border`,
  `--app-mod-foo-ring`) and a matching entry in `tailwind.config.js`. Then use
  `bg-app-mod-foo-soft` etc. throughout the UI.

## Migration helpers

Two scripts under `platform/frontend/scripts/` were used for the bulk
conversion and remain useful if older code lands again:

- `migrate-theme-tokens.sh` — replaces raw Tailwind colour utilities with the
  semantic `app-*` equivalents.
- `strip-redundant-dark-variants.sh` — removes `dark:*` modifiers that are now
  redundant because the underlying variable already swaps under `.dark`.
