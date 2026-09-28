/**
 * Solver v2 experiments — 2-ply lookahead + tuned weights, measured headless.
 * Run: bun scripts/bot_sim2.ts [runs]
 */
import {
  originalTray, canPlace, calcEarned, findFullLines, clearCells,
  placedCells, GRID, type Board, type Piece,
} from '../src/lib/game';

const runs = parseInt(process.argv[2] || '30', 10);

// ------------------------------------------------------------ heuristics --

function emptyRegions(g: Uint8Array): number {
  const seen = new Uint8Array(64);
  let regions = 0;
  for (let i = 0; i < 64; i++) {
    if (g[i] === 0 && !seen[i]) {
      regions++;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const idx = stack.pop()!;
        const y = (idx / 8) | 0, x = idx % 8;
        if (y > 0 && g[idx - 8] === 0 && !seen[idx - 8]) { seen[idx - 8] = 1; stack.push(idx - 8); }
        if (y < 7 && g[idx + 8] === 0 && !seen[idx + 8]) { seen[idx + 8] = 1; stack.push(idx + 8); }
        if (x > 0 && g[idx - 1] === 0 && !seen[idx - 1]) { seen[idx - 1] = 1; stack.push(idx - 1); }
        if (x < 7 && g[idx + 1] === 0 && !seen[idx + 1]) { seen[idx + 1] = 1; stack.push(idx + 1); }
      }
    }
  }
  return regions;
}

function isolatedEmpties(g: Uint8Array): number {
  let n = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = y * 8 + x;
      if (g[i] === 1) continue;
      let blocked = 0;
      if (y === 0 || g[i - 8] === 1) blocked++;
      if (y === 7 || g[i + 8] === 1) blocked++;
      if (x === 0 || g[i - 1] === 1) blocked++;
      if (x === 7 || g[i + 1] === 1) blocked++;
      if (blocked >= 3) n++;
    }
  }
  return n;
}

function nearComplete(g: Uint8Array): number {
  let n = 0;
  for (let y = 0; y < 8; y++) {
    let f = 0;
    for (let x = 0; x < 8; x++) f += g[y * 8 + x];
    if (f === 6 || f === 7) n++;
  }
  for (let x = 0; x < 8; x++) {
    let f = 0;
    for (let y = 0; y < 8; y++) f += g[y * 8 + x];
    if (f === 6 || f === 7) n++;
  }
  return n;
}

function holes1(g: Uint8Array): number {
  // single empty cell with all 4 neighbors filled or... already isolatedEmpties.
  return 0;
}

const W = {
  lines: 30000,
  near: 3000,
  cells: 30,
  filled: 340,
  iso: 2600,
  regions: 2000,
  earned: 40,
  bump: 120,      // NEW: bumpiness of the height profile
  look2: 0.55,    // weight of the 2-ply reply score
  stranded: 60000, // penalty when a reply piece has no placement
};

function evaluateG(g: Uint8Array, lines: number, cellsPlaced: number, earned: number): number {
  let filled = 0;
  const heights = new Array(8).fill(8);
  for (let y = 0; y < 8; y++) {
    let rowF = 0;
    for (let x = 0; x < 8; x++) {
      if (g[y * 8 + x] === 1) { rowF++; if (y + 1 < heights[x]) heights[x] = y + 1; }
    }
    filled += rowF;
  }
  let bump = 0;
  for (let x = 0; x < 7; x++) bump += Math.abs(heights[x] - heights[x + 1]);
  return (
    lines * W.lines
    + nearComplete(g) * W.near
    + cellsPlaced * W.cells
    + earned * W.earned
    - filled * W.filled
    - isolatedEmpties(g) * W.iso
    - (emptyRegions(g) - 1) * W.regions
    - bump * W.bump
  );
}

function boardToG(board: Board): Uint8Array {
  const g = new Uint8Array(64);
  for (let i = 0; i < 64; i++) g[i] = board[i] === null ? 0 : 1;
  return g;
}

function placeAndClear(board: Board, p: Piece, r: number, c: number): { g: Uint8Array; lines: number } {
  const next = [...board];
  for (const [rr, cc] of placedCells(p, r, c)) next[rr * GRID + cc] = p.color;
  const { rows, cols } = findFullLines(next);
  const lines = rows.length + cols.length;
  const cleared = lines ? clearCells(next, rows, cols).board : next;
  return { g: boardToG(cleared), lines };
}

/** best single-move eval for piece p on board (used by 2-ply) */
function bestReply(board: Board, p: Piece, combo: number): number {
  let best = -Infinity;
  for (let r = 0; r <= 8 - p.h; r++) {
    for (let c = 0; c <= 8 - p.w; c++) {
      if (!canPlace(board, p, r, c)) continue;
      const { g, lines } = placeAndClear(board, p, r, c);
      const earned = lines > 0 ? calcEarned(combo + 1, lines) + p.cells.length : p.cells.length;
      const sc = evaluateG(g, lines, p.cells.length, earned);
      if (sc > best) best = sc;
    }
  }
  return best;
}

interface Move2 { slot: number; r: number; c: number; final: number }

function solve2(board: Board, tray: (Piece | null)[], combo: number): Move2 | null {
  // --- 1-ply candidates
  const cands: { slot: number; r: number; c: number; score: number; after: Board; lines: number }[] = [];
  for (let slot = 0; slot < tray.length; slot++) {
    const p = tray[slot];
    if (!p) continue;
    for (let r = 0; r <= 8 - p.h; r++) {
      for (let c = 0; c <= 8 - p.w; c++) {
        if (!canPlace(board, p, r, c)) continue;
        const next = [...board];
        for (const [rr, cc] of placedCells(p, r, c)) next[rr * GRID + cc] = p.color;
        const { rows, cols } = findFullLines(next);
        const lines = rows.length + cols.length;
        const after = lines ? clearCells(next, rows, cols).board : next;
        const g = boardToG(after);
        const earned = lines > 0 ? calcEarned(combo + 1, lines) + p.cells.length : p.cells.length;
        const score = evaluateG(g, lines, p.cells.length, earned);
        cands.push({ slot, r, c, score, after, lines });
      }
    }
  }
  if (!cands.length) return null;

  // anti-stranding hard filter
  const fits = (b: Board, p: Piece) => bestReply(b, p, combo) > -Infinity;
  const safe = cands.filter((mv) => {
    for (let s2 = 0; s2 < tray.length; s2++) {
      if (s2 === mv.slot || !tray[s2]) continue;
      if (!fits(mv.after, tray[s2]!)) return false;
    }
    return true;
  });
  const pool = (safe.length ? safe : cands).sort((a, b) => b.score - a.score);

  // --- 2-ply refinement on top candidates
  const K = 10;
  let best: Move2 | null = null;
  for (const mv of pool.slice(0, K)) {
    let replySum = 0;
    let replies = 0;
    let stranded = 0;
    for (let s2 = 0; s2 < tray.length; s2++) {
      if (s2 === mv.slot || !tray[s2]) continue;
      const rep = bestReply(mv.after, tray[s2]!, combo + (mv.lines > 0 ? 1 : 0));
      if (rep === -Infinity) stranded++;
      else { replySum += rep; replies++; }
    }
    const replyAvg = replies ? replySum / replies : 0;
    const final = mv.score + W.look2 * replyAvg - stranded * W.stranded;
    if (!best || final > best.final) best = { slot: mv.slot, r: mv.r, c: mv.c, final };
  }
  return best;
}

// ------------------------------------------------------------------- game --

function playGame(seed: number): { score: number; moves: number } {
  let s = (seed * 2654435761) % 2147483647;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  let board: Board = Array(64).fill(null);
  let tray: (Piece | null)[] = originalTray(board, rand);
  let score = 0;
  let combo = -1;
  let noClear = 0;
  let moves = 0;
  for (;;) {
    const mv = solve2(board, tray, combo);
    if (!mv) break;
    const p = tray[mv.slot]!;
    const next = [...board];
    for (const [rr, cc] of placedCells(p, mv.r, mv.c)) next[rr * GRID + cc] = p.color;
    score += p.cells.length;
    const { rows, cols } = findFullLines(next);
    const lines = rows.length + cols.length;
    if (lines > 0) {
      combo += 1;
      noClear = 0;
      score += calcEarned(combo, lines);
      board = clearCells(next, rows, cols).board;
    } else {
      board = next;
      if (combo >= 0) {
        noClear++;
        if (noClear >= 3) { combo = -1; noClear = 0; }
      }
    }
    const remaining = tray.map((t, i) => (i === mv.slot ? null : t));
    tray = remaining.every((t) => !t) ? originalTray(board, rand) : remaining;
    moves++;
    if (moves > 5000) break;
  }
  return { score, moves };
}

const results = [];
const t0 = Date.now();
for (let i = 1; i <= runs; i++) results.push(playGame(i));
const dt = Date.now() - t0;
const scores = results.map((r) => r.score).sort((a, b) => a - b);
const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
console.log(`runs=${runs} in ${dt}ms (${(dt / runs).toFixed(1)}ms/game)`);
console.log(`score  min=${scores[0]} med=${scores[Math.floor(scores.length / 2)]} avg=${Math.round(avg)} max=${scores[scores.length - 1]}`);
console.log('top5:', scores.slice(-5).join(', '));
console.log('worst5:', scores.slice(0, 5).join(', '));
const over2k = scores.filter((s) => s >= 2000).length;
const over5k = scores.filter((s) => s >= 5000).length;
const over10k = scores.filter((s) => s >= 10000).length;
console.log(`>=2000: ${over2k}/${runs}  >=5000: ${over5k}/${runs}  >=10000: ${over10k}/${runs}`);
