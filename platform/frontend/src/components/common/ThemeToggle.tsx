import { useTheme } from '../../context/ThemeContext';

/**
 * Theme toggle. All colours come from theme tokens (see `src/index.css`).
 * Uses inline SVGs (no external icon dep).
 *
 * `embedInPuzzle` — borderless, full-bleed button for the SVG puzzle board on
 * the landing page so the whole piece is the click target. Omit everywhere else.
 */
export default function ThemeToggle({
  className = '',
  embedInPuzzle = false,
}: {
  className?: string;
  embedInPuzzle?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();

  const base = embedInPuzzle
    ? 'inline-flex h-full w-full min-h-0 min-w-0 items-center justify-center border-0 bg-transparent text-app-accent-blue shadow-none rounded-none transition-colors hover:bg-app-surface-hover/40 focus:outline-none focus-visible:ring-0'
    : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-app-border bg-app-surface-muted text-app-accent-blue hover:bg-app-surface-hover transition-colors';

  return (
    <button
      onClick={toggleTheme}
      className={`${base} ${className}`.trim()}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? (
        // Sun — current theme is light
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        // Moon — current theme is dark
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
    </button>
  );
}
