'use client';

import { useEffect, useMemo, useState } from 'react';
import { BackgroundView, BOARD, GRID as GRIDG, BoardFrameView, EmptyCellsView, PieceView, cellRect, pos } from '@/components/game/Kit';
import { Crown, Round, ScoreFit } from '@/components/game/RushUI';
import { BlockTile } from '@/components/blocks/BlockTile';
import { applyCreativeMove, type CreativeBotState } from '@/lib/creative-bot';
import { BLOCK_RUSH_PRESET, blockImgTile, fontCss } from '@/lib/skin';
import type { CreativeScenario } from '@/lib/creative-scenarios';

function initialState(scenario: CreativeScenario): CreativeBotState {
  return {
    board: [...scenario.board],
    tray: scenario.tray.map((piece) => ({ ...piece, cells: piece.cells.map(([r, c]) => [r, c] as [number, number]) })),
    score: scenario.id === 'high_score' ? 9_840 : 0,
    combo: scenario.id === 'massive_combo' ? 2 : 0,
    clearedLines: 0,
    lastMove: null,
  };
}

export function CreativeRushPlayer({
  scenario,
  replayToken,
}: {
  scenario: CreativeScenario;
  replayToken: number;
}) {
  const skin = useMemo(() => BLOCK_RUSH_PRESET.build(), []);
  const [state, setState] = useState<CreativeBotState>(() => initialState(scenario));
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [done, setDone] = useState(false);

  const move = scenario.script[0];
  const piece = state.tray[move?.slot ?? 0] ?? scenario.tray[move?.slot ?? 0] ?? null;

  useEffect(() => {
    let active = true;
    setState(initialState(scenario));
    setDragging(false);
    setSettling(false);
    setDone(false);

    const t1 = window.setTimeout(() => active && setDragging(true), 450);
    const t2 = window.setTimeout(() => {
      if (!active) return;
      setDragging(false);
      setSettling(true);
    }, 1500);
    const t3 = window.setTimeout(() => {
      if (!active) return;
      setState((current) => applyCreativeMove(current, scenario.script[0]));
      setSettling(false);
      setDone(true);
    }, 1900);

    return () => {
      active = false;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [scenario, replayToken]);

  const targetCenter = useMemo(() => {
    if (!piece || !move) return { x: 540, y: 1600 };
    return {
      x: BOARD.gridX + (move.c + piece.w / 2) * GRIDG.px,
      y: BOARD.gridY + (move.r + piece.h / 2) * GRIDG.py,
    };
  }, [move, piece]);

  const trayX = [190, 540, 890][move?.slot ?? 0] ?? 540;

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[24px] bg-[#0a1755]">
      <div
        style={{
          width: 1080,
          height: 1920,
          transform: 'scale(var(--creative-scale, 0.5))',
          transformOrigin: 'top left',
          position: 'absolute',
          inset: 0,
        }}
        className="creative-design"
      >
        <BackgroundView skin={skin} />

        <div style={pos(148, 107, 158, 158)}><Crown size={158} /></div>
        <ScoreFit value={state.score} x={560} y={243} w={530} h={200} size={160} />
        <ScoreFit value={Math.max(state.score, 2480)} x={148} y={258} w={240} h={110} size={92} color="#fdf303" />
        <Round kind="help" x={805} y={115} size={120} onClick={() => {}} />
        <div style={pos(981, 115, 185, 185)}>
          <Round kind="pause" x={92.5} y={92.5} size={142} onClick={() => {}} />
        </div>

        <div style={pos(BOARD.x, BOARD.y, BOARD.size, BOARD.h)}>
          <BoardFrameView skin={skin} />
          <EmptyCellsView skin={skin} />

          {state.board.map((value, index) => {
            if (value === null) return null;
            const r = Math.floor(index / 8);
            const c = index % 8;
            return (
              <div key={index} style={cellRect(r, c)}>
                <BlockTile
                  colorIdx={value}
                  color={skin.blocks.colors[value]}
                  style={skin.blocks.style}
                  size={GRIDG.px}
                  sizeH={GRIDG.py}
                  radius={skin.blocks.radius}
                  gap={skin.blocks.gap}
                  border={skin.blocks.border}
                  imgSrc={blockImgTile(skin, value)}
                  imgTint={skin.blocks.img?.tint}
                  imgFit={skin.blocks.img?.fit}
                  imgShadow={skin.blocks.img?.shadow}
                />
              </div>
            );
          })}

          {settling && piece && move && piece.cells.map(([dr, dc], i) => (
            <div key={i} style={cellRect(move.r + dr, move.c + dc)}>
              <BlockTile
                colorIdx={piece.color}
                color={skin.blocks.colors[piece.color]}
                style={skin.blocks.style}
                size={GRIDG.px}
                sizeH={GRIDG.py}
                radius={skin.blocks.radius}
                gap={skin.blocks.gap}
                border={skin.blocks.border}
                imgSrc={blockImgTile(skin, piece.color)}
                imgTint={skin.blocks.img?.tint}
                imgFit={skin.blocks.img?.fit}
                imgShadow={skin.blocks.img?.shadow}
              />
            </div>
          ))}
        </div>

        {state.tray.map((trayPiece, slot) => {
          if (!trayPiece || (dragging && slot === move?.slot)) return null;
          const x = [190, 540, 890][slot];
          const scale = Math.min(1, 300 / (trayPiece.w * 89), 300 / (trayPiece.h * 89));
          return (
            <div key={slot} style={pos(x, 1600, 340, 340)}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ transform: `scale(${scale})` }}>
                  <PieceView skin={skin} cells={trayPiece.cells} color={trayPiece.color} w={trayPiece.w} h={trayPiece.h} cellSize={89} />
                </div>
              </div>
            </div>
          );
        })}

        {dragging && piece && (
          <div
            style={{
              ...pos(targetCenter.x, targetCenter.y, 600, 600),
              transition: 'all 950ms cubic-bezier(.2,.8,.2,1)',
              animation: 'creative-drag-in 950ms cubic-bezier(.2,.8,.2,1) both',
              ['--creative-start-x' as string]: `${trayX - targetCenter.x}px`,
              ['--creative-start-y' as string]: `${1600 - targetCenter.y}px`,
              pointerEvents: 'none',
              zIndex: 60,
            }}
          >
            <div style={{ position: 'absolute', left: 300, top: 300, transform: 'translate(-50%,-50%)' }}>
              <PieceView skin={skin} cells={piece.cells} color={piece.color} w={piece.w} h={piece.h} cellSize={GRIDG.px} />
            </div>
          </div>
        )}

        <div style={{ ...pos(540, 330, 920, 110), display: 'grid', placeItems: 'center', textAlign: 'center', color: 'white', ...fontCss('luckiest', 52), textShadow: '0 4px 0 #251660,0 0 18px #49e9ff' }}>
          {scenario.hook}
        </div>

        {done && (
          <div style={{ ...pos(540, 830, 760, 220), display: 'grid', placeItems: 'center', textAlign: 'center', color: 'white', ...fontCss('luckiest', 76), textShadow: '0 4px 0 #3a146b,0 0 28px #49e9ff' }}>
            {state.clearedLines > 0 ? `${state.clearedLines} LINE CLEAR` : 'MOVE COMPLETE'}
          </div>
        )}
      </div>

      <style jsx>{`
        .creative-design {
          --creative-scale: calc((100vw - 3rem) / 1080);
        }
        @media (min-width: 1024px) {
          .creative-design { --creative-scale: 0.43; }
        }
        @keyframes creative-drag-in {
          from { transform: translate(var(--creative-start-x), var(--creative-start-y)); }
          to { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
}
