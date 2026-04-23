import React from 'react';

/**
 * PuzzlePiece — a single interlocking tile used by the landing page.
 *
 * A piece is a rectangle with up to four circular knobs, one per edge. Each
 * knob is either a `tab` (protrudes outward, same colour as the piece) or a
 * `socket` (sits inside the edge, colour-matched to the parent section so it
 * reads as a cutout). Tabs have a higher z-index so a neighbour's tab visually
 * covers this piece's adjacent socket — the two together look like a single
 * interlocked shape.
 *
 * Orientation is responsive:
 *   - Desktop (md+): only `left` / `right` knobs are shown.
 *   - Mobile  (<md): only `top`  / `bottom` knobs are shown.
 * The DOM column flow already flips at md, so the caller simply declares all
 * four edges and the component picks the right pair per breakpoint.
 *
 * Colours are always Tailwind `app-*` token classes — no hex values ever.
 */

type KnobKind = 'tab' | 'socket' | 'none';

export interface PuzzlePieceProps {
  /** Tailwind bg utility for the piece and its tabs. Default `bg-app-surface`. */
  bg?: string;
  /** Tailwind text utility. Default `text-app-text`. */
  text?: string;
  /** Tailwind bg utility for sockets (= parent section bg). Default `bg-app-bg`. */
  sectionBg?: string;
  /** Edge knobs — set to 'none' / omit to leave an edge flat. */
  left?: KnobKind;
  right?: KnobKind;
  top?: KnobKind;
  bottom?: KnobKind;
  /** Adds hover lift + dark-mode neon glow. */
  interactive?: boolean;
  /** Grid span on md+ (1, 2, or 3). Default 1. */
  colSpan?: 1 | 2 | 3;
  /** Extra classes on the piece body (padding, rounded, text size, etc.). */
  className?: string;
  /** Optional inline styles (rarely needed). */
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const COL_SPAN_CLS: Record<1 | 2 | 3, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
};

function knob(
  kind: KnobKind,
  edge: 'left' | 'right' | 'top' | 'bottom',
  pieceBg: string,
  sectionBg: string,
): React.ReactNode {
  if (kind === 'none' || !kind) return null;
  const isHorizontal = edge === 'left' || edge === 'right';
  const visibility = isHorizontal ? 'hidden md:block' : 'block md:hidden';
  const color = kind === 'tab' ? pieceBg : sectionBg;
  const kindCls = kind === 'tab' ? 'puzzle-knob--tab' : 'puzzle-knob--socket';
  return (
    <span
      aria-hidden="true"
      className={`puzzle-knob puzzle-knob--${edge} ${kindCls} ${color} ${visibility}`}
    />
  );
}

export default function PuzzlePiece({
  bg = 'bg-app-surface',
  text = 'text-app-text',
  sectionBg = 'bg-app-bg',
  left = 'none',
  right = 'none',
  top = 'none',
  bottom = 'none',
  interactive = false,
  colSpan = 1,
  className = '',
  style,
  children,
}: PuzzlePieceProps) {
  return (
    <div
      className={[
        'puzzle-piece',
        interactive ? 'interactive' : '',
        bg,
        text,
        COL_SPAN_CLS[colSpan],
        'rounded-2xl',
        'overflow-visible',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {knob(left,   'left',   bg, sectionBg)}
      {knob(right,  'right',  bg, sectionBg)}
      {knob(top,    'top',    bg, sectionBg)}
      {knob(bottom, 'bottom', bg, sectionBg)}
      <div className="relative z-[3] h-full w-full">{children}</div>
    </div>
  );
}
