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

interface LanguageSelectorProps {
  /** When provided, the selector is controlled: does not write to i18n/localStorage on change. */
  value?: SupportedLanguage;
  onChange?: (lang: SupportedLanguage) => void;
  /** Visual compactness for tight spots (header bars). */
  compact?: boolean;
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
  className = '',
  syncToAccount = true,
  showAccountSyncFeedback = false,
}: LanguageSelectorProps) {
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

  const sizeCls = compact
    ? 'px-2 py-1 text-xs'
    : 'px-3 py-1.5 text-sm';

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language')}
        className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white ${sizeCls} font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        <span aria-hidden="true">{FLAGS[current]}</span>
        <span>{LANGUAGE_LABELS[current]}</span>
        <svg
          className="h-3 w-3 text-slate-500"
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
          className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang}>
              <button
                type="button"
                role="option"
                aria-selected={lang === current}
                onClick={() => handleSelect(lang)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  lang === current ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'
                }`}
              >
                <span aria-hidden="true">{FLAGS[lang]}</span>
                <span>{LANGUAGE_LABELS[lang]}</span>
                {lang === current && (
                  <svg
                    className="ml-auto h-4 w-4 text-blue-600"
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
        <span className="ml-2 text-xs text-slate-500">{t('saving')}</span>
      )}
    </div>
  );
}
