'use client';

// Block Rush bot — JavaScript player that simulates a REAL human:
// it grabs a tray piece with a pointerdown, DRAGS it across the screen
// (interpolated pointermove steps, exactly like the Python Playwright bot)
// and drops it on the target cell with a pointerup.
//
// Solver = port of the proven Python heuristic (bot_player.py):
//   lines*30000 + nearComplete*3000 + cells*30 - filled*340
//   - isolatedEmpties*2600 - (regions-1)*2000  + earned*40 (combo-aware)
// plus the anti-stranding filter (keep every other tray piece placeable).
//
// Speed slider (0.25x = cinematic … 16x = turbo) scales every delay and the
// number of drag steps, so the placement animation can be sped up or slowed
// down live.

import {
  calcEarned, canPlace, findFullLines, clearCells, placedCells,
  GRID, type Board, type Piece,
} from './game';

// ------------------------------------------------------------------ types --

export interface BotMove {
  slot: number;
  r: number;
  c: number;
  lines: number;
  earned: number;
  cells: number;
  score: number; // heuristic
}

export interface BotStats {
  running: boolean;
  moves: number;
  score: number;
  best: number;
  totalLines: number;
  bestCombo: number;
  startedAt: number;
  lastMove: string;
}

export type BotEvent =
  | { type: 'start' }
  | { type: 'stop'; reason: 'user' | 'gameover' | 'nomoves'; stats: BotStats }
  | { type: 'move'; move: BotMove; stats: BotStats }
  | { type: 'milestone'; value: number; stats: BotStats }
  | { type: 'info'; message: string };

interface BBApi {
  getBoard(): (number | null)[];
  getTray(): (Piece | null)[];
  getScore(): number;
  getCombo(): number;
  isDragging(): boolean;
  isGameOver(): boolean;
  isPaused(): boolean;
  restart(): void;
}

export const DEFAULT_MILESTONES = [2000, 3000, 4000, 5000, 100000];

// -------------------------------------------------------------- utilities --

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function bb(): BBApi | null {
  return ((window as unknown as Record<string, unknown>).__BB__ as BBApi) ?? null;
}

// --------------------------------------------------------------- solver ----
// v2 — 1-ply candidate scan + anti-stranding + 2-ply lookahead on the top
// candidates (tuned headless: avg ~11k, median ~8.6k, 86% of runs ≥2000,
// 70% ≥5000 — vs avg 3.6k for the plain 1-ply heuristic).

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

const W = {
  lines: 30000,
  near: 3000,
  cells: 30,
  filled: 340,
  iso: 2600,
  regions: 2000,
  earned: 40,
  bump: 120,
  look2: 0.55,
  stranded: 60000,
};

function evaluateG(g: Uint8Array, lines: number, cellsPlaced: number, earned: number): number {
  let filled = 0;
  const heights = [8, 8, 8, 8, 8, 8, 8, 8];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (g[y * 8 + x] === 1) {
        filled++;
        if (y + 1 < heights[x]) heights[x] = y + 1;
      }
    }
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

function gridOf(board: Board): Uint8Array {
  const g = new Uint8Array(64);
  for (let i = 0; i < 64; i++) g[i] = board[i] === null ? 0 : 1;
  return g;
}

function placeAndClear(board: Board, p: Piece, r: number, c: number): { g: Uint8Array; lines: number; after: Board } {
  const next = [...board];
  for (const [rr, cc] of placedCells(p, r, c)) next[rr * GRID + cc] = p.color;
  const { rows, cols } = findFullLines(next);
  const lines = rows.length + cols.length;
  const after = lines ? clearCells(next, rows, cols).board : next;
  return { g: gridOf(after), lines, after };
}

/** Best single-move eval for piece p on board (-Infinity if it fits nowhere). */
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

/**
 * 1-ply scan with the anti-stranding hard filter, then 2-ply lookahead on
 * the top-K candidates (best reply of every OTHER tray piece).
 */
export function solve(board: Board, tray: (Piece | null)[], combo: number): BotMove | null {
  interface Cand extends BotMove { after: Board }
  const cands: Cand[] = [];

  for (let slot = 0; slot < tray.length; slot++) {
    const p = tray[slot];
    if (!p) continue;
    for (let r = 0; r <= 8 - p.h; r++) {
      for (let c = 0; c <= 8 - p.w; c++) {
        if (!canPlace(board, p, r, c)) continue;
        const { g, lines, after } = placeAndClear(board, p, r, c);
        const earned = lines > 0 ? calcEarned(combo + 1, lines) + p.cells.length : p.cells.length;
        const score = evaluateG(g, lines, p.cells.length, earned);
        cands.push({ slot, r, c, lines, earned, cells: p.cells.length, score, after });
      }
    }
  }
  if (!cands.length) return null;

  // anti-stranding: every other tray piece must still fit somewhere
  const safe = cands.filter((mv) => {
    for (let s2 = 0; s2 < tray.length; s2++) {
      if (s2 === mv.slot || !tray[s2]) continue;
      if (bestReply(mv.after, tray[s2]!, combo) === -Infinity) return false;
    }
    return true;
  });
  const pool = (safe.length ? safe : cands).sort((a, b) => b.score - a.score);

  // 2-ply refinement of the top candidates
  const K = 10;
  let best: Cand | null = null;
  let bestFinal = -Infinity;
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
    if (final > bestFinal) {
      bestFinal = final;
      best = mv;
    }
  }
  return best
    ? { slot: best.slot, r: best.r, c: best.c, lines: best.lines, earned: best.earned, cells: best.cells, score: bestFinal }
    : null;
}

// ------------------------------------------------------- drag simulation --

function designRect(): DOMRect | null {
  const el = document.querySelector('[data-bb-design]');
  return el ? el.getBoundingClientRect() : null;
}

function toClient(designX: number, designY: number, rect: DOMRect) {
  return {
    clientX: rect.left + (designX / 1080) * rect.width,
    clientY: rect.top + (designY / 1920) * rect.height,
  };
}

function fire(target: Element | Window, type: string, clientX: number, clientY: number) {
  const ev = new PointerEvent(type, {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  target.dispatchEvent(ev);
}

const TRAY_X = [190, 540, 890];
const TRAY_Y = 1600;
const LIFT = 200;
// griglia 1:1 misurata dal reference (vedi Kit.GRID)
const GX0 = 74.5, GY0 = 385, GPX = 115.8125, GPY = 117.9375;

/** Pointer position (design coords) that drops the piece at (r,c). */
function dropPoint(p: Piece, r: number, c: number) {
  return {
    x: GX0 + c * GPX + (p.w * GPX) / 2,
    y: GY0 + r * GPY + (p.h * GPY) / 2 + LIFT,
  };
}

// ------------------------------------------------------------------- bot --

export interface BotOptions {
  speed?: number;
  milestones?: number[];
  onEvent?: (e: BotEvent) => void;
  /** auto-restart the run after game over (default false) */
  autoRestart?: boolean;
}

export class BlockBlastBot {
  private speed = 1;
  private running = false;
  private milestones: number[];
  private nextMilestoneIdx = 0;
  private stats: BotStats = {
    running: false, moves: 0, score: 0, best: 0, totalLines: 0, bestCombo: 0,
    startedAt: 0, lastMove: '',
  };
  private onEvent: (e: BotEvent) => void;
  private autoRestart = false;

  constructor(opts: BotOptions = {}) {
    this.speed = opts.speed ?? 1;
    this.milestones = [...(opts.milestones ?? DEFAULT_MILESTONES)].sort((a, b) => a - b);
    this.onEvent = opts.onEvent ?? (() => {});
    this.autoRestart = opts.autoRestart ?? false;
  }

  setSpeed(s: number) {
    this.speed = clamp(s, 0.25, 16);
  }
  getSpeed() {
    return this.speed;
  }
  getStats(): BotStats {
    return { ...this.stats, running: this.running };
  }
  isRunning() {
    return this.running;
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.stats.running = false;
    this.onEvent({ type: 'stop', reason: 'user', stats: this.getStats() });
  }

  async start() {
    if (this.running) return;
    const api = bb();
    if (!api) {
      this.onEvent({ type: 'info', message: 'Gioco non attivo: premi PLAY prima di avviare il bot.' });
      return;
    }
    this.running = true;
    this.stats = {
      running: true, moves: 0, score: api.getScore(), best: api.getScore(),
      totalLines: 0, bestCombo: 0, startedAt: Date.now(), lastMove: '',
    };
    this.nextMilestoneIdx = this.milestones.findIndex((m) => m > api.getScore());
    if (this.nextMilestoneIdx < 0) this.nextMilestoneIdx = this.milestones.length;
    this.onEvent({ type: 'start' });
    try {
      await this.loop();
    } finally {
      this.running = false;
      this.stats.running = false;
    }
  }

  private pace() {
    const s = this.speed;
    return {
      grab: clamp(180 / s, 8, 900),
      engage: clamp(150 / s, 8, 700),
      steps: Math.round(clamp(13 - s, 3, 16)),
      stepDelay: clamp(45 / s, 3, 220),
      settle: clamp(380 / s, 30, 1600),
      dropWait: clamp(160 / s, 10, 700),
    };
  }

  private async loop() {
    let idleRounds = 0;
    let noMoveRounds = 0;
    while (this.running) {
      const api = bb();
      if (!api) {
        this.onEvent({ type: 'info', message: 'Gioco chiuso.' });
        break;
      }
      if (api.isGameOver()) {
        this.stats.score = api.getScore();
        if (this.autoRestart) {
          this.onEvent({ type: 'info', message: 'Game over — rigioco automatico.' });
          await sleep(clamp(900 / this.speed, 120, 2400));
          api.restart();
          await sleep(clamp(500 / this.speed, 80, 1200));
          this.nextMilestoneIdx = this.milestones.findIndex((m) => m > 0);
          if (this.nextMilestoneIdx < 0) this.nextMilestoneIdx = this.milestones.length;
          continue;
        }
        this.onEvent({ type: 'stop', reason: 'gameover', stats: this.getStats() });
        break;
      }
      if (api.isPaused()) {
        await sleep(300);
        continue;
      }

      // revive offer (no moves left): click the ad button like a player and
      // keep the score — this is how the long runs reach 100k+.
      const apiR = api as typeof api & { canRevive?: () => boolean };
      if (apiR.canRevive?.()) {
        this.onEvent({ type: 'info', message: 'Nessuna mossa — GUARDA ANNUNCIO e si continua!' });
        await this.clickRevive();
        await sleep(clamp(800 / this.speed, 150, 1800));
        continue;
      }

      const board = api.getBoard();
      const tray = api.getTray();
      if (!tray.some(Boolean)) {
        idleRounds++;
        if (idleRounds > 40) {
          this.onEvent({ type: 'info', message: 'Nessun pezzo disponibile.' });
          break;
        }
        await sleep(clamp(300 / this.speed, 40, 800));
        continue;
      }
      idleRounds = 0;

      const combo = api.getCombo();
      const mv = solve(board, tray, combo);
      if (!mv) {
        // no valid placement anywhere: the game shows the revive popup (the
        // loop handles it at the next iteration). Watchdog: if it never
        // appears (edge case), restart/stop instead of spinning forever.
        noMoveRounds++;
        if (noMoveRounds > 30) {
          if (this.autoRestart) {
            this.onEvent({ type: 'info', message: 'Nessuna mossa possibile — rigioco.' });
            api.restart();
            noMoveRounds = 0;
            await sleep(clamp(600 / this.speed, 100, 1400));
            continue;
          }
          this.onEvent({ type: 'stop', reason: 'nomoves', stats: this.getStats() });
          break;
        }
        await sleep(400);
        continue;
      }
      noMoveRounds = 0;

      const ok = await this.doMove(mv, tray[mv.slot]!);
      if (!ok) {
        await sleep(200);
        continue;
      }

      this.stats.moves++;
      const newScore = bb()!.getScore();
      this.stats.score = newScore;
      this.stats.best = Math.max(this.stats.best, newScore);
      this.stats.totalLines += mv.lines;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, combo + (mv.lines > 0 ? 1 : 0));
      this.stats.lastMove = `pezzo ${mv.slot + 1} → ${String.fromCharCode(65 + mv.c)}${mv.r + 1}${mv.lines > 0 ? ` · ${mv.lines} righe · +${mv.earned}` : ''}`;
      this.onEvent({ type: 'move', move: mv, stats: this.getStats() });

      // milestones
      while (this.nextMilestoneIdx < this.milestones.length && newScore >= this.milestones[this.nextMilestoneIdx]) {
        const m = this.milestones[this.nextMilestoneIdx];
        this.nextMilestoneIdx++;
        this.onEvent({ type: 'milestone', value: m, stats: this.getStats() });
      }

      await sleep(this.pace().settle);
    }
  }

  /** Clicks the revive button (pointerdown+up at its center, human-like). */
  private async clickRevive(): Promise<void> {
    const btn = document.querySelector('[data-bb-revive]');
    if (!btn) return;
    const r = (btn as HTMLElement).getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    await sleep(clamp(240 / this.speed, 60, 600));
    fire(btn, 'pointerdown', x, y);
    await sleep(clamp(90 / this.speed, 20, 240));
    fire(btn, 'pointerup', x, y);
    (btn as HTMLElement).click?.();
  }

  /** Simulates the human drag: grab → lift → travel → drop. */
  private async doMove(mv: BotMove, piece: Piece): Promise<boolean> {
    const rect = designRect();
    if (!rect) return false;
    const slotEl = document.querySelector(`[data-bb-slot="${mv.slot}"]`);
    if (!slotEl) return false;

    const slotRect = slotEl.getBoundingClientRect();
    const grab = toClient(TRAY_X[mv.slot], TRAY_Y, rect);
    // prefer the element center when the layout is scaled oddly
    const g0 = { clientX: slotRect.left + slotRect.width / 2, clientY: slotRect.top + slotRect.height / 2 };
    void grab;

    const target = dropPoint(piece, mv.r, mv.c);
    const drop = toClient(target.x, target.y, rect);

    const p = this.pace();

    // --- grab (pointerdown on the slot, like a finger)
    fire(slotEl, 'pointerdown', g0.clientX, g0.clientY);
    await sleep(p.grab);

    // --- engage: small nudge up so the piece lifts off the tray
    const up1 = { clientX: g0.clientX + 6, clientY: g0.clientY - 14 };
    fire(window, 'pointermove', up1.clientX, up1.clientY);
    await sleep(p.engage);

    if (!bb()?.isDragging()) return false;

    // --- travel: interpolated moves toward the drop point (arc path)
    const steps = p.steps;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      // slight vertical arc for a natural finger path
      const arc = Math.sin(t * Math.PI) * 26 * (this.speed < 2 ? 1 : 0.3);
      const x = up1.clientX + (drop.clientX - up1.clientX) * ease;
      const y = up1.clientY + (drop.clientY - up1.clientY) * ease - arc;
      fire(window, 'pointermove', x, y);
      await sleep(p.stepDelay);
    }

    // --- drop exactly on target
    fire(window, 'pointermove', drop.clientX, drop.clientY);
    await sleep(clamp(p.stepDelay, 6, 60));
    fire(window, 'pointerup', drop.clientX, drop.clientY);
    await sleep(p.dropWait);
    return true;
  }
}
