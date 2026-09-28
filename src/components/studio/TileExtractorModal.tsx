'use client';

// TileExtractorModal — "Estrai quadratini da screenshot"
//
// Upload/paste a game screenshot → auto-detect the 8×8 board grid (or adjust
// it by dragging / resizing / number inputs) → extract one tile per distinct
// candy color → apply them as per-color image blocks.
//
// All processing is client-side on a canvas; nothing leaves the browser.

import {
  useCallback, useEffect, useRef, useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, Crop, Grid3X3, ScanSearch, Sparkles, Upload, Wand2, X } from 'lucide-react';

export interface ExtractedTile {
  /** data URL (PNG) */
  tile: string;
  hex: string;
  count: number;
}

interface GridState {
  /** grid left edge in image px */
  x: number;
  y: number;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
}

const DEFAULT_GRID: GridState = { x: 0, y: 0, cellW: 100, cellH: 100, cols: 8, rows: 8 };

// ------------------------------------------------------------- detection ---

/** Candy/saturated-pixel mask on ImageData (same heuristics as the python script). */
function candyMask(data: Uint8ClampedArray, i: number): boolean {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx - mn;
  const mean = (r + g + b) / 3;
  if (sat <= 55 || mean <= 45) return false;
  const gold = r - b > 70 && g - b > 30 && b < 120 && r > 150;
  const blue = b >= r - 5;
  return !gold && !blue;
}

/**
 * Auto-detect the board grid from a screenshot.
 * Primary signal: the dark blue EMPTY SLOTS form a big square region
 * (distinct from the lighter navy background). Fallback: candy row-bands.
 */
function detectGrid(img: HTMLImageElement): GridState {
  const MAX = 480; // analysis resolution
  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const fallback = () => {
    const side = Math.min(img.width, img.height) * 0.6;
    const cell = side / 8;
    return { x: (img.width - side) / 2, y: (img.height - side) / 2, cellW: cell, cellH: cell, cols: 8, rows: 8 };
  };
  if (!ctx) return fallback();
  ctx.drawImage(img, 0, 0, w, h);
  const D = ctx.getImageData(0, 0, w, h).data;

  // ------------------------------------------ primary: dark slot mask -----
  // slot ≈ very dark saturated blue (b > r+60, mean < 55); background navy is
  // lighter (mean ≥ 55) or less saturated; gold/bright decor excluded.
  const slot = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const r = D[p * 4], g = D[p * 4 + 1], b = D[p * 4 + 2];
    if (b > r + 60 && b >= g && (r + g + b) / 3 < 55) slot[p] = 1;
  }
  const rowSlot = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (slot[y * w + x]) rowSlot[y]++;
  }
  // the profile is saw-toothed (cell interiors up, separators down): smooth
  // with a box filter to bridge the dips, then take the biggest band
  const smooth = (prof: Float32Array, box: number) => {
    const out = new Float32Array(prof.length);
    for (let i = 0; i < prof.length; i++) {
      let s = 0;
      for (let j = i - box; j <= i + box; j++) {
        s += prof[Math.max(0, Math.min(prof.length - 1, j))];
      }
      out[i] = s / (2 * box + 1);
    }
    return out;
  };
  const biggestBand = (prof: Float32Array, len: number, thr: number) => {
    let best: [number, number] | null = null;
    let s = -1;
    for (let i = 0; i <= len; i++) {
      const v = i < len ? prof[i] : 0;
      if (v > thr && s < 0) s = i;
      else if (v <= thr && s >= 0) {
        if (!best || i - s > best[1] - best[0]) best = [s, i];
        s = -1;
      }
    }
    return best;
  };
  const rowS = smooth(rowSlot, 6);
  const rowBand = biggestBand(rowS, h, w * 0.12);
  if (rowBand && rowBand[1] - rowBand[0] > h * 0.15) {
    const bh = rowBand[1] - rowBand[0];
    const pitchY = bh / 8;
    const inv = 1 / k;
    let pitchX: number | null = null;
    let gx0: number | null = null;

    // columns via the CANDY strip inside the board rows (candy columns carry
    // almost no slots when the strip spans most rows, but the strip width
    // itself gives the column pitch: stripW / n≈stripW/pitchY candies).
    // Low threshold bridges the dips between adjacent candies; only bands in
    // the horizontal CENTER count (edge decorations leak into the mask).
    const colCandy = new Float32Array(w);
    let colCandyMax = 0;
    for (let y = rowBand[0]; y < rowBand[1]; y++) {
      for (let x = 0; x < w; x++) if (candyMask(D, (y * w + x) * 4)) colCandy[x]++;
    }
    for (let x = 0; x < w; x++) colCandyMax = Math.max(colCandyMax, colCandy[x]);
    const stripThr = Math.max(10, colCandyMax * 0.12);
    const allBands: Array<[number, number]> = [];
    {
      let s2 = -1;
      for (let x = 0; x <= w; x++) {
        const v = x < w ? colCandy[x] : 0;
        if (v > stripThr && s2 < 0) s2 = x;
        else if (v <= stripThr && s2 >= 0) { allBands.push([s2, x]); s2 = -1; }
      }
    }
    const strip = allBands
      .filter((b) => (b[0] + b[1]) / 2 > w * 0.15 && (b[0] + b[1]) / 2 < w * 0.85)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    if (strip && strip[1] - strip[0] > pitchY * 0.8) {
      const stripW = strip[1] - strip[0];
      const ncols = Math.max(1, Math.round(stripW / pitchY));
      const px = stripW / ncols;
      const ratio = px / pitchY;
      const boardW = px * 8;
      if (ratio > 0.6 && ratio < 1.7 && boardW > w * 0.45 && boardW < w * 1.25) {
        pitchX = px;
        gx0 = (w - boardW) / 2; // the board is horizontally centered
      }
    }

    // columns via SLOTS (works for empty/sparse boards)
    if (pitchX === null) {
      const colSlot = new Float32Array(w);
      for (let y = rowBand[0]; y < rowBand[1]; y++) {
        for (let x = 0; x < w; x++) if (slot[y * w + x]) colSlot[x]++;
      }
      const colS = smooth(colSlot, 6);
      const colBand = biggestBand(colS, w, bh * 0.12);
      if (colBand) {
        const bw = colBand[1] - colBand[0];
        const sideRatio = bw / bh;
        if (bw > w * 0.25 && sideRatio > 0.65 && sideRatio < 1.55) {
          pitchX = bw / 8;
          gx0 = colBand[0];
        }
      }
    }

    if (pitchX !== null && gx0 !== null) {
      return {
        x: gx0 * inv,
        y: rowBand[0] * inv,
        cellW: pitchX * inv,
        cellH: pitchY * inv,
        cols: 8,
        rows: 8,
      };
    }
  }

  // ------------------------------------- fallback: candy row-band groups ---
  const yA = Math.floor(h * 0.1);
  const yB = Math.ceil(h * 0.92);
  const rowProf = new Float32Array(h);
  let total = 0;
  for (let y = yA; y < yB; y++) {
    for (let x = 0; x < w; x++) {
      if (candyMask(D, (y * w + x) * 4)) { rowProf[y]++; total++; }
    }
  }
  const maxRow = Math.max(...rowProf.slice(yA, yB));
  if (maxRow < 10 || total < 200) return fallback();

  const thr = maxRow * 0.2;
  const bands: Array<[number, number, number]> = [];
  let s = -1, cnt = 0;
  for (let y = yA; y < yB; y++) {
    if (rowProf[y] > thr) { if (s < 0) { s = y; cnt = 0; } cnt += rowProf[y]; }
    else if (s >= 0) { bands.push([s, y, cnt]); s = -1; }
  }
  if (s >= 0) bands.push([s, yB, cnt]);
  const strong = bands.filter((b) => b[1] - b[0] >= 2 && b[2] >= 60);
  if (!strong.length) return fallback();

  // rough pitch from band heights, then split bands into groups separated by
  // gaps > 2.2 pitches (board vs tray) and keep the biggest group
  const heights = strong.map((b) => b[1] - b[0]).sort((a, b) => a - b);
  let rough = heights[Math.floor(heights.length / 2)];
  if (rough < 8) rough = Math.min(w, h) / 12;
  const groups: Array<Array<[number, number, number]>> = [];
  let cur: Array<[number, number, number]> = [];
  for (const b of strong) {
    if (cur.length && b[0] - cur[cur.length - 1][1] > rough * 2.2) { groups.push(cur); cur = []; }
    cur.push(b);
  }
  if (cur.length) groups.push(cur);
  const board = groups.reduce((m, g) => (g.reduce((a, b) => a + b[2], 0) > m.reduce((a, b) => a + b[2], 0) ? g : m), groups[0]);

  // pitch from strong band tops inside the board group
  const tops = board.filter((b) => b[2] > 150).map((b) => b[0]);
  let pitchY = rough;
  if (tops.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < tops.length; i++) gaps.push(tops[i] - tops[i - 1]);
    const norm = gaps.map((g) => g / Math.max(1, Math.round(g / rough))).sort((a, b) => a - b);
    pitchY = norm[Math.floor(norm.length / 2)];
  }

  // candy x extent from the strongest board band
  const best = board.reduce((m, b) => (b[2] > m[2] ? b : m), board[0]);
  const colStrong = new Float32Array(w);
  for (let y = best[0]; y < best[1]; y++) {
    for (let x = 0; x < w; x++) {
      if (candyMask(D, (y * w + x) * 4)) colStrong[x]++;
    }
  }
  const thrC = Math.max(2, (best[1] - best[0]) * 0.12);
  let x0 = -1, x1 = -1;
  for (let x = 0; x < w; x++) {
    if (colStrong[x] > thrC) { if (x0 < 0) x0 = x; x1 = x; }
  }
  const bandW = x1 - x0;
  const ncolsBand = Math.max(1, Math.round(bandW / pitchY));
  const pitchX = ncolsBand >= 2 ? bandW / ncolsBand : pitchY;

  const inv = 1 / k;
  const cellW = pitchX * inv;
  const cellH = pitchY * inv;
  const top = Math.min(...board.map((b) => b[0])) * inv;
  const left = (img.width - 8 * cellW) / 2;
  return { x: left, y: top, cellW, cellH, cols: 8, rows: 8 };
}

// -------------------------------------------------------------- sampling ---

interface CellSample { r: number; g: number; b: number; row: number; col: number }

function sampleCells(
  ctx: CanvasRenderingContext2D, g: GridState,
): { samples: CellSample[]; occupied: boolean[] } {
  const samples: CellSample[] = [];
  const occupied: boolean[] = [];
  for (let j = 0; j < g.rows; j++) {
    for (let i = 0; i < g.cols; i++) {
      const x0 = Math.max(0, Math.round(g.x + i * g.cellW));
      const x1 = Math.min(ctx.canvas.width, Math.round(g.x + (i + 1) * g.cellW));
      const y0 = Math.max(0, Math.round(g.y + j * g.cellH));
      const y1 = Math.min(ctx.canvas.height, Math.round(g.y + (j + 1) * g.cellH));
      const pw = (x1 - x0) * 0.18, ph = (y1 - y0) * 0.18;
      if (x1 - x0 <= 2 * pw || y1 - y0 <= 2 * ph) {
        samples.push({ r: 0, g: 0, b: 255, row: j, col: i });
        occupied.push(false);
        continue;
      }
      const d = ctx.getImageData(x0 + pw, y0 + ph, x1 - x0 - 2 * pw, y1 - y0 - 2 * ph).data;
      let r = 0, g_ = 0, b = 0;
      const n = d.length / 4;
      for (let p = 0; p < d.length; p += 4) { r += d[p]; g_ += d[p + 1]; b += d[p + 2]; }
      samples.push({ r: r / n, g: g_ / n, b: b / n, row: j, col: i });
      const mx = Math.max(r / n, g_ / n, b / n);
      occupied.push(!(b / n >= r / n - 8 && mx < 110)); // bluish & dark → empty slot
    }
  }
  return { samples, occupied };
}

const dist = (a: CellSample, b: CellSample) =>
  Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Crop a cell to a square PNG data URL (with inset). */
function cropTile(
  img: HTMLImageElement, g: GridState, col: number, row: number, size = 160,
): string {
  const inset = 0.05;
  const sx = g.x + (col + inset) * g.cellW;
  const sy = g.y + (row + inset) * g.cellH;
  const sw = g.cellW * (1 - 2 * inset);
  const sh = g.cellH * (1 - 2 * inset);
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return cv.toDataURL('image/png');
}

// -------------------------------------------------------------- component --

export function TileExtractorModal({
  open, onClose, onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** apply extracted tiles: (tiles[8], hexes[8]) */
  onApply: (tiles: string[], hexes: string[]) => void;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [grid, setGrid] = useState<GridState>(DEFAULT_GRID);
  const [tiles, setTiles] = useState<ExtractedTile[] | null>(null);
  const [cellCluster, setCellCluster] = useState<number[][] | null>(null); // [row][col] → cluster idx
  const [selSwap, setSelSwap] = useState<number | null>(null);
  const [note, setNote] = useState<string>('');

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [disp, setDisp] = useState({ w: 0, h: 0 });

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // ---------------------------------------------------------------- load --
  const loadFile = useCallback((file: File) => {
    const rd = new FileReader();
    rd.onload = () => setImgSrc(String(rd.result));
    rd.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (!imgSrc) return;
    const im = new Image();
    im.onload = () => {
      setImg(im);
      imgRef.current = im;
      // analysis canvas at original resolution
      const cv = document.createElement('canvas');
      cv.width = im.width; cv.height = im.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (ctx) { ctx.drawImage(im, 0, 0); ctxRef.current = ctx; }
      setGrid(detectGrid(im));
      setTiles(null);
      setCellCluster(null);
      setNote('');
    };
    im.src = imgSrc;
  }, [imgSrc]);

  // paste from clipboard
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const it = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const f = it?.getAsFile();
      if (f) loadFile(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, loadFile]);

  // esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ----------------------------------------------------------- extraction --
  const extract = () => {
    const ctx = ctxRef.current;
    const im = imgRef.current;
    if (!ctx || !im) return;
    const { samples, occupied } = sampleCells(ctx, grid);

    // cluster occupied cells
    const T = 20; // tight: separates e.g. milk vs dark chocolate
    const clusters: Array<{ members: number[]; center: CellSample }> = [];
    samples.forEach((m, idx) => {
      if (!occupied[idx]) return;
      for (const c of clusters) {
        if (dist(m, c.center) < T) { c.members.push(idx); return; }
      }
      clusters.push({ members: [idx], center: { ...m } });
    });
    // recompute centers
    clusters.forEach((c) => {
      c.center = c.members.reduce(
        (acc, i) => ({
          r: acc.r + samples[i].r / c.members.length,
          g: acc.g + samples[i].g / c.members.length,
          b: acc.b + samples[i].b / c.members.length,
          row: 0, col: 0,
        }),
        { r: 0, g: 0, b: 0, row: 0, col: 0 },
      );
    });
    clusters.sort((a, b) => b.members.length - a.members.length);

    const use = clusters.slice(0, 8);
    if (!use.length) {
      setNote('Nessun quadratino colorato trovato dentro la griglia: sposta/ridimensiona la griglia sulle caramelle e riprova.');
      setTiles(null);
      setCellCluster(null);
      return;
    }
    const out: ExtractedTile[] = use.map((c) => {
      const best = c.members.reduce((m, i) => (dist(samples[i], c.center) < dist(samples[m], c.center) ? i : m), c.members[0]);
      return {
        tile: cropTile(im, grid, samples[best].col, samples[best].row),
        hex: toHex(c.center.r, c.center.g, c.center.b),
        count: c.members.length,
      };
    });
    // cell → cluster index map for the overlay
    const map: number[][] = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(-1));
    use.forEach((c, ci) => c.members.forEach((idx) => {
      map[samples[idx].row][samples[idx].col] = ci;
    }));
    setTiles(out);
    setCellCluster(map);
    setSelSwap(null);
    setNote(`${use.length} colori distinti trovati (${use.reduce((a, c) => a + c.members.length, 0)} celle occupate).`);
  };

  const swapTiles = (a: number, b: number) => {
    setTiles((t) => {
      if (!t) return t;
      const n = [...t];
      [n[a], n[b]] = [n[b], n[a]];
      return n;
    });
    if (cellCluster) {
      setCellCluster(cellCluster.map((row) => row.map((v) => (v === a ? b : v === b ? a : v))));
    }
  };

  // ------------------------------------------------------------- display --
  // image drawn at stage width; grid overlay in % of displayed size
  const kDisp = img && disp.w ? disp.w / img.width : 1;

  const startGridDrag = (e: ReactPointerEvent) => {
    if (!img) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const g0 = { ...grid };
    const move = (ev: PointerEvent) => {
      setGrid({ ...g0, x: g0.x + (ev.clientX - sx) / kDisp, y: g0.y + (ev.clientY - sy) / kDisp });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startCellResize = (e: ReactPointerEvent, corner: 'se' | 'e' | 's') => {
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    const g0 = { ...grid };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / kDisp;
      const dy = (ev.clientY - sy) / kDisp;
      let cellW = g0.cellW, cellH = g0.cellH;
      if (corner === 'se') { cellW = g0.cellW + dx / g0.cols; cellH = g0.cellH + dy / g0.rows; }
      else if (corner === 'e') cellW = g0.cellW + dx / g0.cols;
      else cellH = g0.cellH + dy / g0.rows;
      // keep the top-left anchored, min 8px
      setGrid({ ...g0, cellW: Math.max(8, cellW), cellH: Math.max(8, cellH) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const num = (v: number) => Math.round(v);
  const apply = () => {
    if (!tiles) return;
    const pad = (i: number) => tiles[i] ?? tiles[tiles.length - 1];
    const tiles8 = Array.from({ length: 8 }, (_, i) => pad(i)?.tile ?? '');
    const hexes8 = Array.from({ length: 8 }, (_, i) => pad(i)?.hex ?? '#888888');
    onApply(tiles8, hexes8);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-950 shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 text-amber-400">
            <ScanSearch size={18} />
            <span className="text-[15px] font-bold">Estrai quadratini da screenshot</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        {!img ? (
          /* ---------------------------------------------------- drop zone */
          <label
            className="m-6 flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 py-20 transition-colors hover:border-amber-500/60 hover:bg-zinc-900/70"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) loadFile(f);
            }}
          >
            <Upload size={34} className="text-zinc-600" />
            <span className="text-[15px] font-semibold text-zinc-300">Trascina uno screenshot, incollalo (Ctrl+V) o clicca</span>
            <span className="max-w-md text-center text-[12px] leading-relaxed text-zinc-500">
              Foto o screenshot di un gioco con la board visibile: i quadratini colorati
              vengono rilevati e ritagliati automaticamente. Poi regoli la griglia a mano se serve.
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadFile(f);
            }} />
          </label>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5 lg:flex-row">
            {/* ---------------------------------------------------- stage */}
            <div className="relative flex min-w-0 flex-1 flex-col gap-3">
              <div
                ref={stageRef}
                className="relative mx-auto select-none overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                style={{ touchAction: 'none' }}
              >
                { }
                <img
                  src={imgSrc ?? ''}
                  alt="screenshot"
                  draggable={false}
                  className="block max-h-[54vh] w-auto max-w-full"
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setDisp({ w: el.clientWidth, h: el.clientHeight });
                  }}
                  ref={(el) => {
                    if (el && disp.w !== el.clientWidth) setDisp({ w: el.clientWidth, h: el.clientHeight });
                  }}
                />
                {/* grid overlay */}
                <div
                  onPointerDown={startGridDrag}
                  className="absolute cursor-move"
                  style={{
                    left: grid.x * kDisp,
                    top: grid.y * kDisp,
                    width: grid.cellW * grid.cols * kDisp,
                    height: grid.cellH * grid.rows * kDisp,
                    outline: '2px solid #22D3EE',
                    background:
                      'repeating-linear-gradient(to right, rgba(34,211,238,.35) 0 1px, transparent 1px ' +
                      `${grid.cellW * kDisp}px),` +
                      'repeating-linear-gradient(to bottom, rgba(34,211,238,.35) 0 1px, transparent 1px ' +
                      `${grid.cellH * kDisp}px)`,
                  }}
                >
                  {/* cluster badges */}
                  {cellCluster?.map((row, j) =>
                    row.map((ci, i) =>
                      ci >= 0 ? (
                        <span
                          key={`${i}-${j}`}
                          className="absolute rounded bg-amber-400 px-1 text-[9px] font-black text-zinc-900"
                          style={{ left: i * grid.cellW * kDisp + 2, top: j * grid.cellH * kDisp + 2 }}
                        >
                          {ci + 1}
                        </span>
                      ) : null,
                    ),
                  )}
                  {/* resize handles */}
                  {(['se', 'e', 's'] as const).map((c) => (
                    <div
                      key={c}
                      onPointerDown={(e) => startCellResize(e, c)}
                      className="absolute bg-cyan-400"
                      style={{
                        right: c === 's' ? '50%' : -7,
                        bottom: c === 'e' ? '50%' : -7,
                        width: c === 's' ? 36 : 14,
                        height: c === 'e' ? 36 : 14,
                        cursor: c === 'se' ? 'nwse-resize' : c === 'e' ? 'ew-resize' : 'ns-resize',
                        borderRadius: 3,
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-center text-[11px] text-zinc-500">
                Trascina la griglia per spostarla · maniglie ciano per cella L/A · serve solo la zona con i quadratini
              </p>
            </div>

            {/* ---------------------------------------------------- panel */}
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
              <div className="flex gap-2">
                <button
                  onClick={() => img && setGrid(detectGrid(img))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:border-cyan-500/60 hover:text-cyan-300"
                >
                  <Wand2 size={14} /> Rileva griglia
                </button>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:border-zinc-500">
                  <Upload size={14} /> Altra immagine
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                  }} />
                </label>
              </div>

              {/* grid numeric controls */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-[11px]">
                <div className="col-span-2 mb-0.5 flex items-center gap-1.5 font-bold text-zinc-400">
                  <Grid3X3 size={12} /> Griglia (px immagine)
                </div>
                {([
                  ['X', 'x'], ['Y', 'y'],
                  ['Cella L', 'cellW'], ['Cella A', 'cellH'],
                  ['Colonne', 'cols'], ['Righe', 'rows'],
                ] as Array<[string, keyof GridState]>).map(([label, key]) => (
                  <label key={key} className="flex items-center gap-1.5">
                    <span className="w-14 shrink-0 text-zinc-500">{label}</span>
                    <input
                      type="number"
                      value={num(grid[key])}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        setGrid((g) => ({
                          ...g,
                          [key]: key === 'cols' || key === 'rows' ? Math.min(16, Math.max(3, Math.round(v))) : Math.max(0, v),
                        }));
                      }}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200 outline-none focus:border-cyan-500/70"
                    />
                  </label>
                ))}
              </div>

              <button
                onClick={extract}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-bold text-zinc-950 transition-colors hover:bg-amber-400"
              >
                <Crop size={15} /> Estrai tessere
              </button>

              {note && <p className="text-[11px] leading-relaxed text-zinc-500">{note}</p>}

              {tiles && (
                <>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
                    <Sparkles size={12} className="text-amber-400" /> Tessere estratte
                    <span className="ml-auto flex items-center gap-1 font-normal text-zinc-600">
                      <ArrowLeftRight size={10} /> clicca due tessere per scambiarle
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {tiles.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (selSwap === null) setSelSwap(i);
                          else if (selSwap === i) setSelSwap(null);
                          else { swapTiles(selSwap, i); setSelSwap(null); }
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                          selSwap === i
                            ? 'border-amber-400 bg-amber-500/15'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
                        }`}
                      >
                        { }
                        <img src={t.tile} alt="" className="h-12 w-12 rounded-md" draggable={false} />
                        <span className="font-mono text-[8px] text-zinc-500">{t.hex}</span>
                        <span className="text-[8px] text-zinc-600">×{t.count}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={apply}
                    className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-[13px] font-bold text-zinc-950 transition-colors hover:bg-cyan-400"
                  >
                    Applica come blocchi ({tiles.length} gusti → 8 slot)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
