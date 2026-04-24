import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { KNOB_R, TAB, computeKnobs, knobHitCenter } from '../components/puzzle/geometry';
import type { Piece, SideName } from '../components/puzzle/geometry';

const HIT_R_RATIO = 0.75;

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
 * If `action` is provided, the whole piece shape (including protruding knobs)
 * becomes a single click target: an SVG `<a>` is rendered on top of the body
 * with an invisible overlay `<path>` matching the piece geometry. This lets
 * the landing page treat nav / social buttons as puzzle pieces rather than
 * only their rectangular bodies.
 *
 * Tabs (if `onKnobClick` is provided) get a small invisible circular hit
 * region on top so a click on a tab routes to the knob owner.
 */

export interface PieceAction {
  /** Target URL. For internal navigation, also supply `onClick` that calls
   * `navigate()` (so right-click / ctrl-click still opens in a new tab). */
  href: string;
  target?: string;
  rel?: string;
  /**
   * Click handler. `<a>` inside an `<svg>` is typed as `HTMLAnchorElement`
   * by React's JSX types (even though the runtime element is `SVGAElement`),
   * so we accept both via `Element`.
   */
  onClick?: (e: MouseEvent<Element>) => void;
  ariaLabel?: string;
}

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
  /** When set (e.g. `url(#id)` from the parent `<svg>` defs), overrides CSS fill. */
  pathFill?: string;
  /** When set, overrides CSS stroke (e.g. URL to a stroke gradient). */
  pathStroke?: string;
  /**
   * Merged `style` for the piece `<path>` (e.g. fill URL + `stroke: none` for
   * landing back-light). If set, takes precedence over `pathFill` / `pathStroke` alone.
   */
  pathStyle?: CSSProperties;
  /** When set, the whole piece outline becomes a link: overlay `<a><path/></a>`. */
  action?: PieceAction;
  /** Tab/socket protrusion radius. Matches the board's `knobR` so knob hit
   *  regions stay centred on the protrusions even when the board renders at
   *  a non-default scale (e.g. mobile). */
  knobR?: number;
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
  pathFill,
  pathStroke,
  pathStyle: pathStyleProp,
  action,
  knobR = KNOB_R,
}: PuzzlePieceProps) {
  const { id, x, y, w, h, label } = piece;
  const knobs = computeKnobs(piece);
  const hitR = knobR * HIT_R_RATIO;

  const pathStyle: CSSProperties | undefined = pathStyleProp
    ? pathStyleProp
    : pathFill != null || pathStroke != null
      ? {
          ...(pathFill != null && { fill: pathFill }),
          ...(pathStroke != null && { stroke: pathStroke }),
        }
      : undefined;

  return (
    <g
      data-piece-id={id}
      className={`piece ${isHovered ? 'piece--hover' : ''} ${isSelected ? 'piece--selected' : ''} ${action ? 'piece--interactive' : ''}`}
      onMouseEnter={() => onHoverStart?.(id)}
      onMouseLeave={() => onHoverEnd?.(id)}
      onClick={() => onSelect?.(id)}
    >
      <path d={path} className="piece__path" style={pathStyle} />

      {content != null && (
        <foreignObject x={x} y={y} width={w} height={h} className="piece__content">
          <div className="piece__content-inner" style={{ width: '100%', height: '100%' }}>
            {content}
          </div>
        </foreignObject>
      )}

      {content == null && label && (
        <text x={x + w / 2} y={y + h / 2} className="piece__label">
          {label}
        </text>
      )}

      {action && (
        <a
          href={action.href}
          target={action.target}
          rel={action.rel}
          aria-label={action.ariaLabel}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick?.(e);
          }}
        >
          <path d={path} className="piece__clickable" />
        </a>
      )}

      {onKnobClick &&
        knobs
          .filter((k) => k.type === TAB)
          .map((k) => {
            const { hx, hy } = knobHitCenter(k.side, k.cx, k.cy, knobR);
            return (
              <circle
                key={`${k.side}-${k.pos}`}
                cx={hx}
                cy={hy}
                r={hitR}
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
