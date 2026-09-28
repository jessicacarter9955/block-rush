/**
 * Headless bot simulation — measures how long the solver survives and how
 * much it scores with the ORIGINAL tray logic (pool of 5 placeable shapes).
 * Run: bun scripts/bot_sim.ts [runs] [speedLabel]
 */
import { solve } from '../src/lib/bot';
import {
  originalTray, canPlace, calcEarned, findFullLines, clearCells,
  placedCells, GRID, type Board, type Piece,
} from '../src/lib/game';

const runs = parseInt(process.argv[2] || '30', 10);

function playGame(seed: number): { score: number; moves: number; filled: number } {
  // deterministic rng per seed
  let s = seed * 2654435761 % 2147483647;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  let board: Board = Array(64).fill(null);
  let tray: (Piece | null)[] = originalTray(board, rand);
  let score = 0;
  let combo = -1;
  let moves = 0;

  for (;;) {
    if (!tray.some(Boolean)) break;
    const mv = solve(board, tray, combo);
    if (!mv) break;
    const p = tray[mv.slot]!;
    if (!canPlace(board, p, mv.r, mv.c)) break;
    const cells = placedCells(p, mv.r, mv.c);
    const next = [...board];
    for (const [rr, cc] of cells) next[rr * GRID + cc] = p.color;
    score += cells.length;
    const lines = findFullLines(next);
    const nLines = lines.rows.length + lines.cols.length;
    let nextBoard = next;
    if (nLines > 0) {
      combo += 1;
      score += calcEarned(combo, nLines);
      nextBoard = clearCells(next, lines.rows, lines.cols).board;
    } else if (combo >= 0) {
      // 3 no-clear moves reset the combo (original rule, approximated here:
      // the reset counter is tracked outside for simplicity)
      noClear++;
      if (noClear >= 3) { combo = -1; noClear = 0; }
    }
    if (nLines > 0) noClear = 0;
    board = nextBoard;
    const remaining = tray.map((t, i) => (i === mv.slot ? null : t));
    tray = remaining.every((t) => !t) ? originalTray(board, rand) : remaining;
    moves++;
    if (moves > 5000) break;
  }
  return { score, moves, filled: board.filter((v) => v !== null).length };
}

let noClear = 0;

const results = [];
for (let i = 1; i <= runs; i++) {
  noClear = 0;
  results.push(playGame(i));
}
const scores = results.map((r) => r.score).sort((a, b) => a - b);
const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
const median = scores[Math.floor(scores.length / 2)];
console.log(`runs=${runs}`);
console.log(`score  min=${scores[0]} med=${median} avg=${Math.round(avg)} max=${scores[scores.length - 1]}`);
console.log('top5:', scores.slice(-5).join(', '));
console.log('worst5:', scores.slice(0, 5).join(', '));
const over2k = scores.filter((s) => s >= 2000).length;
const over5k = scores.filter((s) => s >= 5000).length;
console.log(`>=2000: ${over2k}/${runs}  >=5000: ${over5k}/${runs}`);
console.log('avg moves:', Math.round(results.reduce((a, r) => a + r.moves, 0) / results.length));
