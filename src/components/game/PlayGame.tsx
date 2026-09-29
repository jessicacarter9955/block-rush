'use client';

// PlayGame — the fully playable Block Blast with the current skin applied:
// drag & drop (mouse + touch), ghost preview with line highlighting,
// original score/combo formulas, particles, popups, shake, pause & game over.

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  BackgroundView, BOARD, GRID as GRIDG, BestTextView, BoardFrameView, cellRect,
  ComboTextView, EmptyCellsView, IconButtonView, MaskIconView, PieceView,
  Plus100View, PopupSurface, RankingPanel, pos, relPos, ScoreTextView,
} from '@/components/game/Kit';
import { BlockTile } from '@/components/blocks/BlockTile';
import {
  canPlace, calcEarned, clearCells, findFullLines, hasAnyMove,
  placedCells, previewLines, originalTray, GRID,
  type Board, type Piece,
} from '@/lib/game';
import { useStudio } from '@/lib/store';
import { soundEngine } from '@/lib/audio';
import { BP } from '@/lib/bp';
import { withAlpha, lighten } from '@/lib/color';
import { blockImgTile, fontCss, type SkinState } from '@/lib/skin';

interface Popup { id: number; x: number; y: number; value: number }
interface Flash { id: number; r: number; c: number }
interface Particle {
  id: number; x: number; y: number; dx: number; dy: number;
  size: number; color: string; round: boolean; rot: number;
}

let FxId = 1;

const RANKING_ROWS: { name: string; score: number }[] = [
  { name: 'Kara', score: 1720 },
  { name: 'Camila', score: 1586 },
  { name: 'Philip', score: 1520 },
  { name: 'Gianni', score: 1378 },
  { name: 'Lya', score: 1250 },
  { name: 'Ava', score: 1232 },
  { name: 'Royce', score: 650 },
];

export function PlayGame({ areaRef }: { areaRef: React.RefObject<HTMLDivElement | null> }) {
  const skin = useStudio((s) => s.skin);
  const setPlaying = useStudio((s) => s.setPlaying);

  const [board, setBoard] = useState<Board>(() => Array(64).fill(null));
  const [tray, setTray] = useState<(Piece | null)[]>(() => originalTray(Array(64).fill(null)));
  const [score, setScore] = useState(0);
  const [scoreShown, setScoreShown] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(-1);
  const [heartOn, setHeartOn] = useState(false);
  const [drag, setDrag] = useState<{ slot: number; piece: Piece; x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<{ r: number; c: number; valid: boolean; rows: number[]; cols: number[] } | null>(null);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [comboShow, setComboShow] = useState<{ n: number; x: number; y: number } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [reviveOffer, setReviveOffer] = useState(false);
  const [reviveLeft, setReviveLeft] = useState(5);
  const revivesUsed = useRef(0);
  const [paused, setPaused] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);
  const noScore = useRef(0);
  const comboRef = useRef(-1);
  const boardRef = useRef(board);
  const trayRef = useRef(tray);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const reviveRef = useRef(false);
  const pausedRef = useRef(false);
  const dragRef = useRef<typeof drag>(null);
  const restartRef = useRef<() => void>(() => {});
  const reviveFnRef = useRef<() => void>(() => {});
  boardRef.current = board;
  trayRef.current = tray;
  comboRef.current = combo;
  scoreRef.current = score;
  gameOverRef.current = gameOver;
  reviveRef.current = reviveOffer;
  pausedRef.current = paused;
  dragRef.current = drag;

  // volumes
  useEffect(() => {
    soundEngine.setVolumes(skin.sounds.sfxVol, skin.sounds.musicVol);
  }, [skin.sounds.sfxVol, skin.sounds.musicVol]);

  // music on mount / cleanup
  useEffect(() => {
    void soundEngine.startMusic(skin.sounds.music);
    setMusicOn(true);
    return () => soundEngine.stopMusic();
     
  }, []);

  // ------------------------------------------------- bot debug hook --
  // window.__BB__ lets the in-page bot (and Playwright tests) read the live
  // game state and drive it without touching React internals.
  useEffect(() => {
    restartRef.current = restart;
    (window as unknown as Record<string, unknown>).__BB__ = {
      version: 'block-rush-1-1',
      getBoard: () => boardRef.current.map((v) => v),
      getTray: () => trayRef.current.map((p) => (p ? { ...p } : null)),
      getScore: () => scoreRef.current,
      getCombo: () => comboRef.current,
      isDragging: () => dragRef.current !== null,
      isGameOver: () => gameOverRef.current,
      canRevive: () => reviveRef.current,
      revive: () => reviveFnRef.current(),
      isPaused: () => pausedRef.current,
      restart: () => restartRef.current(),
    };
  });

  // score tween (original: 0.5s count-up) + best tracking
  useEffect(() => {
    setBest((b) => Math.max(b, score));
  }, [score]);
  useEffect(() => {
    const from = scoreShown;
    const to = score;
    if (from === to) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 500);
      setScoreShown(Math.round(from + (to - from) * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
     
  }, [score]);

  const toDesign = useCallback((clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1080,
      y: ((clientY - rect.top) / rect.height) * 1920,
    };
  }, [areaRef]);

  const spawnLineFx = useCallback((skinRef: SkinState, rows: number[], cols: number[], cleared: Set<number>, colors: (number | null)[]) => {
    const style = skinRef.effects.particles;
    if (style === 'none') return;
    const out: Particle[] = [];
    const mk = (x: number, y: number, dx: number, dy: number, color: string) => ({
      id: FxId++, x, y, dx, dy,
      size: style === 'original' ? 20 + Math.random() * 30 : 14 + Math.random() * 18,
      color: style === 'confetti'
        ? skinRef.blocks.colors[Math.floor(Math.random() * 8)]
        : color,
      round: style === 'rings',
      rot: (Math.random() - 0.5) * 720,
    });
    for (const r of rows) {
      const color = colors[Math.min(63, Math.max(0, r * GRID))] ?? skinRef.effects.flashColor;
      for (let i = 0; i < 14; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        out.push(mk(BOARD.originX + Math.random() * 840, BOARD.originY + r * 120, dir * (260 + Math.random() * 300), (Math.random() - 0.5) * 220, skinRef.blocks.colors[color as number] ?? '#FFFFFF'));
      }
    }
    for (const c of cols) {
      for (let i = 0; i < 14; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const rr = Math.floor(Math.random() * 8);
        out.push(mk(BOARD.originX + c * 120, BOARD.originY + rr * 120, (Math.random() - 0.5) * 220, dir * (260 + Math.random() * 300), skinRef.blocks.colors[colors[rr * GRID + c] ?? 0] ?? '#FFFFFF'));
      }
    }
    void cleared;
    setParticles((p) => [...p, ...out]);
    setTimeout(() => {
      const ids = new Set(out.map((o) => o.id));
      setParticles((p) => p.filter((x) => !ids.has(x.id)));
    }, 1100);
  }, []);

  const doPlace = useCallback((slot: number, r: number, c: number) => {
    const p = trayRef.current[slot];
    if (!p || !canPlace(boardRef.current, p, r, c)) return;
    const cells = placedCells(p, r, c);
    const next = [...boardRef.current];
    for (const [rr, cc] of cells) next[rr * GRID + cc] = p.color;
    setBoard(next);
    setScore((s) => s + cells.length);
    if (sfxOn) soundEngine.playEvent(skin.sounds.place);

    const lines = findFullLines(next);
    const nLines = lines.rows.length + lines.cols.length;

    let nextBoard = next;
    if (nLines > 0) {
      const comboAfter = comboRef.current + 1;
      setCombo(comboAfter);
      noScore.current = 0;
      setHeartOn(true);
      const earned = calcEarned(comboAfter, nLines);
      const { board: clearedB, cleared } = clearCells(next, lines.rows, lines.cols);
      nextBoard = clearedB;
      setBoard(clearedB);

      // flashes
      const fl: Flash[] = [...cleared].map((idx) => ({ id: FxId++, r: Math.floor(idx / GRID), c: idx % GRID }));
      setFlashes((f) => [...f, ...fl]);
      setTimeout(() => {
        const ids = new Set(fl.map((x) => x.id));
        setFlashes((f) => f.filter((x) => !ids.has(x.id)));
      }, 500);

      spawnLineFx(skin, lines.rows, lines.cols, cleared, next);

      if (sfxOn) soundEngine.playClear(skin.sounds.clear, comboAfter);
      if (nLines >= 2 && sfxOn) soundEngine.playCheer(skin.sounds.cheer, nLines);

      const cy = 434 + (r + p.h / 2) * 120;
      if (comboAfter >= 1) {
        // COMBO badge fisso al centro della board (come il reference);
        // il popup +N ha la sua corsia, così i due non si sovrappongono mai.
        setComboShow({ n: comboAfter, x: 540, y: 960 });
        setTimeout(() => setComboShow(null), 1600);
        if (comboAfter > 1) setShakeKey((k) => k + 1);
      }
      // +N popup alla posizione del pezzo eliminato, fuori dalla corsia combo.
      let ey = cy + 60;
      if (ey > 700 && ey < 1160) ey = 700;
      const pop: Popup = { id: FxId++, x: 540, y: Math.min(1500, ey), value: earned };
      setPopups((ps) => [...ps, pop]);
      setTimeout(() => setPopups((ps) => ps.filter((x) => x.id !== pop.id)), 1400);
      setScore((s) => s + earned);
    } else if (heartOn) {
      noScore.current += 1;
      if (noScore.current >= 3) {
        setCombo(-1);
        setHeartOn(false);
        noScore.current = 0;
      }
    }

    // consume piece (refill the tray when all three pieces are used)
    // 1:1 with the original "CreateShapes": pool of 5 placeable shapes.
    const remaining: (Piece | null)[] = trayRef.current.map((t, i) => (i === slot ? null : t));
    const nextTray: (Piece | null)[] = remaining.every((t) => !t)
      ? originalTray(nextBoard)
      : remaining;
    setTray(nextTray);
    setDrag(null);
    setGhost(null);

    // game over? — first offer the REVIVE (original "Revive" layer: watch an
    // ad and continue, score kept). If the countdown expires -> real game over.
    setTimeout(() => {
      if (!hasAnyMove(nextBoard, nextTray)) {
        if (revivesUsed.current >= 30) {
          setGameOver(true);
          if (sfxOn) soundEngine.playEvent(skin.sounds.gameOver);
        } else {
          setReviveOffer(true);
        }
      }
    }, 400);
  }, [skin, sfxOn, heartOn, spawnLineFx]);

  // ------------------------------------------------------------ revive --
  // Original "ReviveGame": new tray of placeable shapes, score kept.
  const revive = useCallback(() => {
    if (!reviveRef.current) return;
    revivesUsed.current += 1;
    setReviveOffer(false);
    setTray(originalTray(boardRef.current));
    if (sfxOn) soundEngine.playEvent(skin.sounds.button);
  }, [skin, sfxOn]);

  useEffect(() => { reviveFnRef.current = revive; }, [revive]);

  // revive countdown: 5 seconds (original ReviveTime)
  useEffect(() => {
    if (!reviveOffer) return;
    setReviveLeft(5);
    const iv = setInterval(() => {
      setReviveLeft((v) => {
        if (v <= 1) {
          clearInterval(iv);
          setReviveOffer(false);
          setGameOver(true);
          if (sfxOn) soundEngine.playEvent(skin.sounds.gameOver);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [reviveOffer, sfxOn]);

  // ------------------------------------------------------------ pointers --

  const onPieceDown = (slot: number) => (e: React.PointerEvent) => {
    if (gameOver || paused || reviveOffer) return;
    const p = trayRef.current[slot];
    if (!p) return;
    e.preventDefault();
    const d = toDesign(e.clientX, e.clientY);
    if (sfxOn) soundEngine.playEvent(skin.sounds.pickup);
    setDrag({ slot, piece: p, x: d.x, y: d.y });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = toDesign(e.clientX, e.clientY);
      setDrag((cur) => (cur ? { ...cur, x: d.x, y: d.y } : cur));
      const piece = drag.piece;
      const tlx = d.x - (piece.w * GRIDG.px) / 2;
      const tly = (d.y - 200) - (piece.h * GRIDG.py) / 2;
      const c = Math.round((tlx - BOARD.gridX) / GRIDG.px);
      const r = Math.round((tly - BOARD.gridY) / GRIDG.py);
      if (r >= -1 && r <= GRID && c >= -1 && c <= GRID) {
        const valid = canPlace(boardRef.current, piece, r, c);
        const lines = valid ? previewLines(boardRef.current, piece, r, c) : { rows: [], cols: [] };
        setGhost({ r, c, valid, rows: lines.rows, cols: lines.cols });
      } else {
        setGhost(null);
      }
    };
    const up = (e: PointerEvent) => {
      const d = toDesign(e.clientX, e.clientY);
      const piece = drag.piece;
      const tlx = d.x - (piece.w * GRIDG.px) / 2;
      const tly = (d.y - 200) - (piece.h * GRIDG.py) / 2;
      const c = Math.round((tlx - BOARD.gridX) / GRIDG.px);
      const r = Math.round((tly - BOARD.gridY) / GRIDG.py);
      if (canPlace(boardRef.current, piece, r, c)) {
        doPlace(drag.slot, r, c);
      } else {
        if (sfxOn) soundEngine.playEvent(skin.sounds.invalid);
        setDrag(null);
        setGhost(null);
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, toDesign, doPlace, sfxOn]);

  const restart = () => {
    setBoard(Array(64).fill(null));
    setTray(originalTray(Array(64).fill(null)));
    setScore(0);
    setScoreShown(0);
    setCombo(-1);
    setHeartOn(false);
    setGameOver(false);
    setReviveOffer(false);
    setPaused(false);
    setPopups([]);
    setFlashes([]);
    setParticles([]);
    setComboShow(null);
    setDrag(null);
    setGhost(null);
    noScore.current = 0;
    revivesUsed.current = 0;
    if (sfxOn) soundEngine.playEvent(skin.sounds.button);
  };

  const ghostCells = useMemo(() => {
    if (!ghost || !ghost.valid || !drag) return [];
    return drag.piece.cells.map(([dr, dc]) => [ghost.r + dr, ghost.c + dc] as [number, number]);
  }, [ghost, drag]);

  const lineHighlight = useMemo(() => {
    if (!ghost?.valid) return new Set<number>();
    const s = new Set<number>();
    for (const r of ghost.rows) for (let c = 0; c < GRID; c++) s.add(r * GRID + c);
    for (const c of ghost.cols) for (let r = 0; r < GRID; r++) s.add(r * GRID + c);
    return s;
  }, [ghost]);

  const shakeAmp = (skin.effects.shake / 100) * 26;

  return (
    <div style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }}>
      <div
        key={`shake-${shakeKey}`}
        className={shakeKey > 0 ? 'bb-shake' : undefined}
        style={{
          position: 'absolute', inset: 0,
          '--shake-amp': `${shakeAmp}px`,
        } as React.CSSProperties}
      >
      <BackgroundView skin={skin} />

      {/* HUD — 1:1: cuore e punteggio CONCENTRICI a (540,243), corona pulita
          in alto a sx col best SOTTO, pausa patch ricostruita a (981,115) */}
      {heartOn && (
        <div className="bb-heartpulse" style={pos(540, 243, 240, 240)}>
          <MaskIconView sprite="Heart-f00.png" color={skin.effects.comboGlow} size={240} glow={30} />
        </div>
      )}
      <div style={pos(540, 254, 700, 220)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScoreTextView skin={skin} value={scoreShown} animateKey={score} />
        </div>
      </div>
      {/* crown — patch 1:1 pulita dal reference (solo corona, niente cifra) */}
      <div style={pos(114, 131.5, 140, 125)}>
        <img src={`${BP}/textures/rush/crown.png`} alt="record" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
      </div>
      {/* best score — SOTTO la corona, centrato nella sua colonna */}
      <div style={pos(114, 275, 340, 130)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BestTextView skin={skin} value={Math.max(best, score)} />
        </div>
      </div>
      {/* pause — patch 1:1 dal reference: squircle viola a (951,130) */}
      <div style={pos(951, 130, 123, 123)}>
        <IconButtonView skin={skin} kind="pause" size={123} group="game" onClick={() => { setPaused(true); if (sfxOn) soundEngine.playEvent(skin.sounds.button); }} />
      </div>

      {/* board — container = area griglia 1:1 (74.5,385)-(1001,1328.5) */}
      <div style={pos(BOARD.x, BOARD.y, BOARD.size, BOARD.h)}>
        <BoardFrameView skin={skin} />
        <EmptyCellsView skin={skin} />
        {board.map((v, i) => {
          if (v === null) return null;
          const r = Math.floor(i / GRID), c = i % GRID;
          return (
            <div key={i} style={cellRect(r, c)}>
              <BlockTile colorIdx={v} color={skin.blocks.colors[v]} style={skin.blocks.style}
                size={GRIDG.px} sizeH={GRIDG.py} radius={skin.blocks.radius} gap={skin.blocks.gap} border={skin.blocks.border}
                imgSrc={blockImgTile(skin, v)} imgTint={skin.blocks.img?.tint}
                imgFit={skin.blocks.img?.fit} imgShadow={skin.blocks.img?.shadow} />
            </div>
          );
        })}

        {/* line highlight during drag */}
        {[...lineHighlight].map((idx) => {
          const r = Math.floor(idx / GRID), c = idx % GRID;
          return (
            <div key={`hl-${idx}`} style={{ ...cellRect(r, c), borderRadius: 14, background: withAlpha(skin.effects.flashColor, 0.28), boxShadow: `inset 0 0 0 3px ${withAlpha(skin.effects.flashColor, 0.5)}` }} />
          );
        })}

        {/* ghost */}
        {ghostCells.map(([r, c], i) => (
          <div key={`g-${i}`} style={cellRect(r, c)}>
            <BlockTile colorIdx={drag!.piece.color} color={skin.blocks.colors[drag!.piece.color]}
              style={skin.blocks.style} size={GRIDG.px} sizeH={GRIDG.py} radius={skin.blocks.radius} gap={skin.blocks.gap}
              border={skin.blocks.border} ghost={skin.ghost.style} ghostOpacity={skin.ghost.opacity}
              imgSrc={blockImgTile(skin, drag!.piece.color)} imgTint={skin.blocks.img?.tint}
              imgFit={skin.blocks.img?.fit} imgShadow={0} />
          </div>
        ))}

        {/* flashes */}
        {flashes.map((f) => (
          <div key={f.id} className="bb-flash" style={{ ...cellRect(f.r, f.c), background: skin.effects.flashColor }} />
        ))}
      </div>

      {/* particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="bb-fly"
          style={{
            position: 'absolute', left: p.x, top: p.y,
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: p.round ? '50%' : 4,
            border: p.round ? `3px solid ${withAlpha('#FFFFFF', 0.7)}` : undefined,
            // @ts-expect-error css vars
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rot}deg`,
          }}
        />
      ))}

      {/* +N popups */}
      {popups.map((p) => (
        <div key={p.id} className="bb-popup" style={pos(p.x, p.y, 500, 220)}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus100View skin={skin} value={p.value} />
          </div>
        </div>
      ))}

      {/* combo */}
      {comboShow && (
        <div className="bb-combo" style={pos(comboShow.x, comboShow.y, 500, 260)}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ ...fontCss('riffic', 64), color: '#FFFFFF', letterSpacing: '0.1em', textShadow: `0 0 22px ${withAlpha(skin.effects.comboGlow, 0.9)}` }}>COMBO</span>
            <ComboTextView skin={skin} value={comboShow.n} />
          </div>
        </div>
      )}

      {/* tray — 1:1 reference: slot fissi ben distanziati (190/540/890), pezzi
          a celle 89px, clamp delle forme larghe così non si toccano mai */}
      {[0, 1, 2].map((slot) => {
        const X = [190, 540, 890][slot];
        const p = tray[slot];
        const ph = skin.tray;
        const holder: React.CSSProperties = ph.img
          ? { backgroundImage: `url(${ph.img})`, backgroundSize: '100% 100%' }
          : ph.style === 'none'
          ? {}
          : ph.style === 'original'
            ? { backgroundImage: `url(${BP}/sprites/PlaceHolder-f00.png)`, backgroundSize: '100% 100%' }
            : ph.style === 'glass'
              ? { background: withAlpha(ph.color, ph.opacity / 100), borderRadius: 36, border: '2px solid rgba(255,255,255,0.25)' }
              : { background: withAlpha(ph.color, ph.opacity / 100), borderRadius: 36 };
        const isDragging = drag?.slot === slot;
        // clamp: le forme larghe si rimpiccioliscono per non toccare i vicini
        const scale = p ? Math.min(1, 310 / (p.w * 89), 310 / (p.h * 89)) : 1;
        return (
          <div key={slot} data-bb-slot={slot} style={pos(X, 1600, 340, 340)}
            onPointerDown={onPieceDown(slot)}>
            {(ph.img || ph.style !== 'none') && <div style={{ position: 'absolute', inset: 0, ...holder }} />}
            {p && !isDragging && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
                <div style={{ transform: `scale(${scale})` }}>
                  <PieceView skin={skin} cells={p.cells} color={p.color} w={p.w} h={p.h} cellSize={89} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* dragged piece follows the pointer, lifted like the original.
          1:1 col reference: il pezzo resta della STESSA dimensione che ha nel
          vassoio (niente ingrandimento alla presa) — il ghost sulla board
          mostra l'atterraggio a scala piena. */}
      {drag && (
        <div style={{ ...pos(drag.x, drag.y - 200, 600, 600), pointerEvents: 'none', zIndex: 60 }}>
          <div style={{ position: 'absolute', left: 300, top: 300, transform: 'translate(-50%,-50%)' }}>
            {(() => {
              const p = drag.piece;
              const s = Math.min(1, 310 / (p.w * 89), 310 / (p.h * 89));
              return (
                <div style={{ transform: `scale(${s})` }}>
                  <PieceView skin={skin} cells={p.cells} color={p.color} w={p.w} h={p.h} cellSize={89} />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* pause overlay — pannello purple candy (palette reference), layout
          centrato: titolo, toggle suono/musica (patch 1:1), pillole CSS */}
      {paused && !gameOver && !ranking && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.62)', zIndex: 80 }}>
          <div style={pos(540, 960.5, 886, 1113)}>
            <PopupSurface skin={skin} w={886} h={1113} />
            {/* close */}
            <div style={relPos(899, 482, 80, 80, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="close" size={80} group="game" onClick={() => setPaused(false)} />
            </div>
            {/* title */}
            <div style={{ ...relPos(540, 620, 700, 130, 540, 960.5, 886, 1113), ...fontCss('riffic', 92), color: '#FFFFFF', textAlign: 'center', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', textShadow: '0 6px 0 rgba(0,0,0,0.35)' }}>
              PAUSA
            </div>
            {/* toggles: sfx + music (patch 1:1 estratte dal reference) */}
            <div style={relPos(420, 800, 190, 190, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="sfx" size={190} group="settings" on={sfxOn} onClick={() => setSfxOn(!sfxOn)} />
            </div>
            <div style={relPos(660, 800, 190, 190, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="music" size={190} group="settings" on={musicOn}
                onClick={() => {
                  if (musicOn) soundEngine.stopMusic();
                  else void soundEngine.startMusic(skin.sounds.music);
                  setMusicOn(!musicOn);
                }} />
            </div>
            {/* pills */}
            <div style={relPos(540, 1022, 560, 132, 540, 960.5, 886, 1113)}>
              <PausePill label="RIGIOCA" onClick={restart} />
            </div>
            <div style={relPos(540, 1180, 560, 132, 540, 960.5, 886, 1113)}>
              <PausePill label="CLASSIFICA" onClick={() => setRanking(true)} />
            </div>
            <div style={relPos(540, 1338, 560, 132, 540, 960.5, 886, 1113)}>
              <PausePill label="HOME" onClick={() => setPlaying(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ranking overlay (dal menu pausa) — stesso pannello candy della home */}
      {ranking && (
        <RankingPanel skin={skin} onClose={() => setRanking(false)} best={Math.max(best, score)} />
      )}

      {/* revive popup (original "Revive" layer: watch ad & continue) */}
      {reviveOffer && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.66)', zIndex: 85 }}>
          <div style={pos(540, 760, 860, 760)}>
            <PopupSurface skin={skin} w={860} h={760}>
              <div
                style={{
                  position: 'absolute', left: 0, right: 0, top: 64,
                  ...fontCss('riffic', 76), color: '#FFFFFF', letterSpacing: '0.1em',
                  textAlign: 'center',
                  textShadow: `0 0 26px ${withAlpha(skin.popup.c1, 0.9)}, 0 4px 0 rgba(0,0,0,0.35)`,
                }}
              >
                CONTINUA?
              </div>
              {/* radial countdown */}
              <div
                style={{
                  position: 'absolute', left: '50%', top: 200, width: 260, height: 260,
                  transform: 'translateX(-50%)', borderRadius: '50%',
                  background: `conic-gradient(${withAlpha('#FFD34D', 0.95)} ${(reviveLeft / 5) * 360}deg, ${withAlpha('#FFFFFF', 0.12)} 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 196, height: 196, borderRadius: '50%',
                    background: withAlpha(skin.popup.c1, 0.98),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 8px 26px rgba(0,0,0,0.45)',
                  }}
                >
                  <span style={{ ...fontCss('riffic', 110), color: '#FFFFFF', textShadow: '0 5px 0 rgba(0,0,0,0.35)' }}>
                    {reviveLeft}
                  </span>
                </div>
              </div>
              {/* revive button */}
              <div
                data-bb-revive="1"
                onClick={revive}
                style={{
                  position: 'absolute', left: 60, right: 60, bottom: 62, height: 168,
                  borderRadius: 999, cursor: 'pointer',
                  background: `linear-gradient(180deg, ${lighten(skin.playBtn.c1, 0.15)}, ${skin.playBtn.c2})`,
                  border: `5px solid ${withAlpha('#FFFFFF', 0.45)}`,
                  boxShadow: `0 14px 40px ${withAlpha(skin.playBtn.c1, 0.5)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
                }}
              >
                <MaskIconView sprite="Heart-f00.png" color={skin.effects.comboGlow} size={104} glow={24} />
                <span style={{ ...fontCss('riffic', 56), color: skin.playBtn.textColor, letterSpacing: '0.04em', textShadow: '0 4px 0 rgba(0,0,0,0.3)', textAlign: 'center' }}>
                  GUARDA ANNUNCIO
                  <br />
                  E CONTINUA
                </span>
              </div>
            </PopupSurface>
          </div>
        </div>
      )}

      {/* game over overlay */}
      {gameOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.66)', zIndex: 90 }}>
          <div style={pos(540.2, 506.4, 940, 156)}>
            {skin.popup.style === 'original'
              ? <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${BP}/sprites/GameOver-f00.png)`, backgroundSize: '100% 100%' }} />
              : (
                <PopupSurface skin={skin} w={940} h={156}>
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...fontCss('riffic', 82), color: '#FFFFFF', letterSpacing: '0.1em',
                      textShadow: `0 0 26px ${withAlpha(skin.popup.c1, 0.9)}, 0 4px 0 rgba(0,0,0,0.35)`,
                    }}
                  >
                    GAME OVER
                  </div>
                </PopupSurface>
              )}
          </div>
          <div style={{ ...pos(540, 761.3, 600, 90), ...fontCss('riffic', 62), color: '#FFF', letterSpacing: '0.12em', textAlign: 'center' }}>SCORE</div>
          <div style={pos(540, 905, 800, 180)}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
              <ScoreTextView skin={skin} value={score} />
            </div>
          </div>
          <div style={{ ...pos(540, 1113, 700, 90), ...fontCss('riffic', 58), color: '#FFF', letterSpacing: '0.12em', textAlign: 'center' }}>BEST SCORE</div>
          <div style={pos(407.5, 1205.5, 136, 117)}>
            <img src={`${BP}/sprites/CupIcon-f00.png`} alt="record" draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
          </div>
          <div style={{ position: 'absolute', left: 482, top: 1177, height: 92, display: 'flex', alignItems: 'center' }}>
            <BestTextView skin={skin} value={Math.max(best, score)} align="left" />
          </div>
          <div style={pos(540.1, 1597.9, 510, 177)}>
            <GameOverResetButton skin={skin} onClick={restart} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function GameOverResetButton({ skin, onClick }: { skin: SkinState; onClick: () => void }) {
  if (skin.iconBtn.style === 'original') {
    return (
      <div onClick={onClick} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
        { }
        <img src={`${BP}/sprites/BtnGOReset-f00.png`} alt="Rigioca" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
      </div>
    );
  }
  const c1 = skin.playBtn.c1, c2 = skin.playBtn.c2;
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', inset: 0, cursor: 'pointer',
        borderRadius: 999,
        background: `linear-gradient(180deg, ${lighten(c1, 0.15)}, ${c2})`,
        border: `5px solid ${withAlpha('#FFFFFF', 0.45)}`,
        boxShadow: `0 14px 40px ${withAlpha(c1, 0.5)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ ...fontCss('riffic', 84), color: skin.playBtn.textColor, letterSpacing: '0.08em', textShadow: '0 4px 0 rgba(0,0,0,0.3)' }}>
        RIGIOCA
      </span>
    </div>
  );
}

/** Pill candy per il menu pausa — viola reference, bordo chiaro, gloss. */
function PausePill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', inset: 0, cursor: 'pointer',
        borderRadius: 999, boxSizing: 'border-box',
        background: 'linear-gradient(180deg, #9F6BFF 0%, #7038E8 55%, #5B2BD0 100%)',
        border: '4px solid rgba(255,255,255,0.5)',
        boxShadow: '0 12px 30px rgba(20,8,60,0.55), inset 0 6px 14px rgba(255,255,255,0.35), inset 0 -8px 16px rgba(30,10,90,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ ...fontCss('riffic', 62), color: '#FFFFFF', letterSpacing: '0.08em', textShadow: '0 4px 0 rgba(40,15,110,0.65)' }}>
        {label}
      </span>
    </div>
  );
}
