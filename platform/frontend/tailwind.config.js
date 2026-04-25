/** @type {import('tailwindcss').Config} */
//
// All theme colours are CSS variables defined in `src/index.css`. To re-skin
// the app you only need to edit those variables — do NOT add hex values here.
//
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Flat keys avoid the Tailwind nesting trap where sibling-string keys
        // (e.g. `text` + `text-muted`) prevent the bare class from resolving.
        'app-bg':                 'var(--app-bg)',
        'app-surface':            'var(--app-surface)',
        'app-surface-elevated':   'var(--app-surface-elevated)',
        'app-surface-muted':      'var(--app-surface-muted)',
        'app-surface-sunken':     'var(--app-surface-sunken)',
        'app-surface-hover':      'var(--app-surface-hover)',

        'app-text':           'var(--app-text)',
        'app-text-muted':     'var(--app-text-muted)',
        'app-text-subtle':    'var(--app-text-subtle)',
        'app-text-inverse':   'var(--app-text-inverse)',

        'app-border':         'var(--app-border)',
        'app-border-strong':  'var(--app-border-strong)',

        'app-overlay':        'var(--app-overlay)',

        // Brand accents (PRESERVED — do not change without sign-off)
        'app-accent-blue':       'var(--app-accent-blue)',
        'app-accent-dark-blue':  'var(--app-accent-dark-blue)',
        'app-accent-orange':     'var(--app-accent-orange)',

        // Semantic states
        'app-success':         'var(--app-success)',
        'app-success-soft':    'var(--app-success-soft)',
        'app-success-border':  'var(--app-success-border)',

        'app-warning':         'var(--app-warning)',
        'app-warning-soft':    'var(--app-warning-soft)',
        'app-warning-border':  'var(--app-warning-border)',

        'app-danger':          'var(--app-danger)',
        'app-danger-soft':     'var(--app-danger-soft)',
        'app-danger-border':   'var(--app-danger-border)',

        'app-info':            'var(--app-info)',
        'app-info-soft':       'var(--app-info-soft)',
        'app-info-border':     'var(--app-info-border)',

        // Module entity colours (inventory / invoice / hr)
        'app-mod-inventory':         'var(--app-mod-inventory)',
        'app-mod-inventory-soft':    'var(--app-mod-inventory-soft)',
        'app-mod-inventory-border':  'var(--app-mod-inventory-border)',
        'app-mod-inventory-ring':    'var(--app-mod-inventory-ring)',

        'app-mod-invoice':           'var(--app-mod-invoice)',
        'app-mod-invoice-soft':      'var(--app-mod-invoice-soft)',
        'app-mod-invoice-border':    'var(--app-mod-invoice-border)',
        'app-mod-invoice-ring':      'var(--app-mod-invoice-ring)',

        'app-mod-hr':                'var(--app-mod-hr)',
        'app-mod-hr-soft':           'var(--app-mod-hr-soft)',
        'app-mod-hr-border':         'var(--app-mod-hr-border)',
        'app-mod-hr-ring':           'var(--app-mod-hr-ring)',
      },
      ringColor: {
        'app-focus': 'var(--app-focus-ring)',
      },
    },
  },
  plugins: [],
};
