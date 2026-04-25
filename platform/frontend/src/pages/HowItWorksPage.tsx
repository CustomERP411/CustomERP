import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/brand/BrandMark';
import ThemeToggle from '../components/common/ThemeToggle';
import LanguageSelector from '../components/common/LanguageSelector';

/**
 * How It Works page — expanded walkthrough of the 5-stage generation pipeline
 * plus a small FAQ. i18n-driven; no puzzle board.
 */
export default function HowItWorksPage() {
  const { t } = useTranslation('howItWorks');

  const steps = [1, 2, 3, 4, 5] as const;
  const faqItems = t('faq.items', { returnObjects: true }) as { q: string; a: string }[];
  const faqList = Array.isArray(faqItems) ? faqItems : [];

  return (
    <div className="min-h-screen bg-app-bg text-app-text transition-colors duration-200">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-[880px] px-4 pb-20 pt-8 sm:px-6">
        <header className="mb-10 text-center">
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-app-text">
            {t('title')}
          </h1>
          <p className="mx-auto mt-3 max-w-[640px] text-[15px] leading-relaxed text-app-text-muted">
            {t('subtitle')}
          </p>
        </header>

        <ol className="space-y-3">
          {steps.map((n) => (
            <li
              key={n}
              className="flex items-start gap-4 rounded-xl border border-app-border bg-app-surface px-5 py-4 shadow-sm"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-info-border bg-app-info-soft text-[14px] font-bold text-app-info">
                {n}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-[15px] font-semibold text-app-text">
                  {t(`steps.step${n}Title`)}
                </h3>
                <p className="text-[13px] leading-relaxed text-app-text-muted">
                  {t(`steps.step${n}Body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {faqList.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[18px] font-semibold text-app-text">
              {t('faq.heading')}
            </h2>
            <div className="mt-3 space-y-2">
              {faqList.map((item, idx) => (
                <details
                  key={idx}
                  className="group rounded-xl border border-app-border bg-app-surface px-5 py-3 shadow-sm open:bg-app-surface-elevated"
                >
                  <summary className="cursor-pointer list-none text-[14px] font-semibold text-app-text marker:hidden">
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-app-text-muted transition-transform group-open:rotate-90"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M7 5l6 5-6 5V5z" />
                      </svg>
                      {item.q}
                    </span>
                  </summary>
                  <p className="mt-2 text-[13px] leading-relaxed text-app-text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 rounded-xl border border-app-border bg-app-surface-elevated px-6 py-6 text-center shadow-sm">
          <h2 className="text-[18px] font-semibold text-app-text">
            {t('cta.heading')}
          </h2>
          <p className="mt-1.5 text-[14px] text-app-text-muted">{t('cta.body')}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-lg bg-app-accent-blue px-4 py-2 text-[14px] font-semibold text-app-text-inverse shadow-sm hover:bg-app-accent-dark-blue"
            >
              {t('cta.primary')}
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center rounded-lg border border-app-border bg-app-surface px-4 py-2 text-[14px] font-semibold text-app-text hover:bg-app-surface-hover"
            >
              {t('cta.secondary')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function MarketingHeader() {
  const { t } = useTranslation('howItWorks');
  return (
    <header className="sticky top-0 z-10 border-b border-app-border bg-app-bg/85 backdrop-blur supports-[backdrop-filter]:bg-app-bg/70">
      <div className="mx-auto flex w-full max-w-[1340px] items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark variant="wordmark" className="h-11 sm:h-12 w-auto object-contain" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-[13px] font-semibold text-app-text hover:bg-app-surface-hover"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12l9-9 9 9" />
              <path d="M5 10v10h14V10" />
            </svg>
            <span className="hidden sm:inline">{t('nav.home')}</span>
          </Link>
          <Link
            to="/about"
            className="hidden md:inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-semibold text-app-text-muted hover:text-app-text"
          >
            {t('nav.about')}
          </Link>
          <ThemeToggle />
          <LanguageSelector compact />
        </nav>
      </div>
    </header>
  );
}
