import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/common/LanguageSelector';
import ThemeToggle from '../components/common/ThemeToggle';
import BrandMark from '../components/brand/BrandMark';
import { PuzzleBoard } from '../components/puzzle';
import type { Piece } from '../components/puzzle';

/**
 * Landing Page — a single jigsaw of SVG puzzle pieces (see
 * `components/puzzle/`). Every piece is a `<path>` inside one `<svg>`, so
 * outlines stay seamless and knob shapes interlock natively. Each piece
 * embeds its HTML content (logo, toggles, CTA buttons, contact placeholder,
 * links…) through a `<foreignObject>` that exposes the piece's rectangular
 * body to ordinary React/Tailwind.
 *
 * The layout mirrors the approved CSV grid (6 columns × 7 effective rows):
 *
 *   Row 1 — Logo(2) | Theme | Lang | SignUp | SignIn
 *   Row 2 — Banner(2) | Tagline(2) | TryNow(2)
 *   Row 3 — Step1(2)  | Step2(2)   | Step3(2)
 *   Rows 4-6 (contact block) — ContactForm(4×3) + Heading / GitHub / CTIS stacked in right col
 *   Row 7 — Copyright(6)
 *
 * Side knob types mostly follow: the left / top neighbour often carries the
 * protruding tab into a socket on the right / bottom neighbour. Header
 * theme | lang | signup is an exception: lang has a left tab and right socket
 * (theme/signup adjust so edges still mate). Wide pieces use explicit
 * `[{ pos, type }]` arrays where one edge meets several neighbours.
 */

const COLS = 6;
const CELL_W = 200;
const BOARD_W = COLS * CELL_W; // 1200

const ROW_H_HEADER = 160;
const ROW_H_HERO = 320;
const ROW_H_STEPS = 240;
const CONTACT_ROW_H = 120; // each of the 3 right-column cells
const ROW_H_CONTACT = CONTACT_ROW_H * 3; // 360 — contact form spans all three
const ROW_H_FOOT = 100;

const Y_HEADER = 0;
const Y_HERO = Y_HEADER + ROW_H_HEADER; // 160
const Y_STEPS = Y_HERO + ROW_H_HERO; // 480
const Y_CONTACT = Y_STEPS + ROW_H_STEPS; // 720
const Y_FOOT = Y_CONTACT + ROW_H_CONTACT; // 1080

export default function LandingPage() {
  const { user } = useAuth();
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
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'theme',
        x: 2 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'lang',
        x: 3 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'signup',
        x: 4 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'tab' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'signin',
        x: 5 * CELL_W, y: Y_HEADER, w: CELL_W, h: ROW_H_HEADER,
        sides: {
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // ── Row 2 — hero (Banner | Tagline | Try Now) ─────────────────────
      // Tagline.top has TWO sockets — one for Theme, one for Lang (their
      // tab centres map to x=500 and x=700, i.e. 0.25 and 0.75 of Tagline's
      // 400-wide top edge).
      {
        id: 'banner',
        x: 0, y: Y_HERO, w: 2 * CELL_W, h: ROW_H_HERO,
        sides: {
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'tagline',
        x: 2 * CELL_W, y: Y_HERO, w: 2 * CELL_W, h: ROW_H_HERO,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'trynow',
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
          top: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'step2',
        x: 2 * CELL_W, y: Y_STEPS, w: 2 * CELL_W, h: ROW_H_STEPS,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          right: { count: 1, type: 'tab' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'step3',
        x: 4 * CELL_W, y: Y_STEPS, w: 2 * CELL_W, h: ROW_H_STEPS,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // ── Rows 4-6 — contact block ──────────────────────────────────────
      // Contact form fills cols 1-4 × all three contact sub-rows; the right
      // column holds Heading / GitHub / CTIS stacked. Contact form's right
      // edge has three tabs (one per right-column piece). Its top has two
      // sockets matching Step1 / Step2 tabs; its bottom has one tab that
      // lands at x=400 of the Copyright top edge.
      {
        id: 'contact',
        x: 0, y: Y_CONTACT, w: 4 * CELL_W, h: ROW_H_CONTACT,
        sides: {
          top: [
            { pos: 0.25, type: 'socket' },
            { pos: 0.75, type: 'socket' },
          ],
          right: [
            { pos: 1 / 6, type: 'tab' },
            { pos: 0.5, type: 'tab' },
            { pos: 5 / 6, type: 'tab' },
          ],
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'heading',
        x: 4 * CELL_W, y: Y_CONTACT, w: 2 * CELL_W, h: CONTACT_ROW_H,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'github',
        x: 4 * CELL_W, y: Y_CONTACT + CONTACT_ROW_H, w: 2 * CELL_W, h: CONTACT_ROW_H,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'ctis',
        x: 4 * CELL_W, y: Y_CONTACT + 2 * CONTACT_ROW_H, w: 2 * CELL_W, h: CONTACT_ROW_H,
        sides: {
          top: { count: 1, type: 'socket' },
          left: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },

      // ── Row 7 — copyright ─────────────────────────────────────────────
      // Two sockets on top: one under the contact form's bottom tab
      // (absolute x=400 → 1/3 of 1200), one under CTIS's bottom tab
      // (absolute x=1000 → 5/6 of 1200).
      {
        id: 'copyright',
        x: 0, y: Y_FOOT, w: BOARD_W, h: ROW_H_FOOT,
        sides: {
          top: [
            { pos: 1 / 3, type: 'socket' },
            { pos: 5 / 6, type: 'socket' },
          ],
        },
      },
    ],
    [],
  );

  const contentById: Record<string, ReactNode> = {
    logo: (
      <Link to="/" className="flex h-full w-full items-center justify-center px-8">
        <BrandMark
          variant="wordmark"
          className="h-20 w-auto max-w-full object-contain"
        />
      </Link>
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
    signup: (
      <Link
        to="/register"
        className="flex h-full w-full items-center justify-center px-4 text-center text-[22px] font-bold text-app-accent-blue transition-colors hover:text-app-accent-dark-blue"
      >
        {t('nav.getStarted')}
      </Link>
    ),
    signin: (
      <Link
        to="/login"
        className="flex h-full w-full items-center justify-center px-4 text-center text-[22px] font-semibold text-app-text transition-colors hover:text-app-accent-blue"
      >
        {t('nav.signIn')}
      </Link>
    ),
    banner: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-10 text-center">
        <h1 className="text-[44px] font-extrabold leading-tight text-app-text">
          {t('hero.titleLine1')}
        </h1>
        <p className="text-[24px] font-semibold text-app-accent-blue">
          {t('hero.titleLine2')}
        </p>
      </div>
    ),
    tagline: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-[26px] font-semibold leading-snug text-app-text">
          {t('pills.noCoding')}
        </p>
        <p className="text-[20px] leading-relaxed text-app-text-muted">
          {t('hero.subtitle')}
        </p>
      </div>
    ),
    trynow: (
      <Link
        to="/register"
        className="flex h-full w-full min-h-0 min-w-0 self-stretch items-center justify-center bg-transparent px-4 text-center text-[26px] font-bold text-app-accent-orange transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-0"
      >
        {t('hero.ctaPrimary')}
      </Link>
    ),
    step1: <StepCard step={1} t={t} accent="inventory" />,
    step2: <StepCard step={2} t={t} accent="invoice" />,
    step3: <StepCard step={3} t={t} accent="hr" />,
    contact: <ContactPlaceholder t={t} />,
    heading: (
      <div className="flex h-full w-full items-center justify-center p-4 text-center">
        <h3 className="text-[22px] font-bold text-app-text">
          {t('footer.contact')}
        </h3>
      </div>
    ),
    github: (
      <a
        href="https://github.com/CustomERP411/CustomERP"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full w-full items-center justify-center gap-3 px-4 text-center text-[20px] font-semibold text-app-text transition-colors hover:text-app-accent-blue"
      >
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12c0-5.52-4.48-10-10-10z" />
        </svg>
        {t('footer.github')}
      </a>
    ),
    ctis: (
      <a
        href="https://ctis.bilkent.edu.tr"
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full w-full items-center justify-center px-4 text-center text-[20px] font-semibold text-app-text transition-colors hover:text-app-accent-blue"
      >
        Bilkent CTIS
      </a>
    ),
    copyright: (
      <div className="flex h-full w-full items-center justify-center px-6 text-center text-[16px] text-app-text-muted">
        {t('footer.copyright')}
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-app-bg transition-colors duration-200">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10">
        <PuzzleBoard
          className="landing-board"
          pieces={pieces}
          contentById={contentById}
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

/** One of the three "how it works" step cards. Uses the existing module
 *  palette tokens so the accent colours differ per step. */
function StepCard({ step, t, accent }: StepCardProps) {
  const accentCls: Record<StepAccent, { badge: string; title: string }> = {
    inventory: {
      badge: 'bg-app-mod-inventory-soft text-app-mod-inventory',
      title: 'text-app-mod-inventory',
    },
    invoice: {
      badge: 'bg-app-mod-invoice-soft text-app-mod-invoice',
      title: 'text-app-mod-invoice',
    },
    hr: {
      badge: 'bg-app-mod-hr-soft text-app-mod-hr',
      title: 'text-app-mod-hr',
    },
  };
  const cls = accentCls[accent];

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span
        className={`inline-flex h-14 w-14 items-center justify-center rounded-xl text-[28px] font-black ${cls.badge}`}
      >
        {step}
      </span>
      <h3 className={`text-[24px] font-bold ${cls.title}`}>
        {t(`howItWorks.step${step}Title`)}
      </h3>
      <p className="max-w-[280px] text-[16px] leading-relaxed text-app-text-muted">
        {t(`howItWorks.step${step}Body`)}
      </p>
    </div>
  );
}

interface ContactPlaceholderProps {
  t: (key: string) => string;
}

/** Placeholder shell for the contact form. Rendered inside the big
 *  Contact piece on the left of the contact block. */
function ContactPlaceholder({ t }: ContactPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-10 text-center">
      <h2 className="text-[32px] font-bold text-app-text">
        {t('cta.heading')}
      </h2>
      <p className="max-w-[520px] text-[18px] leading-relaxed text-app-text-muted">
        {t('cta.body')}
      </p>
      <a
        href="mailto:salpkirisci@gmail.com"
        className="rounded-xl bg-app-accent-blue px-8 py-4 text-[20px] font-semibold text-white shadow-lg transition-transform hover:scale-105"
      >
        salpkirisci@gmail.com
      </a>
    </div>
  );
}
