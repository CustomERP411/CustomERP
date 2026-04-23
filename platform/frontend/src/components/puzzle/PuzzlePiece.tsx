import type { ReactNode } from 'react';
import { KNOB_R, TAB, computeKnobs, knobHitCenter } from './geometry';
import type { Piece, SideName } from './geometry';

/**
 * Single puzzle piece rendered as `<g><path/></g>` inside a parent `<svg>`
 * (typically `<PuzzleBoard>`). A piece can render one of:
 *
 *   - `label` — a centred SVG `<text>` (useful for demos / playgrounds).
 *   - `content` — any React node, rendered inside a `<foreignObject>` sized to
 *     the piece body. This is the escape hatch that lets a piece host rich
 *     HTML (buttons, forms, images, other React components) while the piece's
 *     outline stays a single seamless SVG path.
 *
 * Tabs (if `onKnobClick` is provided) get a small invisible circular hit
 * region on top so a click on a tab routes to the knob owner.
 */

const HIT_R = KNOB_R * 0.75;

export interface PuzzlePieceProps {
  piece: Piece;
  path: string;
  isHovered?: boolean;
  isSelected?: boolean;
  onHoverStart?: (id: string) => void;
  onHoverEnd?: (id: string) => void;
  onSelect?: (id: string) => void;
  onKnobClick?: (id: string, side: SideName, pos: number) => void;
  /** Rich React content rendered inside a `<foreignObject>` sized to the piece body. */
  content?: ReactNode;
}

export default function PuzzlePiece({
  piece,
  path,
  isHovered,
  isSelected,
  onHoverStart,
  onHoverEnd,
  onSelect,
  onKnobClick,
  content,
}: PuzzlePieceProps) {
  const { id, x, y, w, h, label } = piece;
  const knobs = computeKnobs(piece);

  return (
    <g
      className={`piece ${isHovered ? 'piece--hover' : ''} ${isSelected ? 'piece--selected' : ''}`}
      onMouseEnter={() => onHoverStart?.(id)}
      onMouseLeave={() => onHoverEnd?.(id)}
      onClick={() => onSelect?.(id)}
    >
      <path d={path} className="piece__path" />

      {content != null && (
        <foreignObject x={x} y={y} width={w} height={h} className="piece__content">
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            className="piece__content-inner"
            style={{ width: '100%', height: '100%' }}
          >
            {content}
          </div>
        </foreignObject>
      )}

      {content == null && label && (
        <text x={x + w / 2} y={y + h / 2} className="piece__label">
          {label}
        </text>
      )}

      {onKnobClick &&
        knobs
          .filter((k) => k.type === TAB)
          .map((k) => {
            const { hx, hy } = knobHitCenter(k.side, k.cx, k.cy);
            return (
              <circle
                key={`${k.side}-${k.pos}`}
                cx={hx}
                cy={hy}
                r={HIT_R}
                className="piece__knob-hit"
                onClick={(e) => {
                  e.stopPropagation();
                  onKnobClick(id, k.side, k.pos);
                }}
              />
            );
          })}
    </g>
  );
}
