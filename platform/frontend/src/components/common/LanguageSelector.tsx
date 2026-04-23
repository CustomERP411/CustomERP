import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  normalizeLanguage,
  setAppLanguage,
  type SupportedLanguage,
} from '../../i18n';
import { useState } from 'react';

type LanguageSelectorVariant = 'default' | 'compact' | 'landing';

interface LanguageSelectorProps {
  /** When provided, the selector is controlled: does not write to i18n/localStorage on change. */
  value?: SupportedLanguage;
  onChange?: (lang: SupportedLanguage) => void;
  /** Kept for backwards compatibility with existing call-sites. */
  compact?: boolean;
  /** Visual variant. Overrides `compact` when set. */
  variant?: LanguageSelectorVariant;
  /** Optional className for the wrapper button. */
  className?: string;
  /** If true, persist to backend for logged-in users (default: true). */
  syncToAccount?: boolean;
  /** If true and logged in, show inline saving feedback. */
  showAccountSyncFeedback?: boolean;
  /**
   * Borderless, full-bleed control for the SVG puzzle board on the landing page
   * (use with `variant="landing"`). The whole piece becomes the click target.
   */
  embedInPuzzle?: boolean;
}

// Bilingual by design — intentionally NOT localised so the tooltip is legible
// regardless of the active language.
const TOOLTIP_BILINGUAL = 'Change Language - Dil Değiştir';

/**
 * LanguageSelector — a two-state EN/TR toggle button. Because the app only
 * supports two languages, a dropdown is unnecessary; clicking the button
 * flips to the other language. Visual variants are kept so existing call-
 * sites (landing page, auth pages, dashboard header, settings) lay out as
 * before — only the behaviour changes.
 */
export default function LanguageSelector({
  value,
  onChange,
  compact = false,
  variant,
  className = '',
  syncToAccount = true,
  showAccountSyncFeedback = false,
  embedInPuzzle = false,
}: LanguageSelectorProps) {
  const resolvedVariant: LanguageSelectorVariant =
    variant ?? (compact ? 'compact' : 'default');
  const { i18n, t } = useTranslation('common');
  const { user, isAuthenticated, updateUser } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const controlled = value !== undefined;
  const current: SupportedLanguage = controlled
    ? (value as SupportedLanguage)
    : normalizeLanguage(i18n.language);

  const next: SupportedLanguage = current === 'en' ? 'tr' : 'en';

  async function handleToggle() {
    if (onChange) onChange(next);
    if (!controlled) await setAppLanguage(next);

    if (syncToAccount && isAuthenticated && user && user.preferred_language !== next) {
      try {
        setSyncing(true);
        const res = await api.put('/auth/profile', { preferred_language: next });
        const updated = res.data?.user;
        updateUser({ preferred_language: updated?.preferred_language ?? next });
      } catch (err) {
        console.error('Failed to sync language preference:', err);
      } finally {
        setSyncing(false);
      }
    }
  }

  const buttonCls =
    resolvedVariant === 'landing' && embedInPuzzle
      ? 'inline-flex h-full w-full min-h-0 min-w-0 items-center justify-center border-0 bg-transparent text-lg font-bold tracking-wider text-app-text shadow-none rounded-none transition-colors hover:bg-app-surface-hover/40 focus:outline-none focus-visible:ring-0'
      : resolvedVariant === 'landing'
      ? 'inline-flex items-center justify-center rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-sm font-bold tracking-wider text-app-text hover:bg-app-surface-hover transition-all focus:outline-none focus-visible:ring-0'
      : resolvedVariant === 'compact'
      ? 'inline-flex items-center justify-center rounded-md border border-app-border bg-app-surface-muted px-2 py-1 text-xs font-bold tracking-wider text-app-text shadow-sm hover:bg-app-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-app-focus'
      : 'inline-flex items-center justify-center rounded-md border border-app-border bg-app-surface-muted px-3 py-1.5 text-sm font-bold tracking-wider text-app-text shadow-sm hover:bg-app-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-app-focus';

  const wrapCls =
    embedInPuzzle && resolvedVariant === 'landing'
      ? `relative h-full w-full block ${className}`.trim()
      : `relative inline-block ${className}`.trim();

  return (
    <div className={wrapCls}>
      <button
        type="button"
        onClick={() => void handleToggle()}
        aria-label={`${t('language')} — ${TOOLTIP_BILINGUAL}`}
        title={TOOLTIP_BILINGUAL}
        className={buttonCls}
      >
        {current.toUpperCase()}
      </button>

      {showAccountSyncFeedback && syncing && (
        <span className="ml-2 text-xs text-app-text-muted">{t('saving')}</span>
      )}
    </div>
  );
}
