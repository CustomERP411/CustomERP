import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/common/LanguageSelector';
import ThemeToggle from '../components/common/ThemeToggle';
import BrandMark from '../components/brand/BrandMark';
import PuzzlePiece from '../components/landing/PuzzlePiece';

/**
 * Landing Page — an interlocking "puzzle" layout. Every section is a row of
 * PuzzlePieces on desktop (3 columns, `gap-0` so knobs align at shared edges)
 * and a single vertical chain on mobile. Colours come exclusively from the
 * `app-*` tokens in `src/index.css`; see `platform/puzzleplan.md` for spec.
 */
export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('landing');

  useEffect(() => {
    if (user) navigate('/projects');
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-app-bg transition-colors duration-200">
      <div className="puzzle-stack max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* ─── Row 1: Header (Logo | Toggles | Sign-in) ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            bg="bg-app-surface"
            right="tab"
            bottom="tab"
            className="p-6 flex items-center justify-center md:justify-start min-h-[120px]"
          >
            <Link to="/" className="inline-flex items-center">
              <BrandMark
                variant="wordmark"
                className="h-12 sm:h-14 w-auto max-w-[280px] object-contain"
              />
            </Link>
          </PuzzlePiece>

          <PuzzlePiece
            bg="bg-app-surface"
            left="socket"
            right="tab"
            top="socket"
            bottom="tab"
            className="p-6 flex items-center justify-center gap-3 min-h-[120px]"
          >
            <LanguageSelector variant="landing" />
            <ThemeToggle />
          </PuzzlePiece>

          <PuzzlePiece
            bg="bg-app-accent-blue"
            text="text-white"
            interactive
            left="socket"
            top="socket"
            bottom="tab"
            className="p-6 flex items-center justify-center gap-3 min-h-[120px]"
          >
            <Link
              to="/login"
              className="text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-lg bg-white text-app-accent-blue text-sm font-bold hover:bg-app-surface-hover transition-colors"
            >
              {t('nav.getStarted')}
            </Link>
          </PuzzlePiece>
        </div>

        {/* ─── Row 2: Hero ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            colSpan={3}
            bg="bg-app-accent-blue"
            text="text-white"
            top="socket"
            bottom="tab"
            className="bg-gradient-to-br from-app-accent-blue to-app-accent-dark-blue p-8 sm:p-12 md:p-16 text-center flex flex-col items-center justify-center gap-5 min-h-[360px]"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
              {t('hero.titleLine1')}
              <br />
              <span className="text-white/90">{t('hero.titleLine2')}</span>
            </h1>
            <p className="text-base sm:text-xl text-white/80 max-w-2xl">
              {t('hero.subtitle')}
            </p>
            <Link
              to="/register"
              className="mt-2 inline-block px-8 py-3 rounded-lg bg-white text-app-accent-blue text-base sm:text-lg font-bold hover:bg-app-surface-hover transition-all shadow-xl"
            >
              {t('hero.ctaPrimary')}
            </Link>
          </PuzzlePiece>
        </div>

        {/* ─── Row 3: Feature pills ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            colSpan={3}
            bg="bg-app-surface"
            top="socket"
            bottom="tab"
            className="p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {(['aiPowered', 'noCoding', 'deployFast', 'openSource'] as const).map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-2 rounded-full bg-app-surface-muted border border-app-border px-4 py-2 text-sm font-medium text-app-text"
                >
                  <svg
                    className="w-5 h-5 text-app-accent-blue"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {t(`pills.${pill}`)}
                </span>
              ))}
            </div>
          </PuzzlePiece>
        </div>

        {/* ─── Row 4: "Three Simple Steps" banner ──────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            colSpan={3}
            bg="bg-app-surface"
            top="socket"
            bottom="tab"
            className="p-6 sm:p-10 text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-app-text">
              {t('howItWorks.heading')}
            </h2>
          </PuzzlePiece>
        </div>

        {/* ─── Row 5: Steps 1 / 2 / 3 ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {([
            {
              n: 1,
              bg: 'bg-app-mod-inventory-soft',
              text: 'text-app-mod-inventory',
              border: 'border-app-mod-inventory-border',
              badge: 'bg-app-surface-elevated text-app-mod-inventory',
            },
            {
              n: 2,
              bg: 'bg-app-mod-invoice-soft',
              text: 'text-app-mod-invoice',
              border: 'border-app-mod-invoice-border',
              badge: 'bg-app-surface-elevated text-app-mod-invoice',
            },
            {
              n: 3,
              bg: 'bg-app-mod-hr-soft',
              text: 'text-app-mod-hr',
              border: 'border-app-mod-hr-border',
              badge: 'bg-app-surface-elevated text-app-mod-hr',
            },
          ] as const).map(({ n, bg, text, border, badge }, i, arr) => (
            <PuzzlePiece
              key={n}
              bg={bg}
              text={text}
              interactive
              left={i === 0 ? 'none' : 'socket'}
              right={i === arr.length - 1 ? 'none' : 'tab'}
              top="socket"
              bottom="tab"
              className={`p-8 space-y-4 min-h-[240px] border-2 ${border}`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${badge}`}>
                <span className="text-2xl font-black">{n}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold">
                {t(`howItWorks.step${n}Title` as const)}
              </h3>
              <p className="text-sm text-app-text-muted leading-relaxed">
                {t(`howItWorks.step${n}Body` as const)}
              </p>
            </PuzzlePiece>
          ))}
        </div>

        {/* ─── Row 6: Final CTA ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            colSpan={3}
            bg="bg-app-accent-orange"
            text="text-white"
            interactive
            top="socket"
            bottom="tab"
            className="p-10 sm:p-12 text-center flex flex-col items-center justify-center gap-5 min-h-[280px]"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              {t('cta.heading')}
            </h2>
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl">
              {t('cta.body')}
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-3 rounded-lg bg-white text-app-accent-orange text-lg font-bold hover:bg-app-surface-hover transition-all shadow-xl"
            >
              {t('cta.button')}
            </Link>
          </PuzzlePiece>
        </div>

        {/* ─── Row 7: Contact ───────────────────────────────────────────── */}
        <div id="contact" className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            bg="bg-app-surface"
            right="tab"
            top="socket"
            bottom="tab"
            className="p-6 sm:p-8 flex flex-col items-center justify-center gap-2 text-center min-h-[150px]"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-app-text">
              {t('footer.contact')}
            </h2>
            <p className="text-sm text-app-text-muted">
              Have questions or need support?
            </p>
          </PuzzlePiece>

          <PuzzlePiece
            bg="bg-app-surface"
            text="text-app-accent-blue"
            interactive
            left="socket"
            right="tab"
            top="socket"
            bottom="tab"
            className="p-6 flex items-center justify-center min-h-[150px]"
          >
            <a
              href="mailto:salpkirisci@gmail.com"
              className="text-sm sm:text-base font-bold hover:underline break-all text-center"
            >
              salpkirisci@gmail.com
            </a>
          </PuzzlePiece>

          <PuzzlePiece
            bg="bg-app-surface-muted"
            text="text-app-text-subtle"
            left="socket"
            top="socket"
            bottom="tab"
            className="p-6 flex items-center justify-center min-h-[150px]"
          >
            <svg
              className="h-10 w-10 opacity-60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </PuzzlePiece>
        </div>

        {/* ─── Row 8: Footer (caps the puzzle — no outward bottom tab) ──── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          <PuzzlePiece
            bg="bg-app-surface-sunken"
            text="text-app-text-muted"
            right="tab"
            top="socket"
            bottom="tab"
            className="p-5 flex items-center justify-center text-center text-xs sm:text-sm"
          >
            {t('footer.copyright')}
          </PuzzlePiece>

          <PuzzlePiece
            bg="bg-app-surface-sunken"
            text="text-app-text-muted"
            left="socket"
            right="tab"
            top="socket"
            bottom="tab"
            className="p-5 flex items-center justify-center gap-5 text-xs sm:text-sm"
          >
            <a
              href="#contact"
              className="hover:text-app-accent-blue transition-colors"
            >
              {t('footer.contact')}
            </a>
          </PuzzlePiece>

          <PuzzlePiece
            bg="bg-app-surface-sunken"
            text="text-app-text-muted"
            interactive
            left="socket"
            top="socket"
            className="p-5 flex items-center justify-center text-xs sm:text-sm"
          >
            <a
              href="https://github.com/CustomERP411/CustomERP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-app-accent-blue transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12c0-5.52-4.48-10-10-10z" />
              </svg>
              {t('footer.github')}
            </a>
          </PuzzlePiece>
        </div>
      </div>
    </div>
  );
}
