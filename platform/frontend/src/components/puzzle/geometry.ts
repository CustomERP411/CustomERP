/**
 * Pure geometry helpers for puzzle pieces. No React in this file — it can be
 * used anywhere (tests, SSR, workers…).
 *
 * Ported from the reactpuzzlepiece playground (see project README) and typed.
 */

export const KNOB_R = 30;
export const KNOB_D = KNOB_R * 2;

export const FLAT = 'flat' as const;
export const TAB = 'tab' as const;
export const SOCKET = 'socket' as const;

export type KnobType = typeof FLAT | typeof TAB | typeof SOCKET;

/** A single knob descriptor along a side, in normalized position space [0, 1]. */
export interface Knob {
  pos: number;
  type: KnobType;
}

/** The canonical storage forms for a single side of a piece. */
export type Side =
  | typeof FLAT
  | typeof TAB
  | typeof SOCKET
  | { count: number; type: KnobType }
  | readonly Knob[]
  | undefined;

/** Which edge a knob belongs to. */
export type SideName = 'top' | 'right' | 'bottom' | 'left';

export interface Piece {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  sides?: Partial<Record<SideName, Side>>;
}

export interface Bbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface AbsoluteKnob extends Knob {
  side: SideName;
  cx: number;
  cy: number;
}

/** Produce `count` evenly-spaced knob descriptors along a side. */
export function evenlySpaced(count: number, type: KnobType): Knob[] {
  return Array.from({ length: count }, (_, i) => ({
    pos: (2 * i + 1) / (2 * count),
    type,
  }));
}

/** Accept any supported side shape and return a flat Knob[]. */
export function normalizeSide(side: Side): Knob[] {
  if (!side || side === FLAT) return [];
  if (side === TAB) return [{ pos: 0.5, type: TAB }];
  if (side === SOCKET) return [{ pos: 0.5, type: SOCKET }];
  if (Array.isArray(side)) {
    return side.map((k) => ({ pos: k.pos, type: k.type }));
  }
  if (typeof side === 'object' && 'count' in side && side.count > 0 && side.type) {
    return evenlySpaced(side.count, side.type);
  }
  return [];
}

function hasTab(side: Side): boolean {
  return normalizeSide(side).some((k) => k.type === TAB);
}

function sweepFor(type: KnobType): 0 | 1 {
  return type === TAB ? 1 : 0;
}

/**
 * Build a single SVG `d` attribute for a piece. The outline is seamless —
 * no internal lines at knob bases — because the path walks the full
 * perimeter including each tab/socket arc.
 */
export function computePiecePath(piece: Piece): string {
  const { x, y, w, h } = piece;
  const top = normalizeSide(piece.sides?.top);
  const right = normalizeSide(piece.sides?.right);
  const bottom = normalizeSide(piece.sides?.bottom);
  const left = normalizeSide(piece.sides?.left);

  const parts: string[] = [`M ${x} ${y}`];

  for (const k of top) {
    const cx = x + k.pos * w;
    parts.push(`L ${cx - KNOB_R} ${y}`);
    parts.push(`A ${KNOB_R} ${KNOB_R} 0 0 ${sweepFor(k.type)} ${cx + KNOB_R} ${y}`);
  }
  parts.push(`L ${x + w} ${y}`);

  for (const k of right) {
    const cy = y + k.pos * h;
    parts.push(`L ${x + w} ${cy - KNOB_R}`);
    parts.push(`A ${KNOB_R} ${KNOB_R} 0 0 ${sweepFor(k.type)} ${x + w} ${cy + KNOB_R}`);
  }
  parts.push(`L ${x + w} ${y + h}`);

  for (const k of [...bottom].reverse()) {
    const cx = x + k.pos * w;
    parts.push(`L ${cx + KNOB_R} ${y + h}`);
    parts.push(`A ${KNOB_R} ${KNOB_R} 0 0 ${sweepFor(k.type)} ${cx - KNOB_R} ${y + h}`);
  }
  parts.push(`L ${x} ${y + h}`);

  for (const k of [...left].reverse()) {
    const cy = y + k.pos * h;
    parts.push(`L ${x} ${cy + KNOB_R}`);
    parts.push(`A ${KNOB_R} ${KNOB_R} 0 0 ${sweepFor(k.type)} ${x} ${cy - KNOB_R}`);
  }
  parts.push(`L ${x} ${y}`, 'Z');

  return parts.join(' ');
}

/**
 * Describe every knob on a piece as absolute SVG coordinates, so consumers
 * can overlay hit regions, labels, etc.
 */
export function computeKnobs(piece: Piece): AbsoluteKnob[] {
  const { x, y, w, h } = piece;
  const knobs: AbsoluteKnob[] = [];
  for (const k of normalizeSide(piece.sides?.top)) {
    knobs.push({ side: 'top', type: k.type, pos: k.pos, cx: x + k.pos * w, cy: y });
  }
  for (const k of normalizeSide(piece.sides?.right)) {
    knobs.push({ side: 'right', type: k.type, pos: k.pos, cx: x + w, cy: y + k.pos * h });
  }
  for (const k of normalizeSide(piece.sides?.bottom)) {
    knobs.push({ side: 'bottom', type: k.type, pos: k.pos, cx: x + k.pos * w, cy: y + h });
  }
  for (const k of normalizeSide(piece.sides?.left)) {
    knobs.push({ side: 'left', type: k.type, pos: k.pos, cx: x, cy: y + k.pos * h });
  }
  return knobs;
}

const HIT_OFFSET = KNOB_R * 0.5;

/** Centre point for a hit region over a knob's visible protrusion. */
export function knobHitCenter(
  side: SideName,
  cx: number,
  cy: number,
): { hx: number; hy: number } {
  if (side === 'top') return { hx: cx, hy: cy - HIT_OFFSET };
  if (side === 'bottom') return { hx: cx, hy: cy + HIT_OFFSET };
  if (side === 'left') return { hx: cx - HIT_OFFSET, hy: cy };
  return { hx: cx + HIT_OFFSET, hy: cy };
}

/**
 * Bounding box including any outward-pointing tabs, used to pad the viewBox
 * so strokes on protruding knobs aren't clipped.
 */
export function computePieceBbox(piece: Piece): Bbox {
  const { x, y, w, h, sides = {} } = piece;
  const extL = hasTab(sides.left) ? KNOB_R : 0;
  const extR = hasTab(sides.right) ? KNOB_R : 0;
  const extT = hasTab(sides.top) ? KNOB_R : 0;
  const extB = hasTab(sides.bottom) ? KNOB_R : 0;
  return {
    minX: x - extL,
    minY: y - extT,
    maxX: x + w + extR,
    maxY: y + h + extB,
  };
}
