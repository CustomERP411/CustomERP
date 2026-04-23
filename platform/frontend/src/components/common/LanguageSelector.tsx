import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  setAppLanguage,
  type SupportedLanguage,
} from '../../i18n';

type LanguageSelectorVariant = 'default' | 'compact' | 'landing';

interface LanguageSelectorProps {
  /** When provided, the selector is controlled: does not write to i18n/localStorage on change. */
  value?: SupportedLanguage;
  onChange?: (lang: SupportedLanguage) => void;
  /** Visual compactness for tight spots (header bars). Kept for backwards compatibility. */
  compact?: boolean;
  /** Visual variant. Overrides `compact` when set. */
  variant?: LanguageSelectorVariant;
  /** Optional className for the wrapper button. */
  className?: string;
  /** If true, persist to backend for logged-in users (default: true). */
  syncToAccount?: boolean;
  /** If true and logged in, show toast-like inline feedback. */
  showAccountSyncFeedback?: boolean;
}

const FLAGS: Record<SupportedLanguage, string> = {
  en: '🇬🇧',
  tr: '🇹🇷',
};

export default function LanguageSelector({
  value,
  onChange,
  compact = false,
  variant,
  className = '',
  syncToAccount = true,
  showAccountSyncFeedback = false,
}: LanguageSelectorProps) {
  const resolvedVariant: LanguageSelectorVariant =
    variant ?? (compact ? 'compact' : 'default');
  const { i18n, t } = useTranslation('common');
  const { user, isAuthenticated, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const controlled = value !== undefined;
  const current: SupportedLanguage = controlled
    ? (value as SupportedLanguage)
    : normalizeLanguage(i18n.language);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleSelect(lang: SupportedLanguage) {
    setOpen(false);
    if (lang === current) return;

    if (onChange) {
      onChange(lang);
    }

    if (!controlled) {
      await setAppLanguage(lang);
    }

    if (syncToAccount && isAuthenticated && user && user.preferred_language !== lang) {
      try {
        setSyncing(true);
        const res = await api.put('/auth/profile', { preferred_language: lang });
        const updated = res.data?.user;
        if (updated) {
          updateUser({ preferred_language: updated.preferred_language ?? lang });
        } else {
          updateUser({ preferred_language: lang });
        }
      } catch (err) {
        console.error('Failed to sync language preference:', err);
      } finally {
        setSyncing(false);
      }
    }
  }

  const buttonCls =
    resolvedVariant === 'landing'
      ? 'inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-3 py-1.5 text-sm font-medium text-white hover:bg-app-surface/10 focus:outline-none focus:ring-2 focus:ring-white/40'
      : resolvedVariant === 'compact'
      ? 'inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-surface-muted px-2 py-1 text-xs font-medium text-app-text shadow-sm hover:bg-app-surface-hover focus:outline-none focus:ring-2 focus:ring-app-focus'
      : 'inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-surface-muted px-3 py-1.5 text-sm font-medium text-app-text shadow-sm hover:bg-app-surface-hover focus:outline-none focus:ring-2 focus:ring-app-focus';

  const chevronCls =
    resolvedVariant === 'landing' ? 'h-3 w-3 text-white/80' : 'h-3 w-3 text-app-text-subtle';

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
        className={buttonCls}
      >
        <span aria-hidden="true">{FLAGS[current]}</span>
        <span>{LANGUAGE_LABELS[current]}</span>
        <svg
          className={chevronCls}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-md border border-app-border bg-app-surface-elevated shadow-lg"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang}>
              <button
                type="button"
                role="option"
                aria-selected={lang === current}
                onClick={() => handleSelect(lang)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-app-surface-hover ${
                  lang === current ? 'bg-app-info-soft font-medium text-app-info' : 'text-app-text'
                }`}
              >
                <span aria-hidden="true">{FLAGS[lang]}</span>
                <span>{LANGUAGE_LABELS[lang]}</span>
                {lang === current && (
                  <svg
                    className="ml-auto h-4 w-4 text-app-info"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showAccountSyncFeedback && syncing && (
        <span className="ml-2 text-xs text-app-text-muted">{t('saving')}</span>
      )}
    </div>
  );
}
