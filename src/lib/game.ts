'use client';

// Game logic — original 36 shapes, board ops, original score formula.

import { SHAPES } from './assets-data';

export const GRID = 8;

export interface Piece {
  cells: [number, number][]; // [row, col] offsets
  color: number;             // 0..7
  w: number;
  h: number;
  id: number;                // shape index
}

export type Board = (number | null)[];

export function makePiece(shapeIdx: number, color: number): Piece {
  const cells = SHAPES[shapeIdx] as [number, number][];
  let maxR = 0, maxC = 0;
  for (const [r, c] of cells) {
    maxR = Math.max(maxR, r);
    maxC = Math.max(maxC, c);
  }
  return { cells, color, w: maxC + 1, h: maxR + 1, id: shapeIdx };
}

export function randomPiece(rand: () => number = Math.random): Piece {
  const idx = Math.floor(rand() * SHAPES.length) % SHAPES.length;
  const color = Math.floor(rand() * 8) % 8;
  return makePiece(idx, color);
}

export function randomTrayDistinct(rand: () => number = Math.random): Piece[] {
  // Original: 5-placeable distinct shapes pool; we sample 3 distinct shapes.
  const idxs = new Set<number>();
  while (idxs.size < 3) idxs.add(Math.floor(rand() * SHAPES.length) % SHAPES.length);
  return [...idxs].map((i) =>
    makePiece(i, Math.floor(rand() * 8) % 8),
  );
}

/** Original "ShapeCheckPlace": does the shape fit anywhere on the board? */
export function shapeFitsAnywhere(board: Board, shapeIdx: number): boolean {
  const p = makePiece(shapeIdx, 0);
  for (let r = 0; r <= GRID - p.h; r++) {
    for (let c = 0; c <= GRID - p.w; c++) {
      if (canPlace(board, p, r, c)) return true;
    }
  }
  return false;
}

/**
 * Original "CreateShapes" — 1:1 with the Construct 3 original (ported from
 * the Flutter port): a pool of 5 DISTINCT shapes that fit the current board,
 * 3 distinct picks from the pool, 3 distinct colors popped from a shuffled
 * 0..7 list. The placeability guarantee is what keeps the game fair.
 */
export function originalTray(board: Board, rand: () => number = Math.random): Piece[] {
  // GetAvailableShapes: shuffle all shapes, keep first 5 that fit
  const all = Array.from({ length: SHAPES.length }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const pool: number[] = [];
  for (const s of all) {
    if (pool.length >= 5) break;
    if (shapeFitsAnywhere(board, s)) pool.push(s);
  }
  // 3 distinct colors from a shuffled 0..7 list
  const colors = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  const poolMut = [...pool];
  const out: Piece[] = [];
  for (let i = 0; i < 3; i++) {
    let shapeIdx: number;
    if (poolMut.length > 0) {
      shapeIdx = poolMut[Math.floor(rand() * poolMut.length)];
      // keep the pool at >= 3 so tray shapes stay distinct (original rule)
      if (poolMut.length >= 3) poolMut.splice(poolMut.indexOf(shapeIdx), 1);
    } else {
      shapeIdx = Math.floor(rand() * SHAPES.length) % SHAPES.length;
    }
    const colorIdx = colors.length
      ? colors.splice(Math.floor(rand() * colors.length), 1)[0]
      : Math.floor(rand() * 8) % 8;
    out.push(makePiece(shapeIdx, colorIdx));
  }
  return out;
}

export function canPlace(board: Board, p: Piece, r: number, c: number): boolean {
  for (const [dr, dc] of p.cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= GRID || cc < 0 || cc >= GRID) return false;
    if (board[rr * GRID + cc] !== null) return false;
  }
  return true;
}

export function placedCells(p: Piece, r: number, c: number): [number, number][] {
  return p.cells.map(([dr, dc]) => [r + dr, c + dc] as [number, number]);
}

export function findFullLines(board: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < GRID; r++) {
    let full = true;
    for (let c = 0; c < GRID; c++) if (board[r * GRID + c] === null) { full = false; break; }
    if (full) rows.push(r);
  }
  for (let c = 0; c < GRID; c++) {
    let full = true;
    for (let r = 0; r < GRID; r++) if (board[r * GRID + c] === null) { full = false; break; }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

/** Lines that WOULD be completed if the piece were placed at (r, c). */
export function previewLines(board: Board, p: Piece, r: number, c: number): { rows: number[]; cols: number[] } {
  const test = [...board];
  for (const [rr, cc] of placedCells(p, r, c)) test[rr * GRID + cc] = p.color;
  return findFullLines(test);
}

export function clearCells(board: Board, rows: number[], cols: number[]): { board: Board; cleared: Set<number> } {
  const out = [...board];
  const cleared = new Set<number>();
  for (const r of rows) {
    for (let c = 0; c < GRID; c++) {
      cleared.add(r * GRID + c);
      out[r * GRID + c] = null;
    }
  }
  for (const c of cols) {
    for (let r = 0; r < GRID; r++) {
      cleared.add(r * GRID + c);
      out[r * GRID + c] = null;
    }
  }
  return { board: out, cleared };
}

/** Original score formula: (combo+1) × 10 × lines × max(1, lines−1). */
export function calcEarned(comboAfter: number, lines: number): number {
  const lineMult = lines >= 2 ? lines - 1 : 1;
  return (comboAfter + 1) * 10 * lines * lineMult;
}

export function hasAnyMove(board: Board, pieces: (Piece | null)[]): boolean {
  for (const p of pieces) {
    if (!p) continue;
    for (let r = 0; r <= GRID - p.h; r++) {
      for (let c = 0; c <= GRID - p.w; c++) {
        if (canPlace(board, p, r, c)) return true;
      }
    }
  }
  return false;
}

/** Curated board for the static "Gioco" preview screen. */
export function sampleBoard(): Board {
  const rows: (number | null)[][] = [
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, 3, null, null, null, null],
    [null, null, 4, 3, 3, null, null, null],
    [null, null, 4, 4, 5, 7, null, null],
    [1, null, 2, 2, 5, 5, 7, null],
    [6, 1, 1, 0, 0, 7, 7, 4],
    [6, 6, 2, 2, 0, 4, 4, 4],
  ];
  return rows.flat();
}

export function sampleTrayPieces(): Piece[] {
  return [
    makePiece(1, 5),   // small L orange
    makePiece(24, 2),  // 2x2 green
    makePiece(18, 7),  // line 1x3 pink
  ];
}
