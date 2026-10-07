import {
  calcEarned,
  canPlace,
  clearCells,
  findFullLines,
  placedCells,
  type Board,
  type Piece,
} from './game';
import type { CreativeMove } from './creative-scenarios';

export interface CreativeBotState {
  board: Board;
  tray: (Piece | null)[];
  score: number;
  combo: number;
  clearedLines: number;
  lastMove: CreativeMove | null;
}

export function applyCreativeMove(state: CreativeBotState, move: CreativeMove): CreativeBotState {
  const piece = state.tray[move.slot];
  if (!piece || !canPlace(state.board, piece, move.r, move.c)) return state;

  const placed = placedCells(piece, move.r, move.c);
  const board = [...state.board];
  for (const [r, c] of placed) board[r * 8 + c] = piece.color;

  const lines = findFullLines(board);
  const clearedLines = lines.rows.length + lines.cols.length;
  const nextCombo = clearedLines > 0 ? state.combo + 1 : Math.max(0, state.combo - 1);
  const cleared = clearedLines > 0 ? clearCells(board, lines.rows, lines.cols).board : board;
  const earned = placed.length + (clearedLines > 0 ? calcEarned(nextCombo, clearedLines) : 0);
  const tray = state.tray.map((candidate, index) => (index === move.slot ? null : candidate));

  return {
    board: cleared,
    tray,
    score: state.score + earned,
    combo: nextCombo,
    clearedLines,
    lastMove: move,
  };
}
