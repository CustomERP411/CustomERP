import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSelector from '../components/common/LanguageSelector';
import ThemeToggle from '../components/common/ThemeToggle';
import BrandMark from '../components/brand/BrandMark';
import PuzzleBoard from './PuzzleBoard';
import type { PieceAction } from './PuzzlePiece';
import type { Piece } from '../components/puzzle/geometry';

/**
 * Landing Page — interlocking SVG puzzle pieces (see
 * `pages/PuzzleBoard` + `components/puzzle/geometry`). Each piece is a `<path>`
 * inside a single `<svg>`, so outlines stay seamless. HTML content is dropped
 * into each piece through a `<foreignObject>`, and link / button pieces get an
 * invisible overlay path that makes the *whole* piece outline (including
 * protruding knobs) a single click target.
 *
 * Two layouts are defined, matching the Figma/CSV grids shipped with this
 * change:
 *
 *   Desktop (11 cols × 5 rows)
 *     Row 1 — Logo(2) | Theme(1) | Lang(1) | About(2) | HowItWorks(2) | SignIn(1.5) | SignUp(1.5)
 *     Row 2 — Hero(8) | Tagline(3)
 *     Row 3 — Step1(4) | Step2(4) | Step3(3)
 *     Row 4 — Video(6) | VideoText(5)
 *     Row 5 — Github(2) | Copyright(6) | CTIS(3)
 *
 *   Mobile (4 cols × 11 variable rows)
 *     1. Logo(2) | Theme(1) | Lang(1)
 *     2. SignIn(2) | SignUp(2)
 *     3. About(2) | HowItWorks(2)
 *     4. Hero(4, tall)
 *     5. Tagline(4)
 *     6. Step1(4) | Step2(4) | Step3(4) (stacked)
 *     7. VideoText(4)
 *     8. Video(4, tall)
 *     9. Copyright(2) | Github(1) | CTIS(1)
 *
 * The mobile board renders with a smaller `knobR` so the tabs/sockets stay
 * visually proportional to the smaller pieces (otherwise the default 30px
 * knobs dwarf a 100px-wide mobile cell).
 */

// Knob radius per layout. Mobile pieces are smaller so the knobs need to
// shrink in kind to keep the same visual weight relative to the piece body.
const DESKTOP_KNOB_R = 30;
const MOBILE_KNOB_R = 18;

// ── Desktop grid ────────────────────────────────────────────────────────────
const DCW = 120;
const DH_HEADER = 100;
const DH_HERO = 220;
const DH_STEPS = 200;
const DH_VIDEO = 340;
const DH_FOOT = 100;

const DY_HEADER = 0;
const DY_HERO = DY_HEADER + DH_HEADER;
const DY_STEPS = DY_HERO + DH_HERO;
const DY_VIDEO = DY_STEPS + DH_STEPS;
const DY_FOOT = DY_VIDEO + DH_VIDEO;

// ── Mobile grid ─────────────────────────────────────────────────────────────
const MCW = 100;
const MH_ROW_NAV = 80;
const MH_HERO = 220;
const MH_TAGLINE = 140;
// Steps need more vertical room than the original 110 so the body copy can
// breathe (2-3 lines of description) without feeling cramped next to the
// numbered badge.
const MH_STEP = 150;
const MH_VIDEOTEXT = 160;
// Taller video piece lets the 16:9 frame grow — at 300h the frame clears
// roughly the full available piece width on a typical phone viewport, so
// the placeholder no longer reads as a thin band inside a tall empty piece.
const MH_VIDEO = 300;
const MH_FOOT = 80;

const MY_LOGO = 0;
const MY_AUTH = MY_LOGO + MH_ROW_NAV;
const MY_NAV = MY_AUTH + MH_ROW_NAV;
const MY_HERO = MY_NAV + MH_ROW_NAV;
const MY_TAGLINE = MY_HERO + MH_HERO;
const MY_STEP1 = MY_TAGLINE + MH_TAGLINE;
const MY_STEP2 = MY_STEP1 + MH_STEP;
const MY_STEP3 = MY_STEP2 + MH_STEP;
const MY_VIDEOTEXT = MY_STEP3 + MH_STEP;
const MY_VIDEO = MY_VIDEOTEXT + MH_VIDEOTEXT;
const MY_FOOT = MY_VIDEO + MH_VIDEO;

/** Breakpoint at which the mobile layout kicks in. Matches Tailwind `md` (768px). */
const MOBILE_QUERY = '(max-width: 767px)';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation('landing');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (user) navigate('/projects');
  }, [user, navigate]);

  // ── Desktop pieces (11-col CSV grid) ──────────────────────────────────────
  const desktopPieces = useMemo<Piece[]>(
    () => [
      // Row 1 — header
      {
        id: 'logo',
        x: 0, y: DY_HEADER, w: 2 * DCW, h: DH_HEADER,
        sides: { right: { count: 1, type: 'tab' }, bottom: { count: 1, type: 'tab' } },
      },
      {
        id: 'theme',
        x: 2 * DCW, y: DY_HEADER, w: DCW, h: DH_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'lang',
        x: 3 * DCW, y: DY_HEADER, w: DCW, h: DH_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'about',
        x: 4 * DCW, y: DY_HEADER, w: 2 * DCW, h: DH_HEADER,
        sides: {
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'howItWorks',
        x: 6 * DCW, y: DY_HEADER, w: 2 * DCW, h: DH_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      // Sign In / Sign Up share a single 3-cell span split in half so the
      // two CTAs render at the exact same width on desktop (requested
      // parity with mobile where they already mirror each other).
      {
        id: 'signin',
        x: 8 * DCW, y: DY_HEADER, w: 1.5 * DCW, h: DH_HEADER,
        sides: {
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'signup',
        x: 9.5 * DCW, y: DY_HEADER, w: 1.5 * DCW, h: DH_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'socket' },
        },
      },

      // Row 2 — hero (Build Your Custom ERP | No Coding Required)
      {
        id: 'hero',
        x: 0, y: DY_HERO, w: 8 * DCW, h: DH_HERO,
        sides: {
          top: [
            { pos: 0.125, type: 'socket' },
            { pos: 0.3125, type: 'socket' },
            { pos: 0.4375, type: 'tab' },
            { pos: 0.625, type: 'socket' },
            { pos: 0.875, type: 'socket' },
          ],
          right: { count: 1, type: 'tab' },
          bottom: [
            { pos: 0.25, type: 'tab' },
            { pos: 0.75, type: 'socket' },
          ],
        },
      },
      {
        id: 'tagline',
        x: 8 * DCW, y: DY_HERO, w: 3 * DCW, h: DH_HERO,
        sides: {
          // Matches the centres of the equal-width Sign In / Sign Up pieces
          // sitting on top of this piece (x = 8.75 DCW and x = 10.25 DCW
          // relative to the tagline's 3 DCW width → 0.25 and 0.75).
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'tab' },
          ],
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // Row 3 — steps
      {
        id: 'step1',
        x: 0, y: DY_STEPS, w: 4 * DCW, h: DH_STEPS,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'step2',
        x: 4 * DCW, y: DY_STEPS, w: 4 * DCW, h: DH_STEPS,
        sides: {
          top: { count: 1, type: 'tab' },
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'tab' },
          ],
        },
      },
      {
        id: 'step3',
        x: 8 * DCW, y: DY_STEPS, w: 3 * DCW, h: DH_STEPS,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'socket' },
        },
      },

      // Row 4 — video + copy
      {
        id: 'video',
        x: 0, y: DY_VIDEO, w: 6 * DCW, h: DH_VIDEO,
        sides: {
          top: [
            { pos: 1 / 3, type: 'tab' },
            { pos: 5 / 6, type: 'tab' },
          ],
          right: { count: 1, type: 'socket' },
          bottom: [
            { pos: 1 / 6, type: 'tab' },
            { pos: 2 / 3, type: 'tab' },
          ],
        },
      },
      {
        id: 'videoText',
        x: 6 * DCW, y: DY_VIDEO, w: 5 * DCW, h: DH_VIDEO,
        sides: {
          top: [
            { pos: 0.2, type: 'socket' },
            { pos: 0.7, type: 'tab' },
          ],
          left: { count: 1, type: 'tab' },
          bottom: [
            { pos: 0.2, type: 'tab' },
            { pos: 0.7, type: 'socket' },
          ],
        },
      },

      // Row 5 — footer
      {
        id: 'github',
        x: 0, y: DY_FOOT, w: 2 * DCW, h: DH_FOOT,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'copyright',
        x: 2 * DCW, y: DY_FOOT, w: 6 * DCW, h: DH_FOOT,
        sides: {
          top: [
            { pos: 1 / 3, type: 'socket' },
            { pos: 5 / 6, type: 'socket' },
          ],
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'ctis',
        x: 8 * DCW, y: DY_FOOT, w: 3 * DCW, h: DH_FOOT,
        sides: {
          top: { count: 1, type: 'tab' },
          left: { count: 1, type: 'tab' },
        },
      },
    ],
    [],
  );

  // ── Mobile pieces (4-col CSV grid) ────────────────────────────────────────
  const mobilePieces = useMemo<Piece[]>(
    () => [
      // Row 1 — Logo | Theme | Lang
      {
        id: 'logo',
        x: 0, y: MY_LOGO, w: 2 * MCW, h: MH_ROW_NAV,
        sides: { right: { count: 1, type: 'tab' }, bottom: { count: 1, type: 'tab' } },
      },
      {
        id: 'theme',
        x: 2 * MCW, y: MY_LOGO, w: MCW, h: MH_ROW_NAV,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'lang',
        x: 3 * MCW, y: MY_LOGO, w: MCW, h: MH_ROW_NAV,
        sides: {
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // Row 2 — Sign In | Sign Up
      {
        id: 'signin',
        x: 0, y: MY_AUTH, w: 2 * MCW, h: MH_ROW_NAV,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'signup',
        x: 2 * MCW, y: MY_AUTH, w: 2 * MCW, h: MH_ROW_NAV,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // Row 3 — About | How It Works
      {
        id: 'about',
        x: 0, y: MY_NAV, w: 2 * MCW, h: MH_ROW_NAV,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'howItWorks',
        x: 2 * MCW, y: MY_NAV, w: 2 * MCW, h: MH_ROW_NAV,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // Row 4 — Hero
      {
        id: 'hero',
        x: 0, y: MY_HERO, w: 4 * MCW, h: MH_HERO,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          bottom: { count: 1, type: 'tab' },
        },
      },

      // Row 5 — Tagline
      {
        id: 'tagline',
        x: 0, y: MY_TAGLINE, w: 4 * MCW, h: MH_TAGLINE,
        sides: {
          top: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // Rows 6/7/8 — Steps stacked
      {
        id: 'step1',
        x: 0, y: MY_STEP1, w: 4 * MCW, h: MH_STEP,
        sides: {
          top: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'step2',
        x: 0, y: MY_STEP2, w: 4 * MCW, h: MH_STEP,
        sides: {
          top: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'step3',
        x: 0, y: MY_STEP3, w: 4 * MCW, h: MH_STEP,
        sides: {
          top: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'socket' },
        },
      },

      // Row 9 — Video copy
      {
        id: 'videoText',
        x: 0, y: MY_VIDEOTEXT, w: 4 * MCW, h: MH_VIDEOTEXT,
        sides: {
          top: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'socket' },
        },
      },

      // Row 10 — Video
      {
        id: 'video',
        x: 0, y: MY_VIDEO, w: 4 * MCW, h: MH_VIDEO,
        sides: {
          top: { count: 1, type: 'tab' },
          bottom: [
            { pos: 0.25, type: 'tab' },
            { pos: 0.625, type: 'tab' },
            { pos: 0.875, type: 'tab' },
          ],
        },
      },

      // Row 11 — Footer: Copyright | Github | CTIS
      {
        id: 'copyright',
        x: 0, y: MY_FOOT, w: 2 * MCW, h: MH_FOOT,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'github',
        x: 2 * MCW, y: MY_FOOT, w: MCW, h: MH_FOOT,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'socket' },
        },
      },
      {
        id: 'ctis',
        x: 3 * MCW, y: MY_FOOT, w: MCW, h: MH_FOOT,
        sides: {
          top: { count: 1, type: 'tab' },
          left: { count: 1, type: 'tab' },
        },
      },
    ],
    [],
  );

  const pieces = isMobile ? mobilePieces : desktopPieces;

  // ── Actions: whole-piece click targets ────────────────────────────────────
  // Internal routes use React Router's `navigate` with preventDefault so
  // middle / ctrl / meta / shift clicks still open in a new tab via `href`.
  const internalAction = (to: string, ariaLabel: string): PieceAction => ({
    href: to,
    ariaLabel,
    onClick: (e: MouseEvent<Element>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    },
  });
  const externalAction = (
    href: string,
    ariaLabel: string,
  ): PieceAction => ({
    href,
    ariaLabel,
    target: '_blank',
    rel: 'noopener noreferrer',
  });

  const actionsById: Record<string, PieceAction> = {
    logo: internalAction('/', t('nav.home')),
    about: internalAction('/about', t('nav.about')),
    howItWorks: internalAction('/how-it-works', t('nav.howItWorks')),
    signin: internalAction('/login', t('nav.signIn')),
    signup: internalAction('/register', t('nav.signUp')),
    theme: {
      href: '#',
      ariaLabel: t('nav.toggleTheme'),
      onClick: (e) => {
        e.preventDefault();
        toggleTheme();
      },
    },
    github: externalAction(
      'https://github.com/CustomERP411/CustomERP',
      t('footer.github'),
    ),
    ctis: externalAction(
      'https://www.ctis.bilkent.edu.tr/ctis_seniorProject.php?id=5066',
      'Bilkent CTIS — CustomERP Senior Project',
    ),
  };

  // ── Piece content (inner HTML inside each foreignObject) ──────────────────
  // Pieces that have an overlay `action` use plain, non-interactive content
  // (no inner <Link>/<a>) — clicks go to the overlay. Pieces without an
  // action keep their interactive inner controls (theme toggle's icon is
  // still rendered for visual state, but the overlay drives the toggle).
  const contentById: Record<string, ReactNode> = {
    logo: (
      <div className="flex h-full w-full items-center justify-center px-4">
        <BrandMark
          variant="wordmark"
          className="h-12 w-auto max-w-full object-contain"
        />
      </div>
    ),
    theme: (
      <div className="pointer-events-none flex h-full w-full items-center justify-center">
        <ThemeToggle embedInPuzzle />
      </div>
    ),
    lang: (
      <div className="flex h-full w-full min-h-0 min-w-0 self-stretch">
        <LanguageSelector variant="landing" embedInPuzzle />
      </div>
    ),
    about: (
      <div className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-semibold text-app-text">
        {t('nav.about')}
      </div>
    ),
    howItWorks: (
      <div className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-semibold text-app-text">
        {t('nav.howItWorks')}
      </div>
    ),
    signin: (
      <div className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-semibold text-app-text">
        {t('nav.signIn')}
      </div>
    ),
    signup: (
      <div className="flex h-full w-full items-center justify-center px-3 text-center text-[14px] font-bold text-app-accent-blue">
        {t('nav.signUp')}
      </div>
    ),
    hero: (
      <div className="flex h-full w-full flex-col items-center justify-center px-5 py-5 sm:px-8 sm:py-6 text-center">
        <h1 className="max-w-[15rem] sm:max-w-lg text-[22px] sm:text-[30px] font-bold leading-snug text-app-text text-balance">
          {t('hero.titleLine1')}
        </h1>
      </div>
    ),
    tagline: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 px-4 py-4 sm:px-6 sm:py-6 text-center">
        <p className="max-w-[11.5rem] sm:max-w-[15rem] text-[15px] sm:text-[17px] font-semibold leading-snug text-app-text text-balance">
          {t('pills.noCoding')}
        </p>
        <div className="flex max-w-[13rem] sm:max-w-xs flex-col gap-1.5 text-[12px] sm:text-[13px] leading-snug text-app-text-muted">
          <p className="text-balance">{t('tagline.line1')}</p>
          <p className="text-balance">{t('tagline.line2')}</p>
          <p className="text-balance">{t('tagline.line3')}</p>
        </div>
      </div>
    ),
    step1: <StepCard step={1} t={t} accent="inventory" />,
    step2: <StepCard step={2} t={t} accent="invoice" />,
    step3: <StepCard step={3} t={t} accent="hr" />,
    video: <VideoPlaceholder t={t} />,
    videoText: <VideoCopy t={t} />,
    github: (
      // Mobile: the piece is narrow (≈100px wide) so we drop the "GitHub"
      // wordmark and let the logo breathe on its own. Desktop keeps the
      // icon + label combo since the piece there is 2 cols wide.
      <div className="flex h-full w-full items-center justify-center gap-2 px-4 text-center text-[13px] font-medium text-app-text">
        <svg
          className="h-6 w-6 sm:h-4 sm:w-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12c0-5.52-4.48-10-10-10z" />
        </svg>
        <span className="hidden sm:inline">{t('footer.github')}</span>
      </div>
    ),
    copyright: (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-[12px] text-app-text-muted">
        {t('footer.copyright')}
      </div>
    ),
    ctis: (
      <div className="flex h-full w-full items-center justify-center px-3 text-center">
        <img
          src={theme === 'dark' ? '/brand/ctis-dark.png' : '/brand/ctis-light.png'}
          alt="Bilkent CTIS"
          className="h-8 sm:h-10 w-auto max-w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-app-bg transition-colors duration-200">
      <div className="mx-auto w-full max-w-[1340px] px-4 pt-4 pb-10 sm:px-6 sm:pt-6 sm:pb-12 landing-puzzle-shell">
        <div className="landing-puzzle-aura" aria-hidden />
        <PuzzleBoard
          className="relative z-10 landing-board"
          pieces={pieces}
          contentById={contentById}
          actionsById={actionsById}
          useLandingGradients
          landingGradientTheme={theme}
          knobR={isMobile ? MOBILE_KNOB_R : DESKTOP_KNOB_R}
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
 *  small ringed numbered badge. Horizontal padding clears the desktop left
 *  socket (KNOB_R = 30px) so the badge never collides with the piece edge;
 *  the mobile layout has no left socket on step pieces, so we use tighter
 *  padding there to give the text more breathing room. */
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
    <div className="flex h-full w-full items-center gap-3 sm:gap-4 pl-5 pr-4 py-4 sm:pl-12 sm:pr-8 sm:py-6 text-left">
      <span
        className={`inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border text-[14px] sm:text-[15px] font-bold ${cls.badge}`}
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
        <h3 className={`text-[14px] sm:text-[16px] font-semibold leading-snug ${cls.title}`}>
          {t(`howItWorks.step${step}Title`)}
        </h3>
        <p className="text-[12px] sm:text-[13px] leading-relaxed text-app-text-muted">
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
 *  dropped in later; we keep the visual anchor on the page.
 *
 *  Sizing: the frame is height-driven (`h-full w-auto aspect-video`) so it
 *  always fits vertically inside the piece, then grows horizontally up to the
 *  available width. Earlier the frame was width-driven, which caused the
 *  placeholder to overflow the shorter desktop / mobile video piece when the
 *  parent was wider than it was tall. */
function VideoPlaceholder({ t }: VideoPlaceholderProps) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
      <div className="relative flex h-full w-auto max-w-full aspect-video items-center justify-center overflow-hidden rounded-xl border border-app-border-strong bg-app-surface-sunken shadow-inner">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-app-accent-orange/15 ring-1 ring-app-accent-orange/40">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 sm:h-7 sm:w-7 text-app-accent-orange"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="absolute bottom-2 right-3 sm:bottom-3 sm:right-4 rounded-md bg-app-surface/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-app-text-muted">
          {t('video.comingSoon')}
        </span>
      </div>
    </div>
  );
}

/** Copy block that sits next to the video (right on desktop, above on mobile).
 *  No overlay action is bound to this piece, so the inner CTA `<Link>` still
 *  intercepts body clicks as normal.
 *
 *  On mobile the piece has flat left/right edges so we drop the desktop
 *  pl-10 / pr-10 (which cleared the left socket) for a tighter, more
 *  aesthetic px-5 / py-5 instead. */
function VideoCopy({ t }: VideoPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col items-start justify-center gap-2.5 sm:gap-3 px-5 py-5 sm:pl-10 sm:pr-10 sm:py-8 text-left">
      <span className="inline-flex items-center rounded-full border border-app-accent-blue/30 bg-app-info-soft px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-app-accent-blue">
        {t('video.eyebrow')}
      </span>
      <h2 className="text-[20px] sm:text-[26px] font-bold leading-tight text-app-text">
        {t('video.heading')}
      </h2>
      <p className="text-[13px] sm:text-[15px] leading-relaxed text-app-text-muted">
        {t('video.body')}
      </p>
      <Link
        to="/register"
        className="mt-1 inline-flex items-center justify-center rounded-lg bg-app-accent-blue px-4 py-2 text-[13px] sm:text-[14px] font-semibold text-app-text-inverse shadow-sm transition-colors hover:bg-app-accent-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus-ring"
      >
        {t('video.cta')}
      </Link>
    </div>
  );
}
