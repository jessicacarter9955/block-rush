'use client';

// Screen: GIOCO — full HUD preview with a curated board, tray, +100 popup
// and combo, all selectable. Blocks are individually clickable (color).

import type { ReactNode } from 'react';
import {
  BackgroundView, BestIconView, BOARD, BestTextView, BoardFrameView, cellRect,
  ComboTextView, EmptyCellsView, IconButtonView, MaskIconView, PieceView,
  Plus100View, pos, ScoreTextView,
} from '@/components/game/Kit';
import { BlockTile } from '@/components/blocks/BlockTile';
import { Hotspot } from './Hotspot';
import { useStudio } from '@/lib/store';
import { sampleBoard, sampleTrayPieces, GRID } from '@/lib/game';
import { withAlpha } from '@/lib/color';
import { blockImgTile } from '@/lib/skin';

export function BoardBlocks({ hotspot }: { hotspot?: boolean }) {
  const skin = useStudio((s) => s.skin);
  const board = sampleBoard();
  const cells: ReactNode[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const v = board[r * GRID + c];
      if (v === null) continue;
      const tile = (
        <BlockTile
          colorIdx={v}
          color={skin.blocks.colors[v]}
          style={skin.blocks.style}
          size={120}
          radius={skin.blocks.radius}
          gap={skin.blocks.gap}
          border={skin.blocks.border}
          imgSrc={blockImgTile(skin, v)}
          imgTint={skin.blocks.img?.tint}
          imgFit={skin.blocks.img?.fit}
          imgShadow={skin.blocks.img?.shadow}
        />
      );
      cells.push(
        hotspot ? (
          <Hotspot
            key={`${r}-${c}`}
            id="blocks"
            label={`Blocco · colore ${v + 1}`}
            colorIdx={v}
            style={cellRect(r, c)}
          >
            {tile}
          </Hotspot>
        ) : (
          <div key={`${r}-${c}`} style={cellRect(r, c)}>{tile}</div>
        ),
      );
    }
  }
  return <>{cells}</>;
}

export function GameBoard({ hotspot = true }: { hotspot?: boolean }) {
  const skin = useStudio((s) => s.skin);
  return (
    <Hotspot
      id="board"
      label="Tabellone"
      style={pos(BOARD.x, BOARD.y, BOARD.size, BOARD.size)}
    >
      <BoardFrameView skin={skin} />
      <EmptyCellsView skin={skin} />
      <BoardBlocks hotspot={hotspot} />
    </Hotspot>
  );
}

function TrayPieceSlot({ slot }: { slot: number }) {
  const skin = useStudio((s) => s.skin);
  const pieces = sampleTrayPieces();
  const p = pieces[slot];
  const X = [196.5, 539.5, 883.5][slot];
  const ph = skin.tray;
  const holder: React.CSSProperties =
    ph.img
      ? { backgroundImage: `url(${ph.img})`, backgroundSize: '100% 100%' }
      : ph.style === 'none'
      ? { display: 'none' }
      : ph.style === 'original'
        ? {
            backgroundImage: 'url(/sprites/PlaceHolder-f00.png)',
            backgroundSize: '100% 100%',
          }
        : ph.style === 'glass'
          ? {
              background: withAlpha(ph.color, ph.opacity / 100),
              borderRadius: 36, border: '2px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(4px)',
              boxShadow: 'inset 0 2px 14px rgba(255,255,255,0.1)',
            }
          : {
              background: withAlpha(ph.color, ph.opacity / 100),
              borderRadius: 36,
              boxShadow: 'inset 0 3px 12px rgba(0,0,0,0.45)',
            };

  return (
    <Hotspot id="tray" label="Vassoio dei pezzi" style={pos(X, 1626, 250, 250)}>
      <div style={{ position: 'absolute', inset: 0, ...holder }} />
      <div
        style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <PieceView
          skin={skin}
          cells={p.cells}
          color={p.color}
          w={p.w}
          h={p.h}
          cellSize={60}
        />
      </div>
    </Hotspot>
  );
}

export function ScreenGame() {
  const skin = useStudio((s) => s.skin);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <BackgroundView skin={skin} />
      <Hotspot id="background" label="Sfondo" style={{ position: 'absolute', inset: 0 }}>
        <div />
      </Hotspot>

      {/* heart behind the score (combo active) */}
      <Hotspot id="heartIcon" label="Cuore combo" style={pos(540, 210, 240, 240)}>
        <div className="bb-heartpulse" style={{ position: 'absolute', inset: 0 }}>
          <MaskIconView sprite="Heart-f00.png" color={skin.effects.comboGlow} size={240} glow={30} />
        </div>
      </Hotspot>

      {/* score */}
      <Hotspot id="score" label="Punteggio" style={pos(540, 211.5, 700, 160)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScoreTextView skin={skin} value={1250} />
        </div>
      </Hotspot>

      {/* best score + cup */}
      <Hotspot id="cupIcon" label="Coppa" style={pos(97, 76, 104, 104)}>
        <BestIconView skin={skin} size={104} />
      </Hotspot>
      <Hotspot id="best" label="Record" style={pos(230, 82, 300, 64)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
          <BestTextView skin={skin} value="3250" />
        </div>
      </Hotspot>

      {/* pause */}
      <Hotspot id="iconBtn" label="Bottone pausa" style={pos(974, 88, 100, 100)}>
        <IconButtonView skin={skin} kind="pause" size={100} group="game" />
      </Hotspot>

      <GameBoard />

      {/* combo counter (over the board, like the original) */}
      <Hotspot id="combo" label="Combo" style={pos(540, 480, 320, 180)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bb-floaty">
          <ComboTextView skin={skin} value={3} />
        </div>
      </Hotspot>

      <TrayPieceSlot slot={0} />
      <TrayPieceSlot slot={1} />
      <TrayPieceSlot slot={2} />

      {/* +100 popup preview (over the board like the original) */}
      <Hotspot id="plus100" label="+100 guadagno" style={pos(540, 1415, 360, 150)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bb-floaty">
          <Plus100View skin={skin} value={120} />
        </div>
      </Hotspot>
    </div>
  );
}
