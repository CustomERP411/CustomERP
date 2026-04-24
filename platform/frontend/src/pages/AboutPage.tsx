import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandMark from '../components/brand/BrandMark';
import ThemeToggle from '../components/common/ThemeToggle';
import LanguageSelector from '../components/common/LanguageSelector';

/**
 * About page — plain themed layout (no puzzle board) describing the project,
 * the team, and the tech stack. All content is i18n-driven.
 */
export default function AboutPage() {
  const { t } = useTranslation('about');

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

        <div className="space-y-4">
          <Section heading={t('mission.heading')}>
            <p>{t('mission.body')}</p>
          </Section>

          <Section heading={t('team.heading')}>
            <p>{t('team.body')}</p>
            <a
              href="https://ctis.bilkent.edu.tr"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-[13px] font-semibold text-app-accent-blue hover:text-app-accent-dark-blue"
            >
              {t('team.ctisLabel')} →
            </a>
          </Section>

          <Section heading={t('tech.heading')}>
            <p>{t('tech.body')}</p>
            <a
              href="https://github.com/CustomERP411/CustomERP"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-[13px] font-semibold text-app-accent-blue hover:text-app-accent-dark-blue"
            >
              {t('tech.githubLabel')} →
            </a>
          </Section>
        </div>

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
              to="/how-it-works"
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

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-app-border bg-app-surface px-6 py-5 shadow-sm">
      <h2 className="text-[16px] font-semibold text-app-text">{heading}</h2>
      <div className="mt-2 text-[14px] leading-relaxed text-app-text-muted">{children}</div>
    </section>
  );
}

function MarketingHeader() {
  const { t } = useTranslation('about');
  return (
    <header className="sticky top-0 z-10 border-b border-app-border bg-app-bg/85 backdrop-blur supports-[backdrop-filter]:bg-app-bg/70">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark variant="wordmark" className="h-7 w-auto object-contain" />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="hidden sm:inline-flex items-center rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-[13px] font-semibold text-app-text hover:bg-app-surface-hover"
          >
            {t('nav.home')}
          </Link>
          <ThemeToggle />
          <LanguageSelector compact />
        </div>
      </div>
    </header>
  );
}
