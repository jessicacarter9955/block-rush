'use client';

// PlayGame — the fully playable Block Blast with the current skin applied:
// drag & drop (mouse + touch), ghost preview with line highlighting,
// original score/combo formulas, particles, popups, shake, pause & game over.

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  BackgroundView, BestIconView, BOARD, BestTextView, BoardFrameView, cellRect,
  ComboTextView, EmptyCellsView, IconButtonView, MaskIconView, PieceView,
  Plus100View, PopupSurface, pos, relPos, ScoreTextView,
} from '@/components/game/Kit';
import { BlockTile } from '@/components/blocks/BlockTile';
import {
  canPlace, calcEarned, clearCells, findFullLines, hasAnyMove,
  placedCells, previewLines, originalTray, GRID,
  type Board, type Piece,
} from '@/lib/game';
import { useStudio } from '@/lib/store';
import { soundEngine } from '@/lib/audio';
import { withAlpha, lighten } from '@/lib/color';
import { blockImgTile, fontCss, type SkinState } from '@/lib/skin';

interface Popup { id: number; x: number; y: number; value: number }
interface Flash { id: number; r: number; c: number }
interface Particle {
  id: number; x: number; y: number; dx: number; dy: number;
  size: number; color: string; round: boolean; rot: number;
}

let FxId = 1;

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
        out.push(mk(120 + Math.random() * 840, 411 + r * 120, dir * (260 + Math.random() * 300), (Math.random() - 0.5) * 220, skinRef.blocks.colors[color as number] ?? '#FFFFFF'));
      }
    }
    for (const c of cols) {
      for (let i = 0; i < 14; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const rr = Math.floor(Math.random() * 8);
        out.push(mk(120 + c * 120, 411 + rr * 120, (Math.random() - 0.5) * 220, dir * (260 + Math.random() * 300), skinRef.blocks.colors[colors[rr * GRID + c] ?? 0] ?? '#FFFFFF'));
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

      const cy = 411 + (r + p.h / 2) * 120;
      if (comboAfter >= 1) {
        setComboShow({ n: comboAfter, x: 540, y: cy - 60 });
        setTimeout(() => setComboShow(null), 1600);
        if (comboAfter > 1) setShakeKey((k) => k + 1);
      }
      const pop: Popup = { id: FxId++, x: 540, y: Math.min(1560, cy + 60), value: earned };
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
      const tlx = d.x - (piece.w * 120) / 2;
      const tly = (d.y - 200) - (piece.h * 120) / 2;
      const c = Math.round((tlx - 60) / 120);
      const r = Math.round((tly - 351) / 120);
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
      const tlx = d.x - (piece.w * 120) / 2;
      const tly = (d.y - 200) - (piece.h * 120) / 2;
      const c = Math.round((tlx - 60) / 120);
      const r = Math.round((tly - 351) / 120);
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

      {/* HUD */}
      {heartOn && (
        <div className="bb-heartpulse" style={pos(540, 210, 240, 240)}>
          <MaskIconView sprite="Heart-f00.png" color={skin.effects.comboGlow} size={240} glow={30} />
        </div>
      )}
      <div style={pos(540, 211.5, 700, 160)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScoreTextView skin={skin} value={scoreShown} animateKey={scoreShown} />
        </div>
      </div>
      <div style={pos(97, 76, 104, 104)}>
        <BestIconView skin={skin} size={104} />
      </div>
      <div style={pos(230, 82, 300, 64)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
          <BestTextView skin={skin} value={Math.max(best, score)} />
        </div>
      </div>
      <div style={pos(974, 88, 100, 100)}>
        <IconButtonView skin={skin} kind="pause" size={100} group="game" onClick={() => { setPaused(true); if (sfxOn) soundEngine.playEvent(skin.sounds.button); }} />
      </div>

      {/* board */}
      <div style={pos(BOARD.x, BOARD.y, BOARD.size, BOARD.size)}>
        <BoardFrameView skin={skin} />
        <EmptyCellsView skin={skin} />
        {board.map((v, i) => {
          if (v === null) return null;
          const r = Math.floor(i / GRID), c = i % GRID;
          return (
            <div key={i} style={cellRect(r, c)}>
              <BlockTile colorIdx={v} color={skin.blocks.colors[v]} style={skin.blocks.style}
                size={120} radius={skin.blocks.radius} gap={skin.blocks.gap} border={skin.blocks.border}
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
              style={skin.blocks.style} size={120} radius={skin.blocks.radius} gap={skin.blocks.gap}
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

      {/* tray */}
      {[0, 1, 2].map((slot) => {
        const X = [196.5, 539.5, 883.5][slot];
        const p = tray[slot];
        const ph = skin.tray;
        const holder: React.CSSProperties = ph.img
          ? { backgroundImage: `url(${ph.img})`, backgroundSize: '100% 100%' }
          : ph.style === 'none'
          ? {}
          : ph.style === 'original'
            ? { backgroundImage: 'url(/sprites/PlaceHolder-f00.png)', backgroundSize: '100% 100%' }
            : ph.style === 'glass'
              ? { background: withAlpha(ph.color, ph.opacity / 100), borderRadius: 36, border: '2px solid rgba(255,255,255,0.25)' }
              : { background: withAlpha(ph.color, ph.opacity / 100), borderRadius: 36 };
        const isDragging = drag?.slot === slot;
        return (
          <div key={slot} data-bb-slot={slot} style={pos(X, 1626, 250, 250)}
            onPointerDown={onPieceDown(slot)}>
            {(ph.img || ph.style !== 'none') && <div style={{ position: 'absolute', inset: 0, ...holder }} />}
            {p && !isDragging && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
                <PieceView skin={skin} cells={p.cells} color={p.color} w={p.w} h={p.h} cellSize={60} />
              </div>
            )}
          </div>
        );
      })}

      {/* dragged piece follows the pointer, lifted like the original */}
      {drag && (
        <div style={{ ...pos(drag.x, drag.y - 200, 600, 600), pointerEvents: 'none', zIndex: 60 }}>
          <div style={{ position: 'absolute', left: 300, top: 300, transform: 'translate(-50%,-50%)' }}>
            <PieceView skin={skin} cells={drag.piece.cells} color={drag.piece.color} w={drag.piece.w} h={drag.piece.h} cellSize={120} />
          </div>
        </div>
      )}

      {/* pause overlay */}
      {paused && !gameOver && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.55)', zIndex: 80 }}>
          <div style={pos(540, 960.5, 886, 1113)}>
            {skin.popup.style === 'original' ? (
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/sprites/PausePopup-f00.png)', backgroundSize: '100% 100%' }} />
            ) : (
              <PopupSurface skin={skin} w={886} h={1113} />
            )}
            <div style={relPos(899, 482, 80, 80, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="close" size={80} group="game" onClick={() => setPaused(false)} />
            </div>
            <div style={relPos(794, 654, 210, 100, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="sfx" size={100} variant="wide" group="settings" on={sfxOn} onClick={() => setSfxOn(!sfxOn)} />
            </div>
            <div style={relPos(794, 817, 210, 100, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="music" size={100} variant="wide" group="settings" on={musicOn}
                onClick={() => {
                  if (musicOn) soundEngine.stopMusic();
                  else void soundEngine.startMusic(skin.sounds.music);
                  setMusicOn(!musicOn);
                }} />
            </div>
            <div style={relPos(761, 994, 282, 115, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="home" size={115} group="game" onClick={() => setPlaying(false)} />
            </div>
            <div style={relPos(761, 1164, 282, 116, 540, 960.5, 886, 1113)}>
              <IconButtonView skin={skin} kind="reset" size={116} group="game" onClick={restart} />
            </div>
          </div>
        </div>
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
              ? <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/sprites/GameOver-f00.png)', backgroundSize: '100% 100%' }} />
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
          <div style={pos(407.5, 1205.5, 140, 140)}>
            <BestIconView skin={skin} size={140} />
          </div>
          <div style={pos(560, 1223, 300, 64)}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
              <BestTextView skin={skin} value={Math.max(best, score)} />
            </div>
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
        <img src="/sprites/BtnGOReset-f00.png" alt="Rigioca" draggable={false}
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
