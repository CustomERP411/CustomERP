/**
 * Public API for the puzzle module. Everything consumers need is re-exported
 * from here; nothing in the folder should be imported from deeper paths.
 */

export { default as PuzzleBoard } from './PuzzleBoard';
export type { PuzzleBoardProps } from './PuzzleBoard';

export { default as PuzzlePiece } from './PuzzlePiece';
export type { PuzzlePieceProps } from './PuzzlePiece';

export { usePuzzleBoard } from './usePuzzleBoard';
export type { SideInfo, UsePuzzleBoardOptions } from './usePuzzleBoard';

export {
  computePiecePath,
  computePieceBbox,
  computeKnobs,
  knobHitCenter,
  evenlySpaced,
  normalizeSide,
  KNOB_R,
  KNOB_D,
  FLAT,
  TAB,
  SOCKET,
} from './geometry';
export type {
  Piece,
  Side,
  SideName,
  Knob,
  KnobType,
  AbsoluteKnob,
  Bbox,
} from './geometry';

export {
  BIG,
  MIN_DIM,
  EPS,
  SIDES,
  OPPOSITE,
  oppositeType,
  makeId,
  initialFourPieces,
  sideFor,
  findNeighbors,
  findNeighborAtKnob,
  coversNeighbors,
  edgesMatch,
  piecesInRegion,
  maxKnobsForSide,
  resolveType,
  splitNeighborsOnSide,
  updatePiece,
  setPieceSide,
  changeSide,
  flipKnob,
  sideCount,
  sideType,
} from './board';
export type { ResolvedSideType, Region } from './board';
