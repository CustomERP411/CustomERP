import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import PuzzlePiece from './PuzzlePiece';
import { computePieceBbox, computePiecePath } from './geometry';
import type { Piece, SideName } from './geometry';
import './PuzzleBoard.css';

const STROKE_PAD = 4;

/**
 * Renders every piece as a `<path>` inside a single `<svg>`, so piece
 * outlines stay seamless and hover/selection can control z-order trivially.
 *
 * The `<svg>` is responsive: it sets a viewBox derived from the piece bbox
 * and renders at `width: 100%` with its natural aspect-ratio, so a parent
 * container controls the display size. Pass `contentById` to drop rich React
 * content into specific pieces (rendered inside `<foreignObject>` on each).
 */

export interface PuzzleBoardProps {
  pieces: Piece[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onKnobClick?: (id: string, side: SideName, pos: number) => void;
  /** Map of piece id → React content rendered inside the piece body. */
  contentById?: Record<string, ReactNode>;
  className?: string;
  style?: CSSProperties;
}

export default function PuzzleBoard({
  pieces,
  selectedId,
  onSelect,
  onKnobClick,
  contentById,
  className,
  style,
}: PuzzleBoardProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const enriched = useMemo(
    () =>
      pieces.map((p) => ({
        ...p,
        path: computePiecePath(p),
        bbox: computePieceBbox(p),
      })),
    [pieces],
  );

  const bbox = useMemo(() => {
    return enriched.reduce(
      (acc, p) => ({
        minX: Math.min(acc.minX, p.bbox.minX),
        minY: Math.min(acc.minY, p.bbox.minY),
        maxX: Math.max(acc.maxX, p.bbox.maxX),
        maxY: Math.max(acc.maxY, p.bbox.maxY),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
  }, [enriched]);

  const vbX = bbox.minX - STROKE_PAD;
  const vbY = bbox.minY - STROKE_PAD;
  const vbW = bbox.maxX - bbox.minX + STROKE_PAD * 2;
  const vbH = bbox.maxY - bbox.minY + STROKE_PAD * 2;

  const ordered = useMemo(() => {
    if (hoveredId == null && selectedId == null) return enriched;
    const promoteIds: string[] = [];
    if (selectedId != null) promoteIds.push(selectedId);
    if (hoveredId != null && hoveredId !== selectedId) promoteIds.push(hoveredId);
    const out = enriched.filter((p) => !promoteIds.includes(p.id));
    for (const id of promoteIds) {
      const top = enriched.find((p) => p.id === id);
      if (top) out.push(top);
    }
    return out;
  }, [enriched, hoveredId, selectedId]);

  const handleHoverStart = (id: string) => setHoveredId(id);
  const handleHoverEnd = (id: string) =>
    setHoveredId((current) => (current === id ? null : current));

  const handleKnobClick = onKnobClick
    ? (ownerId: string, side: SideName, pos: number) => onKnobClick(ownerId, side, pos)
    : undefined;

  return (
    <svg
      className={`puzzle-board${className ? ` ${className}` : ''}`}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {ordered.map((p) => (
        <PuzzlePiece
          key={p.id}
          piece={p}
          path={p.path}
          isHovered={hoveredId === p.id}
          isSelected={selectedId === p.id}
          onHoverStart={handleHoverStart}
          onHoverEnd={handleHoverEnd}
          onSelect={onSelect}
          onKnobClick={handleKnobClick}
          content={contentById?.[p.id]}
        />
      ))}
    </svg>
  );
}
