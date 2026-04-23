/**
 * Pure state-manipulation helpers for a puzzle board.
 *
 * A board is an immutable `Piece[]`. Sides may be `'flat'`, a uniform
 * `{ count, type }` object, or an explicit `Knob[]` array. Use `sideCount` /
 * `sideType` to read any form.
 *
 * Ported from the reactpuzzlepiece playground and typed. All mutators return
 * new arrays/objects; they never mutate inputs.
 */

import { KNOB_D, normalizeSide } from './geometry';
import type { Knob, KnobType, Piece, Side, SideName } from './geometry';

export const BIG = 400;
export const MIN_DIM = 80;
export const EPS = 0.01;

export const SIDES: readonly SideName[] = ['top', 'right', 'bottom', 'left'];
export const OPPOSITE: Record<SideName, SideName> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

export function oppositeType(t: KnobType): KnobType {
  return t === 'tab' ? 'socket' : t === 'socket' ? 'tab' : 'flat';
}

let _idCounter = 0;
export function makeId(prefix = 'p'): string {
  return `${prefix}-${_idCounter++}`;
}

// --- Default starting layout -------------------------------------------------

export function initialFourPieces(size = BIG): Piece[] {
  return [
    {
      id: 'tl', x: 0, y: 0, w: size, h: size, label: 'TL',
      sides: {
        right: { count: 1, type: 'tab' },
        bottom: { count: 1, type: 'tab' },
      },
    },
    {
      id: 'tr', x: size, y: 0, w: size, h: size, label: 'TR',
      sides: {
        left: { count: 1, type: 'socket' },
        bottom: { count: 1, type: 'tab' },
      },
    },
    {
      id: 'bl', x: 0, y: size, w: size, h: size, label: 'BL',
      sides: {
        top: { count: 1, type: 'socket' },
        right: { count: 1, type: 'tab' },
      },
    },
    {
      id: 'br', x: size, y: size, w: size, h: size, label: 'BR',
      sides: {
        top: { count: 1, type: 'socket' },
        left: { count: 1, type: 'socket' },
      },
    },
  ];
}

// --- Side-form helpers -------------------------------------------------------

export function sideCount(side: Side): number {
  if (side == null || side === 'flat') return 0;
  if (Array.isArray(side)) return side.length;
  if (side === 'tab' || side === 'socket') return 1;
  if (typeof side === 'object') return (side as { count?: number }).count ?? 0;
  return 0;
}

export type ResolvedSideType = KnobType | 'mixed';

export function sideType(side: Side): ResolvedSideType {
  if (side == null || side === 'flat') return 'flat';
  if (Array.isArray(side)) {
    if (side.length === 0) return 'flat';
    const first = side[0].type;
    return side.every((k) => k.type === first) ? first : 'mixed';
  }
  if (side === 'tab' || side === 'socket') return side;
  if (typeof side === 'object') {
    const obj = side as { count?: number; type?: KnobType };
    if (!obj.count) return 'flat';
    return obj.type ?? 'flat';
  }
  return 'flat';
}

/**
 * Collapse an explicit knob array to `{ count, type }` when all knobs share a
 * type and sit at evenly-spaced positions; otherwise keep the array form.
 */
function collapseKnobs(knobs: Knob[]): Side {
  if (knobs.length === 0) return { count: 0, type: 'flat' };
  const first = knobs[0].type;
  if (!knobs.every((k) => k.type === first)) return knobs;
  const n = knobs.length;
  const even = Array.from({ length: n }, (_, i) => (2 * i + 1) / (2 * n));
  const sorted = [...knobs].sort((a, b) => a.pos - b.pos);
  const allEven = sorted.every((k, i) => Math.abs(k.pos - even[i]) < 1e-4);
  if (allEven) return { count: n, type: first };
  return knobs;
}

// --- Queries -----------------------------------------------------------------

export function sideFor(piece: Piece | null | undefined, side: SideName): Side {
  return piece?.sides?.[side] ?? { count: 0, type: 'flat' };
}

export function maxKnobsForSide(piece: Piece, side: SideName): number {
  const edge = side === 'left' || side === 'right' ? piece.h : piece.w;
  return Math.max(1, Math.floor(edge / KNOB_D));
}

export function findNeighbors(pieces: Piece[], piece: Piece, side: SideName): Piece[] {
  const pid = piece.id;
  if (side === 'right') {
    const x = piece.x + piece.w;
    return pieces.filter(
      (p) =>
        p.id !== pid &&
        Math.abs(p.x - x) < EPS &&
        p.y < piece.y + piece.h - EPS &&
        p.y + p.h > piece.y + EPS,
    );
  }
  if (side === 'left') {
    const x = piece.x;
    return pieces.filter(
      (p) =>
        p.id !== pid &&
        Math.abs(p.x + p.w - x) < EPS &&
        p.y < piece.y + piece.h - EPS &&
        p.y + p.h > piece.y + EPS,
    );
  }
  if (side === 'bottom') {
    const y = piece.y + piece.h;
    return pieces.filter(
      (p) =>
        p.id !== pid &&
        Math.abs(p.y - y) < EPS &&
        p.x < piece.x + piece.w - EPS &&
        p.x + p.w > piece.x + EPS,
    );
  }
  // top
  const y = piece.y;
  return pieces.filter(
    (p) =>
      p.id !== pid &&
      Math.abs(p.y + p.h - y) < EPS &&
      p.x < piece.x + piece.w - EPS &&
      p.x + p.w > piece.x + EPS,
  );
}

export function findNeighborAtKnob(
  pieces: Piece[],
  piece: Piece,
  side: SideName,
  pos: number,
): Piece | null {
  const neighbors = findNeighbors(pieces, piece, side);
  if (neighbors.length === 0) return null;
  if (side === 'left' || side === 'right') {
    const y = piece.y + pos * piece.h;
    return neighbors.find((n) => n.y <= y + EPS && n.y + n.h >= y - EPS) ?? null;
  }
  const x = piece.x + pos * piece.w;
  return neighbors.find((n) => n.x <= x + EPS && n.x + n.w >= x - EPS) ?? null;
}

export function coversNeighbors(piece: Piece, side: SideName, neighbors: Piece[]): boolean {
  if (neighbors.length === 0) return true;
  if (side === 'left' || side === 'right') {
    const nMin = Math.min(...neighbors.map((n) => n.y));
    const nMax = Math.max(...neighbors.map((n) => n.y + n.h));
    return piece.y <= nMin + EPS && piece.y + piece.h >= nMax - EPS;
  }
  const nMin = Math.min(...neighbors.map((n) => n.x));
  const nMax = Math.max(...neighbors.map((n) => n.x + n.w));
  return piece.x <= nMin + EPS && piece.x + piece.w >= nMax - EPS;
}

export function edgesMatch(piece: Piece, neighbor: Piece, side: SideName): boolean {
  if (side === 'left' || side === 'right') {
    return Math.abs(piece.y - neighbor.y) < EPS && Math.abs(piece.h - neighbor.h) < EPS;
  }
  return Math.abs(piece.x - neighbor.x) < EPS && Math.abs(piece.w - neighbor.w) < EPS;
}

export interface Region { xMin: number; yMin: number; xMax: number; yMax: number }

export function piecesInRegion(pieces: Piece[], region: Region, excludeId: string): Piece[] {
  const { xMin, yMin, xMax, yMax } = region;
  return pieces.filter(
    (p) =>
      p.id !== excludeId &&
      p.x >= xMin - EPS &&
      p.y >= yMin - EPS &&
      p.x + p.w <= xMax + EPS &&
      p.y + p.h <= yMax + EPS,
  );
}

// --- Mutations ---------------------------------------------------------------

export function updatePiece(
  pieces: Piece[],
  pieceId: string,
  updater: (p: Piece) => Piece,
): Piece[] {
  return pieces.map((p) => (p.id === pieceId ? updater(p) : p));
}

export function setPieceSide(piece: Piece, side: SideName, newSide: Side): Piece {
  return { ...piece, sides: { ...piece.sides, [side]: newSide } };
}

export function resolveType(
  piece: Piece,
  side: SideName,
  neighbors: Piece[],
  newCount: number,
): KnobType {
  if (newCount === 0) return 'flat';
  const curType = sideType(sideFor(piece, side));
  if (curType === 'tab' || curType === 'socket') return curType;
  if (neighbors.length > 0) {
    const nbType = sideType(sideFor(neighbors[0], OPPOSITE[side]));
    if (nbType === 'tab' || nbType === 'socket') return oppositeType(nbType);
  }
  return 'tab';
}

/**
 * Cascade split: replace every piece fully contained in the neighbour
 * bounding-box with `newCount` sub-pieces that mate with the changing side.
 */
export function splitNeighborsOnSide(
  pieces: Piece[],
  pieceId: string,
  side: SideName,
  newCount: number,
  knobType: KnobType,
): Piece[] {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return pieces;
  const neighbors = findNeighbors(pieces, piece, side);
  if (neighbors.length === 0) return pieces;

  const xMin = Math.min(...neighbors.map((n) => n.x));
  const xMax = Math.max(...neighbors.map((n) => n.x + n.w));
  const yMin = Math.min(...neighbors.map((n) => n.y));
  const yMax = Math.max(...neighbors.map((n) => n.y + n.h));

  const region: Region = { xMin, yMin, xMax, yMax };
  const toRemove = piecesInRegion(pieces, region, pieceId);

  const topN = neighbors.find((n) => Math.abs(n.y - yMin) < EPS);
  const bottomN = neighbors.find((n) => Math.abs(n.y + n.h - yMax) < EPS);
  const leftN = neighbors.find((n) => Math.abs(n.x - xMin) < EPS);
  const rightN = neighbors.find((n) => Math.abs(n.x + n.w - xMax) < EPS);

  const mateSide = OPPOSITE[side];
  const oppType = oppositeType(knobType);

  const baseLabel =
    topN?.label || bottomN?.label || leftN?.label || rightN?.label || 'S';

  let rest = pieces.filter((p) => !toRemove.some((n) => n.id === p.id));
  const subs: Piece[] = [];

  const isVerticalSplit = side === 'right' || side === 'left';

  const farSide = side;
  const farN = isVerticalSplit
    ? side === 'right' ? rightN : leftN
    : side === 'bottom' ? bottomN : topN;
  const farOrig = sideFor(farN ?? null, farSide);
  const farOrigType = sideType(farOrig);
  const farHasKnobs = farOrigType !== 'flat' && sideCount(farOrig) > 0;

  if (isVerticalSplit) {
    const h = (yMax - yMin) / newCount;
    const w = xMax - xMin;
    if (h < MIN_DIM) return pieces;

    for (let i = 0; i < newCount; i++) {
      const sides: Partial<Record<SideName, Side>> = {
        [mateSide]: { count: 1, type: oppType },
      };
      if (i === 0) {
        const topSide = sideFor(topN ?? null, 'top');
        if (sideType(topSide) !== 'flat') sides.top = topSide;
      } else {
        sides.top = { count: 1, type: 'socket' };
      }
      if (i === newCount - 1) {
        const botSide = sideFor(bottomN ?? null, 'bottom');
        if (sideType(botSide) !== 'flat') sides.bottom = botSide;
      } else {
        sides.bottom = { count: 1, type: 'tab' };
      }
      if (farHasKnobs && (farOrigType === 'tab' || farOrigType === 'socket')) {
        sides[farSide] = { count: 1, type: farOrigType };
      }

      subs.push({
        id: makeId('p'),
        x: xMin,
        y: yMin + i * h,
        w,
        h,
        label: newCount === 1 ? baseLabel : `${baseLabel}${i}`,
        sides,
      });
    }
  } else {
    const w = (xMax - xMin) / newCount;
    const h = yMax - yMin;
    if (w < MIN_DIM) return pieces;

    for (let i = 0; i < newCount; i++) {
      const sides: Partial<Record<SideName, Side>> = {
        [mateSide]: { count: 1, type: oppType },
      };
      if (i === 0) {
        const leftSide = sideFor(leftN ?? null, 'left');
        if (sideType(leftSide) !== 'flat') sides.left = leftSide;
      } else {
        sides.left = { count: 1, type: 'socket' };
      }
      if (i === newCount - 1) {
        const rightSide = sideFor(rightN ?? null, 'right');
        if (sideType(rightSide) !== 'flat') sides.right = rightSide;
      } else {
        sides.right = { count: 1, type: 'tab' };
      }
      if (farHasKnobs && (farOrigType === 'tab' || farOrigType === 'socket')) {
        sides[farSide] = { count: 1, type: farOrigType };
      }

      subs.push({
        id: makeId('p'),
        x: xMin + i * w,
        y: yMin,
        w,
        h,
        label: newCount === 1 ? baseLabel : `${baseLabel}${i}`,
        sides,
      });
    }
  }

  if (farHasKnobs && (farOrigType === 'tab' || farOrigType === 'socket')) {
    let farFarPiece: Piece | undefined;
    const nearSideOnFarFar = OPPOSITE[farSide];

    if (isVerticalSplit) {
      if (side === 'right') {
        farFarPiece = rest.find(
          (p) =>
            Math.abs(p.x - xMax) < EPS &&
            Math.abs(p.y - yMin) < EPS &&
            Math.abs(p.y + p.h - yMax) < EPS,
        );
      } else {
        farFarPiece = rest.find(
          (p) =>
            Math.abs(p.x + p.w - xMin) < EPS &&
            Math.abs(p.y - yMin) < EPS &&
            Math.abs(p.y + p.h - yMax) < EPS,
        );
      }
    } else {
      if (side === 'bottom') {
        farFarPiece = rest.find(
          (p) =>
            Math.abs(p.y - yMax) < EPS &&
            Math.abs(p.x - xMin) < EPS &&
            Math.abs(p.x + p.w - xMax) < EPS,
        );
      } else {
        farFarPiece = rest.find(
          (p) =>
            Math.abs(p.y + p.h - yMin) < EPS &&
            Math.abs(p.x - xMin) < EPS &&
            Math.abs(p.x + p.w - xMax) < EPS,
        );
      }
    }

    if (farFarPiece) {
      const farFarId = farFarPiece.id;
      rest = rest.map((p) =>
        p.id === farFarId
          ? {
              ...p,
              sides: {
                ...p.sides,
                [nearSideOnFarFar]: {
                  count: newCount,
                  type: oppositeType(farOrigType),
                },
              },
            }
          : p,
      );
    }
  }

  return [...rest, ...subs];
}

export function changeSide(
  pieces: Piece[],
  pieceId: string,
  side: SideName,
  newCount: number,
  { cascade = true }: { cascade?: boolean } = {},
): Piece[] {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return pieces;

  const current = sideFor(piece, side);
  if (sideCount(current) === newCount) return pieces;

  const neighbors = findNeighbors(pieces, piece, side);
  const covers = coversNeighbors(piece, side, neighbors);
  const newType = resolveType(piece, side, neighbors, newCount);
  const newSide: Side = { count: newCount, type: newType };

  if (cascade && newCount > 0 && neighbors.length > 0 && covers) {
    let next = splitNeighborsOnSide(pieces, pieceId, side, newCount, newType);
    next = updatePiece(next, pieceId, (p) => setPieceSide(p, side, newSide));
    return next;
  }

  let next = updatePiece(pieces, pieceId, (p) => setPieceSide(p, side, newSide));
  if (neighbors.length === 1 && edgesMatch(piece, neighbors[0], side)) {
    const nb = neighbors[0];
    next = updatePiece(next, nb.id, (p) =>
      setPieceSide(p, OPPOSITE[side], {
        count: newCount,
        type: oppositeType(newType),
      }),
    );
  }
  return next;
}

// --- Knob flip ---------------------------------------------------------------

function mapKnobPosToNeighbor(
  piece: Piece,
  side: SideName,
  pos: number,
  neighbor: Piece,
): number {
  if (side === 'left' || side === 'right') {
    const absY = piece.y + pos * piece.h;
    return (absY - neighbor.y) / neighbor.h;
  }
  const absX = piece.x + pos * piece.w;
  return (absX - neighbor.x) / neighbor.w;
}

function flipKnobInSide(side: Side, pos: number): { newSide: Side; flipped: boolean } {
  const knobs = normalizeSide(side);
  if (knobs.length === 0) return { newSide: side, flipped: false };

  let bestIdx = 0;
  let bestDist = Math.abs(knobs[0].pos - pos);
  for (let i = 1; i < knobs.length; i++) {
    const d = Math.abs(knobs[i].pos - pos);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  const tol = 0.5 / knobs.length + 1e-3;
  if (bestDist > tol) return { newSide: side, flipped: false };

  const knob = knobs[bestIdx];
  const newType = oppositeType(knob.type);
  if (newType === knob.type || newType === 'flat') {
    return { newSide: side, flipped: false };
  }

  const newKnobs: Knob[] = knobs.map((k, i) =>
    i === bestIdx ? { pos: k.pos, type: newType } : { pos: k.pos, type: k.type },
  );
  return { newSide: collapseKnobs(newKnobs), flipped: true };
}

export function flipKnob(
  pieces: Piece[],
  pieceId: string,
  side: SideName,
  pos: number,
): Piece[] {
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return pieces;

  const neighbor = findNeighborAtKnob(pieces, piece, side, pos);
  if (!neighbor) return pieces;

  const pieceResult = flipKnobInSide(sideFor(piece, side), pos);
  if (!pieceResult.flipped) return pieces;

  const nbPos = mapKnobPosToNeighbor(piece, side, pos, neighbor);
  const nbSideName = OPPOSITE[side];
  const nbResult = flipKnobInSide(sideFor(neighbor, nbSideName), nbPos);

  let next = updatePiece(pieces, pieceId, (p) =>
    setPieceSide(p, side, pieceResult.newSide),
  );
  if (nbResult.flipped) {
    const neighborId = neighbor.id;
    next = updatePiece(next, neighborId, (p) =>
      setPieceSide(p, nbSideName, nbResult.newSide),
    );
  }
  return next;
}
