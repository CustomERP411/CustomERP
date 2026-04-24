import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import PuzzlePiece from './PuzzlePiece';
import { computePieceBbox, computePiecePath } from '../components/puzzle/geometry';
import type { Piece, SideName } from '../components/puzzle/geometry';
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
 *
 * Set `useLandingGradients` + `landingGradientTheme` for a back-plate + face
 * fill + **opaque** edge strokes (mouse-scoped `radialGradient` in user space).
 * Light and dark each use a tuned stop set in `LandingBoardDefs`.
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
  /**
   * When true, render SVG defs and pass `fill` / `stroke` `url(#id)` to each
   * piece. Used for the landing jigsaw in both themes when enabled.
   */
  useLandingGradients?: boolean;
  /** Drives def stop colours for the landing board (`useLandingGradients`). */
  landingGradientTheme?: 'light' | 'dark';
}

function LandingBoardDefs({
  vbX,
  vbY,
  vbW,
  vbH,
  backId,
  fillId,
  rimId,
  rimX,
  rimY,
  variant,
}: {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  backId: string;
  fillId: string;
  rimId: string;
  rimX: number;
  rimY: number;
  variant: 'light' | 'dark';
}) {
  const x2 = vbX + vbW;
  const y2 = vbY + vbH;
  const r = Math.max(vbW, vbH) * 0.85;

  // Rim / back / fill stops tuned to the app's warm tan / deep espresso
  // semantic palette (see `--app-*` tokens in src/index.css). The board reads
  // as a subtle inset bevel over `--app-bg` rather than a high-contrast
  // black-line puzzle — the brand orange (#FF5400) + navy (#004AA6) pop on
  // top of the warm neutrals.
  const rimStops =
    variant === 'light'
      ? [
          { o: '0%', c: '#FBF5E6' },
          { o: '22%', c: '#F2EAD8' },
          { o: '48%', c: '#CFC0A3' },
          { o: '72%', c: '#A08C69' },
          { o: '100%', c: '#74623F' },
        ]
      : [
          { o: '0%', c: '#503F29' },
          { o: '25%', c: '#3A2F1F' },
          { o: '50%', c: '#2B2318' },
          { o: '75%', c: '#1F1910' },
          { o: '100%', c: '#14100A' },
        ];

  const backStops =
    variant === 'light'
      ? [
          ['0%', '#F2EAD8'],
          ['25%', '#E6DBC6'],
          ['50%', '#E0D4BB'],
          ['75%', '#DED0B5'],
          ['100%', '#CFC0A3'],
        ]
      : [
          ['0%', '#1F1910'],
          ['25%', '#2B2318'],
          ['50%', '#181208'],
          ['75%', '#1F1910'],
          ['100%', '#14100A'],
        ];

  const fillStops =
    variant === 'light'
      ? [
          ['0%', '#FBF5E6'],
          ['22%', '#F2EAD8'],
          ['45%', '#E6DBC6'],
          ['65%', '#E0D4BB'],
          ['85%', '#DED0B5'],
          ['100%', '#CFC0A3'],
        ]
      : [
          ['0%', '#2B2318'],
          ['22%', '#24201A'],
          ['45%', '#1F1910'],
          ['65%', '#252118'],
          ['85%', '#2B2318'],
          ['100%', '#14100A'],
        ];

  return (
    <defs>
      <radialGradient
        id={rimId}
        gradientUnits="userSpaceOnUse"
        cx={rimX}
        cy={rimY}
        r={r}
      >
        {rimStops.map((s) => (
          <stop key={s.o} offset={s.o} stopColor={s.c} stopOpacity="1" />
        ))}
      </radialGradient>

      <linearGradient
        id={backId}
        gradientUnits="userSpaceOnUse"
        x1={vbX}
        y1={vbY}
        x2={x2}
        y2={y2}
      >
        {backStops.map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </linearGradient>

      <linearGradient
        id={fillId}
        gradientUnits="userSpaceOnUse"
        x1={vbX}
        y1={vbY}
        x2={x2}
        y2={y2}
      >
        {fillStops.map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </linearGradient>
    </defs>
  );
}

export default function PuzzleBoard({
  pieces,
  selectedId,
  onSelect,
  onKnobClick,
  contentById,
  className,
  style,
  useLandingGradients = false,
  landingGradientTheme = 'light',
}: PuzzleBoardProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rimAt, setRimAt] = useState<{ x: number; y: number } | null>(null);
  const reactId = useId().replace(/:/g, '');
  const backGradId = `pg-back-${reactId}`;
  const fillGradId = `pg-fill-${reactId}`;
  const rimGradId = `pg-rim-${reactId}`;

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

  const rimX = rimAt?.x ?? vbX + vbW / 2;
  const rimY = rimAt?.y ?? vbY + vbH / 2;

  useEffect(() => {
    if (!useLandingGradients) return;
    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const ex = (e.clientX - rect.left) * (vbW / rect.width) + vbX;
      const ey = (e.clientY - rect.top) * (vbH / rect.height) + vbY;
      setRimAt({ x: ex, y: ey });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [useLandingGradients, vbX, vbY, vbW, vbH]);

  const pathStyleLanding = useLandingGradients
    ? {
        fill: `url(#${fillGradId})`,
        stroke: `url(#${rimGradId})`,
        strokeWidth: 1.85,
        strokeLinejoin: 'round' as const,
        paintOrder: 'fill' as const,
      }
    : undefined;

  const boardClass = [
    'puzzle-board',
    useLandingGradients ? 'puzzle-board--landing-gradient' : '',
    useLandingGradients
      ? landingGradientTheme === 'dark'
        ? 'puzzle-board--landing-gradient-dark'
        : 'puzzle-board--landing-gradient-light'
      : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      className={boardClass}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      {useLandingGradients && (
        <>
          <LandingBoardDefs
            vbX={vbX}
            vbY={vbY}
            vbW={vbW}
            vbH={vbH}
            backId={backGradId}
            fillId={fillGradId}
            rimId={rimGradId}
            rimX={rimX}
            rimY={rimY}
            variant={landingGradientTheme}
          />
          <rect
            x={vbX}
            y={vbY}
            width={vbW}
            height={vbH}
            fill={`url(#${backGradId})`}
            className="puzzle-landing-backplate"
            aria-hidden
          />
        </>
      )}
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
          pathStyle={pathStyleLanding}
        />
      ))}
    </svg>
  );
}
