import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSelector from '../components/common/LanguageSelector';
import ThemeToggle from '../components/common/ThemeToggle';
import BrandMark from '../components/brand/BrandMark';
import PuzzleBoard from './PuzzleBoard';
import type { Piece } from '../components/puzzle/geometry';

/**
 * Landing Page — interlocking SVG puzzle pieces (see
 * `pages/PuzzleBoard` + `components/puzzle/geometry`). Each piece is a `<path>`
 * inside a single `<svg>`, so outlines stay seamless. HTML content is dropped
 * into each piece through a `<foreignObject>`.
 *
 * Grid (6 cols × 5 rows):
 *
 *   Row 1 — Logo(2) | About | HowItWorks | SignIn | SignUp
 *   Row 2 — Theme | Lang | Banner(2) | Tagline(2)
 *   Row 3 — Step1(2) | Step2(2) | Step3(2)
 *   Row 4 — Video(3, 16:9) | VideoText(3)
 *   Row 5 — GitHub(2) | Copyright(3) | CTIS
 *
 * Typography and piece dimensions are tuned so the landing fills a large
 * desktop viewport (~1300px wide) without wasted whitespace.
 */

const CELL_W = 200;

const ROW_H_HEADER = 100;
const ROW_H_HERO = 230;
const ROW_H_STEPS = 200;
const ROW_H_VIDEO = 380;
const ROW_H_FOOT = 80;

const Y_HEADER = 0;
const Y_HERO = Y_HEADER + ROW_H_HEADER;
const Y_STEPS = Y_HERO + ROW_H_HERO;
const Y_VIDEO = Y_STEPS + ROW_H_STEPS;
const Y_FOOT = Y_VIDEO + ROW_H_VIDEO;

export default function LandingPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation('landing');

  useEffect(() => {
    if (user) navigate('/projects');
  }, [user, navigate]);

  const pieces = useMemo<Piece[]>(
    () => [
      // ── Row 1 — header ──────────────────────────────────────────────────
      {
        id: 'logo',
        x: 0, y: Y_HEADER, w: 2 * CELL_W, h: ROW_H_HEADER,
        sides: {
          right: { count: 1, type: 'tab' },
          bottom: [
            { pos: 0.25, type: 'tab' },
            { pos: 0.75, type: 'tab' },
          ],
        },
      },
      {
        id: 'about',
        x: 2 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'howItWorks',
        x: 3 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'signin',
        x: 4 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'signup',
        x: 5 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // ── Row 2 — hero (Theme | Lang | Banner | Tagline) ─────────────────
      {
        id: 'theme',
        x: 0, y: Y_HERO, w: CELL_W, h: ROW_H_HERO,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'lang',
        x: CELL_W, y: Y_HERO, w: CELL_W, h: ROW_H_HERO,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'banner',
        x: 2 * CELL_W, y: Y_HERO, w: 2 * CELL_W, h: ROW_H_HERO,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'tagline',
        x: 4 * CELL_W, y: Y_HERO, w: 2 * CELL_W, h: ROW_H_HERO,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // ── Row 3 — steps ─────────────────────────────────────────────────
      {
        id: 'step1',
        x: 0, y: Y_STEPS, w: 2 * CELL_W, h: ROW_H_STEPS,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' }, // x=200, matches video top pos 1/3
        },
      },
      {
        id: 'step2',
        x: 2 * CELL_W, y: Y_STEPS, w: 2 * CELL_W, h: ROW_H_STEPS,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: [
            { pos: 0.25, type: 'tab' }, // x=500, matches video top pos 5/6
            { pos: 0.75, type: 'tab' }, // x=700, matches videoText top pos 1/6
          ],
        },
      },
      {
        id: 'step3',
        x: 4 * CELL_W, y: Y_STEPS, w: 2 * CELL_W, h: ROW_H_STEPS,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' }, // x=1000, matches videoText top pos 2/3
        },
      },

      // ── Row 4 — video (left, 16:9) + copy/CTA (right) ─────────────────
      {
        id: 'video',
        x: 0, y: Y_VIDEO, w: 3 * CELL_W, h: ROW_H_VIDEO,
        sides: {
          top: [
            { pos: 1 / 3, type: 'socket' },
            { pos: 2 / 3, type: 'socket' },
          ],
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'videoText',
        x: 3 * CELL_W, y: Y_VIDEO, w: 3 * CELL_W, h: ROW_H_VIDEO,
        sides: {
          top: [
            { pos: 1 / 3, type: 'socket' },
            { pos: 2 / 3, type: 'socket' },
          ],
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // ── Row 5 — footer ────────────────────────────────────────────────
      {
        id: 'github',
        x: 0, y: Y_FOOT, w: 2 * CELL_W, h: ROW_H_FOOT,
        sides: {
          top: [{ pos: 0.75, type: 'socket' }], // x=300, matches video bottom tab
          right: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'copyright',
        x: 2 * CELL_W, y: Y_FOOT, w: 3 * CELL_W, h: ROW_H_FOOT,
        sides: {
          top: [{ pos: 5 / 6, type: 'socket' }], // x=900, matches videoText bottom tab
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'ctis',
        x: 5 * CELL_W, y: Y_FOOT, w: CELL_W, h: ROW_H_FOOT,
        sides: {
          left: { count: 1, type: 'socket' },
        },
      },
    ],
    [],
  );

  const contentById: Record<string, ReactNode> = {
    logo: (
      <Link to="/" className="flex h-full w-full min-h-0 items-center justify-center px-4">
        <BrandMark
          variant="wordmark"
          className="h-14 w-auto max-w-full object-contain"
        />
      </Link>
    ),
    about: (
      <Link
        to="/about"
        className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-semibold text-app-text-muted transition-colors hover:text-app-text"
      >
        {t('nav.about')}
      </Link>
    ),
    howItWorks: (
      <Link
        to="/how-it-works"
        className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-semibold text-app-text-muted transition-colors hover:text-app-text"
      >
        {t('nav.howItWorks')}
      </Link>
    ),
    signin: (
      <Link
        to="/login"
        className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-semibold text-app-text-muted transition-colors hover:text-app-text"
      >
        {t('nav.signIn')}
      </Link>
    ),
    signup: (
      <div className="flex h-full w-full items-center justify-center px-3">
        <Link
          to="/register"
          className="inline-flex items-center justify-center rounded-lg bg-app-accent-blue px-4 py-2 text-[14px] font-semibold text-app-text-inverse shadow-sm transition-colors hover:bg-app-accent-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring"
        >
          {t('nav.getStarted')}
        </Link>
      </div>
    ),
    theme: (
      <div className="flex h-full w-full min-h-0 min-w-0 self-stretch">
        <ThemeToggle embedInPuzzle />
      </div>
    ),
    lang: (
      <div className="flex h-full w-full min-h-0 min-w-0 self-stretch">
        <LanguageSelector variant="landing" embedInPuzzle />
      </div>
    ),
    banner: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-8 py-6 text-center">
        <h1 className="text-[26px] sm:text-[30px] font-bold leading-tight text-app-text">
          {t('hero.titleLine1')}
        </h1>
        <p className="text-[16px] sm:text-[18px] font-medium text-app-accent-blue">
          {t('hero.titleLine2')}
        </p>
      </div>
    ),
    tagline: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-8 py-6 text-center">
        <p className="text-[16px] sm:text-[18px] font-semibold leading-snug text-app-text">
          {t('pills.noCoding')}
        </p>
        <p className="text-[13px] sm:text-[14px] leading-relaxed text-app-text-muted">
          {t('hero.subtitle')}
        </p>
      </div>
    ),
    step1: <StepCard step={1} t={t} accent="inventory" />,
    step2: <StepCard step={2} t={t} accent="invoice" />,
    step3: <StepCard step={3} t={t} accent="hr" />,
    video: <VideoPlaceholder t={t} />,
    videoText: <VideoCopy t={t} />,
    github: (
      <a
        href="https://github.com/CustomERP411/CustomERP"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full w-full items-center justify-center gap-2 px-4 text-center text-[13px] font-medium text-app-text-muted transition-colors hover:text-app-text"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12c0-5.52-4.48-10-10-10z" />
        </svg>
        {t('footer.github')}
      </a>
    ),
    copyright: (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-[12px] text-app-text-muted">
        {t('footer.copyright')}
      </div>
    ),
    ctis: (
      <a
        href="https://ctis.bilkent.edu.tr"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full w-full items-center justify-center px-3 text-center text-[13px] font-medium text-app-text-muted transition-colors hover:text-app-text"
      >
        Bilkent CTIS
      </a>
    ),
  };

  return (
    <div className="min-h-screen bg-app-bg transition-colors duration-200">
      <div className="mx-auto w-full max-w-[1340px] px-4 pt-4 pb-10 sm:px-6 sm:pt-6 sm:pb-12">
        <PuzzleBoard
          className="relative z-10 landing-board"
          pieces={pieces}
          contentById={contentById}
          useLandingGradients
          landingGradientTheme={theme}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Piece content helpers
// ──────────────────────────────────────────────────────────────────────────────

type StepAccent = 'inventory' | 'invoice' | 'hr';

interface StepCardProps {
  step: 1 | 2 | 3;
  t: (key: string) => string;
  accent: StepAccent;
}

/** One of the three "how it works" step cards. Vertically centered with a
 *  small ringed numbered badge. Horizontal padding clears the left socket
 *  (KNOB_R = 30px) so the badge never collides with the piece edge. */
function StepCard({ step, t, accent }: StepCardProps) {
  const accentCls: Record<StepAccent, { badge: string; title: string }> = {
    inventory: {
      badge: 'border-app-mod-inventory-border bg-app-mod-inventory-soft text-app-mod-inventory',
      title: 'text-app-text',
    },
    invoice: {
      badge: 'border-app-mod-invoice-border bg-app-mod-invoice-soft text-app-mod-invoice',
      title: 'text-app-text',
    },
    hr: {
      badge: 'border-app-mod-hr-border bg-app-mod-hr-soft text-app-mod-hr',
      title: 'text-app-text',
    },
  };
  const cls = accentCls[accent];

  return (
    <div className="flex h-full w-full items-center gap-4 pl-12 pr-8 py-6 text-left">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[15px] font-bold ${cls.badge}`}
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className={`text-[15px] sm:text-[16px] font-semibold ${cls.title}`}>
          {t(`howItWorks.step${step}Title`)}
        </h3>
        <p className="text-[13px] leading-relaxed text-app-text-muted">
          {t(`howItWorks.step${step}Body`)}
        </p>
      </div>
    </div>
  );
}

interface VideoPlaceholderProps {
  t: (key: string) => string;
}

/** Video puzzle piece — fills the piece body with a rounded 16:9 frame so the
 *  placeholder clearly reads as part of the jigsaw. The real video will be
 *  dropped in later; we keep the visual anchor on the page. */
function VideoPlaceholder({ t }: VideoPlaceholderProps) {
  return (
    <div className="flex h-full w-full items-center justify-center pl-10 pr-6 py-8">
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-app-border-strong bg-app-surface-sunken shadow-inner">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-app-accent-orange/15 ring-1 ring-app-accent-orange/40">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-app-accent-orange"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="absolute bottom-3 right-4 rounded-md bg-app-surface/80 px-2 py-0.5 text-[11px] font-medium text-app-text-muted">
          {t('video.comingSoon')}
        </span>
      </div>
    </div>
  );
}

/** Copy block that sits inside the right-hand puzzle piece next to the video.
 *  Headline + supporting body + primary CTA. */
function VideoCopy({ t }: VideoPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-center gap-3 pl-10 pr-10 py-8 text-left">
      <span className="inline-flex items-center rounded-full border border-app-accent-blue/30 bg-app-info-soft px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-app-accent-blue">
        {t('video.eyebrow')}
      </span>
      <h2 className="text-[22px] sm:text-[26px] font-bold leading-tight text-app-text">
        {t('video.heading')}
      </h2>
      <p className="text-[14px] sm:text-[15px] leading-relaxed text-app-text-muted">
        {t('video.body')}
      </p>
      <Link
        to="/register"
        className="mt-1 inline-flex items-center justify-center rounded-lg bg-app-accent-blue px-4 py-2 text-[14px] font-semibold text-app-text-inverse shadow-sm transition-colors hover:bg-app-accent-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring"
      >
        {t('video.cta')}
      </Link>
    </div>
  );
}
