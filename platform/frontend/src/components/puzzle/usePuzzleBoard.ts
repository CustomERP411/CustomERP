import { useCallback, useMemo, useState } from 'react';
import type { Piece, SideName } from './geometry';
import {
  SIDES,
  changeSide,
  coversNeighbors,
  findNeighbors,
  flipKnob,
  initialFourPieces,
  maxKnobsForSide,
  sideCount,
  sideFor,
  sideType,
} from './board';
import type { ResolvedSideType } from './board';

/**
 * React hook that wraps the whole board state machine. Optional for static
 * boards (just use `<PuzzleBoard pieces={…} />` directly); useful when you
 * want selection + cascade-edit + knob-flip wired up out of the box.
 */

export interface SideInfo {
  data: ReturnType<typeof sideFor>;
  count: number;
  type: ResolvedSideType;
  neighbors: Piece[];
  maxCount: number;
  canCascade: boolean;
  partial: boolean;
}

export interface UsePuzzleBoardOptions {
  initial?: Piece[] | (() => Piece[]);
  initialSelected?: string | null;
  initialCascade?: boolean;
}

export function usePuzzleBoard({
  initial = initialFourPieces,
  initialSelected = 'tl',
  initialCascade = true,
}: UsePuzzleBoardOptions = {}) {
  const [pieces, setPieces] = useState<Piece[]>(() =>
    typeof initial === 'function' ? initial() : initial,
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);
  const [cascade, setCascade] = useState<boolean>(initialCascade);

  const selected = useMemo<Piece | null>(
    () => pieces.find((p) => p.id === selectedId) ?? null,
    [pieces, selectedId],
  );

  const sideInfo = useMemo<Partial<Record<SideName, SideInfo>>>(() => {
    if (!selected) return {};
    const info: Partial<Record<SideName, SideInfo>> = {};
    for (const side of SIDES) {
      const neighbors = findNeighbors(pieces, selected, side);
      const data = sideFor(selected, side);
      const covers = coversNeighbors(selected, side, neighbors);
      info[side] = {
        data,
        count: sideCount(data),
        type: sideType(data),
        neighbors,
        maxCount: maxKnobsForSide(selected, side),
        canCascade: neighbors.length > 0 && covers,
        partial: neighbors.length > 0 && !covers,
      };
    }
    return info;
  }, [pieces, selected]);

  const setSideCount = useCallback(
    (side: SideName, newCount: number) => {
      if (!selectedId) return;
      setPieces((current) => changeSide(current, selectedId, side, newCount, { cascade }));
    },
    [selectedId, cascade],
  );

  const flipKnobAction = useCallback(
    (pieceId: string, side: SideName, pos: number) => {
      setPieces((current) => flipKnob(current, pieceId, side, pos));
    },
    [],
  );

  const reset = useCallback(
    (nextInitial: Piece[] | (() => Piece[]) = initial, nextSelected: string | null = initialSelected) => {
      setPieces(typeof nextInitial === 'function' ? nextInitial() : nextInitial);
      setSelectedId(nextSelected);
    },
    [initial, initialSelected],
  );

  return {
    pieces,
    setPieces,
    selectedId,
    setSelectedId,
    selected,
    cascade,
    setCascade,
    sideInfo,
    setSideCount,
    flipKnob: flipKnobAction,
    reset,
  };
}
