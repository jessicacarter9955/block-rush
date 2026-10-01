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
  return fairDeal(board, [0, 1, 2], rand).pieces as Piece[];
}

export interface SolutionMove { slot:number; piece:Piece; r:number; c:number }
export function applySolution(board:Board, move:SolutionMove):Board {
  if(!canPlace(board,move.piece,move.r,move.c)) throw new Error('Invalid solution move');
  const next=[...board];
  for(const [r,c] of placedCells(move.piece,move.r,move.c)) next[r*8+c]=move.piece.color;
  const lines=findFullLines(next);
  return clearCells(next,lines.rows,lines.cols).board;
}
function shuffled(n:number,rand:()=>number):number[] {
  const a=Array.from({length:n},(_,i)=>i);
  for(let i=n-1;i>0;i--) {const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
/** Constructive proof: each piece is selected on the simulated post-clear board. */
export function fairDeal(board:Board,slots:number[],rand:()=>number=Math.random):{pieces:(Piece|null)[];solution:SolutionMove[]} {
  let simulated=[...board];const pieces:(Piece|null)[]=[null,null,null],solution:SolutionMove[]=[];
  const colors=shuffled(8,rand);
  for(const slot of slots) {
    let found:SolutionMove|undefined;
    for(const shape of [...shuffled(SHAPES.length-1,rand).map(i=>i+1),0]) {
      const piece=makePiece(shape,colors[slot]);
      for(const pos of shuffled(64,rand)) {
        if(canPlace(simulated,piece,Math.floor(pos/8),pos%8)) {found={slot,piece,r:Math.floor(pos/8),c:pos%8};break;}
      }
      if(found)break;
    }
    if(!found)throw new Error('Board must be cleared before dealing');
    solution.push(found);pieces[slot]=found.piece;simulated=applySolution(simulated,found);
  }
  return {pieces,solution};
}
/** Budget exhaustion causes a fresh verified deal, never a forced loss. */
export function solveTray(board:Board,pieces:(Piece|null)[],budget=1600):SolutionMove[]|null {
  let visited=0;
  const visit=(b:Board,left:(Piece|null)[]):SolutionMove[]|null=>{
    if(left.every(p=>!p))return [];
    if(++visited>budget)return null;
    for(let slot=0;slot<left.length;slot++) {
      const piece=left[slot];if(!piece)continue;
      for(let pos=0;pos<64;pos++) {
        const r=Math.floor(pos/8),c=pos%8;if(!canPlace(b,piece,r,c))continue;
        const move={slot,piece,r,c},rest=[...left];rest[slot]=null;
        const tail=visit(applySolution(b,move),rest);if(tail)return [move,...tail];
        if(visited>budget)return null;
      }
    }
    return null;
  };
  return visit(board,pieces);
}
/** Keep the dealt pieces fixed. Only a new, empty tray receives a fair deal. */
export function ensureFairTray(board:Board,pieces:(Piece|null)[],rand:()=>number=Math.random) {
  if(pieces.every(p=>!p))return {...fairDeal(board,[0,1,2],rand),lost:false};
  return {pieces,solution:solveTray(board,pieces) ?? [],lost:!hasAnyMove(board,pieces)};
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
