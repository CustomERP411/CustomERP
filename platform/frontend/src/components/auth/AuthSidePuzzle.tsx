import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import PuzzleBoard from '../../pages/PuzzleBoard';
import type { Piece } from '../puzzle/geometry';
import BrandMark from '../brand/BrandMark';

/**
 * Reusable jigsaw sidebar for the authentication pages.
 *
 * Stacks a brand/tagline piece on top of the three "How It Works" step
 * pieces so that `LoginPage` and `RegisterPage` share the same visual
 * language as the landing page. Rendering goes through the same
 * `PuzzleBoard` used on the landing so outlines, gradients and hover
 * behaviour match 1:1.
 *
 * Renders nothing on small screens — the existing auth pages hide this
 * panel under `lg`, and this component keeps that responsibility at the
 * call-site (via the `hidden lg:flex` wrapper) so the component itself
 * has no media-query concerns.
 */

// Vertical column layout — each piece is full-width, mating via a single
// centred tab/socket pair so the whole sidebar reads as one contiguous
// jigsaw strip.
const CW = 600;
const H_HEADER = 220;
const H_STEP = 150;
const KNOB_R = 26;

export interface AuthSidePuzzleProps {
  /** Render slot for the app wordmark + any brand chrome in the top piece. */
  header?: ReactNode;
}

type StepAccent = 'inventory' | 'invoice' | 'hr';

function StepAccentCls(accent: StepAccent) {
  const byAccent: Record<StepAccent, string> = {
    inventory:
      'border-app-mod-inventory-border bg-app-mod-inventory-soft text-app-mod-inventory',
    invoice:
      'border-app-mod-invoice-border bg-app-mod-invoice-soft text-app-mod-invoice',
    hr: 'border-app-mod-hr-border bg-app-mod-hr-soft text-app-mod-hr',
  };
  return byAccent[accent];
}

export default function AuthSidePuzzle({ header }: AuthSidePuzzleProps) {
  const { t } = useTranslation('landing');
  const { theme } = useTheme();

  const pieces = useMemo<Piece[]>(
    () => [
      {
        id: 'brand',
        x: 0,
        y: 0,
        w: CW,
        h: H_HEADER,
        sides: {
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'step1',
        x: 0,
        y: H_HEADER,
        w: CW,
        h: H_STEP,
        sides: {
          top: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'step2',
        x: 0,
        y: H_HEADER + H_STEP,
        w: CW,
        h: H_STEP,
        sides: {
          top: { count: 1, type: 'socket' },
          bottom: { count: 1, type: 'tab' },
        },
      },
      {
        id: 'step3',
        x: 0,
        y: H_HEADER + H_STEP * 2,
        w: CW,
        h: H_STEP,
        sides: {
          top: { count: 1, type: 'socket' },
        },
      },
    ],
    [],
  );

  const renderStep = (step: 1 | 2 | 3, accent: StepAccent) => (
    <div className="flex h-full w-full items-center gap-4 pl-10 pr-8 py-6 text-left">
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[15px] font-bold ${StepAccentCls(accent)}`}
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="text-[16px] font-semibold text-app-text">
          {t(`howItWorks.step${step}Title`)}
        </h3>
        <p className="text-[13px] leading-relaxed text-app-text-muted">
          {t(`howItWorks.step${step}Body`)}
        </p>
      </div>
    </div>
  );

  const contentById: Record<string, ReactNode> = {
    brand: (
      <div className="flex h-full w-full flex-col items-start justify-center gap-3 px-8 py-6">
        {header ?? (
          <BrandMark
            variant="wordmark"
            className="h-14 w-auto max-w-full object-contain"
          />
        )}
        <p className="text-[14px] leading-relaxed text-app-text-muted">
          {t('hero.subtitle')}
        </p>
      </div>
    ),
    step1: renderStep(1, 'inventory'),
    step2: renderStep(2, 'invoice'),
    step3: renderStep(3, 'hr'),
  };

  return (
    <PuzzleBoard
      className="w-full landing-board"
      pieces={pieces}
      contentById={contentById}
      useLandingGradients
      landingGradientTheme={theme}
      knobR={KNOB_R}
    />
  );
}
