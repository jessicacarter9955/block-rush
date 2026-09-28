'use client';

// Screen: POPUP — pause, game over and leaderboard, with the exact original
// geometry from layout_constants.dart. Switchable via sub-tabs.

import type { ReactNode } from 'react';
import {
  BackgroundView, BestTextView, IconButtonView, MaskIconView, PopupSurface,
  pos, relPos, ScoreTextView,
} from '@/components/game/Kit';
import { Hotspot } from './Hotspot';
import { useStudio } from '@/lib/store';
import { RANKING_ROWS } from '@/lib/assets-data';
import { fontCss } from '@/lib/skin';
import { withAlpha } from '@/lib/color';
import { GameBoard } from './ScreenGame';

// ------------------------------------------------------------- PAUSE -------

const PAUSE = { x: 540, y: 960.5, w: 886, h: 1113 };
const rp = (X: number, Y: number, w: number, h: number) =>
  relPos(X, Y, w, h, PAUSE.x, PAUSE.y, PAUSE.w, PAUSE.h);

function PausePopup() {
  const skin = useStudio((s) => s.skin);
  const original = skin.popup.style === 'original';
  const body: ReactNode = (
    <>
      {/* close (899,482) · sfx (794,654) · music (794,817) · home (761,994) · reset (761,1164) · ranking (761,1344) */}
      <div style={rp(899, 482, 80, 80)}>
        <IconButtonView skin={skin} kind="close" size={80} group="game" />
      </div>
      <div style={rp(794, 654, 210, 100)}>
        <IconButtonView skin={skin} kind="sfx" size={100} variant="wide" group="settings" />
      </div>
      <div style={rp(794, 817, 210, 100)}>
        <IconButtonView skin={skin} kind="music" size={100} variant="wide" group="settings" />
      </div>
      <div style={rp(761, 994, 282, 115)}>
        <IconButtonView skin={skin} kind="home" size={115} group="game" />
      </div>
      <div style={rp(761, 1164, 282, 116)}>
        <IconButtonView skin={skin} kind="reset" size={116} group="game" />
      </div>
      <div style={rp(761, 1344, 280, 114)}>
        <IconButtonView skin={skin} kind="showRanking" size={114} group="game" />
      </div>
    </>
  );
  return (
    <Hotspot id="popup" label="Popup pausa" style={pos(PAUSE.x, PAUSE.y, PAUSE.w, PAUSE.h)}>
      {original ? (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/sprites/PausePopup-f00.png)', backgroundSize: '100% 100%' }}>
          {body}
        </div>
      ) : (
        <PopupSurface skin={skin} w={PAUSE.w} h={PAUSE.h}>{body}</PopupSurface>
      )}
    </Hotspot>
  );
}

// ---------------------------------------------------------- GAME OVER ------

function GameOverOverlay() {
  const skin = useStudio((s) => s.skin);
  const original = skin.popup.style === 'original';
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.62)' }} />
      <Hotspot id="popup" label="Banner Game Over" style={pos(540.2, 506.4, 940, 156)}>
        {original ? (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/sprites/GameOver-f00.png)', backgroundSize: '100% 100%' }} />
        ) : (
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
      </Hotspot>

      <div
        style={{
          ...pos(540, 761.3, 600, 90), ...fontCss('riffic', 62),
          color: '#FFFFFF', letterSpacing: '0.12em', textAlign: 'center',
          textShadow: '0 3px 10px rgba(0,0,0,0.5)',
        }}
      >
        SCORE
      </div>
      <div style={pos(540, 905, 800, 180)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
          <ScoreTextView skin={skin} value={2263} />
        </div>
      </div>
      <div
        style={{
          ...pos(540, 1113, 700, 90), ...fontCss('riffic', 58),
          color: '#FFFFFF', letterSpacing: '0.12em', textAlign: 'center',
          textShadow: '0 3px 10px rgba(0,0,0,0.5)',
        }}
      >
        BEST SCORE
      </div>
      <Hotspot id="cupIcon" label="Coppa" style={pos(407.5, 1205.5, 140, 140)}>
        <MaskIconView sprite="CupIcon-f00.png" color="#F3BF08" size={140} glow={20} glowColor="#FFE066" />
      </Hotspot>
      <Hotspot id="best" label="Record" style={pos(560, 1223, 300, 64)}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
          <BestTextView skin={skin} value="3250" />
        </div>
      </Hotspot>
      <Hotspot id="iconBtn" label="Bottone rigioca" style={pos(540.1, 1597.9, 510, 177)}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden' }}>
          <IconButtonView skin={skin} kind="reset" size={177} group="game" />
        </div>
      </Hotspot>
    </>
  );
}

// ----------------------------------------------------------- RANKING -------

const LB = { x: 540, y: 966.5, w: 928, h: 1535 };
const rlb = (X: number, Y: number, w: number, h: number) =>
  relPos(X, Y, w, h, LB.x, LB.y, LB.w, LB.h);

function RankingPopup() {
  const skin = useStudio((s) => s.skin);
  const original = skin.popup.style === 'original';
  const rows = [...RANKING_ROWS.slice(0, 7), { name: 'Tu', score: 2263 }];
  const body: ReactNode = (
    <>
      <div
        style={{
          ...rlb(540, 283, 700, 110), ...fontCss('riffic', 72),
          color: '#FFFFFF', textAlign: 'center', letterSpacing: '0.08em',
          textShadow: '0 3px 10px rgba(0,0,0,0.5)',
        }}
      >
        CLASSIFICA
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            ...rlb(540, 490 + i * 120, 733, 103),
            display: 'flex', alignItems: 'center', padding: '0 40px', boxSizing: 'border-box',
            borderRadius: 26,
            background: r.name === 'Tu'
              ? withAlpha(skin.effects.comboGlow, 0.22)
              : withAlpha('#0A0F26', 0.45),
            border: r.name === 'Tu' ? `3px solid ${skin.effects.comboGlow}` : '2px solid rgba(255,255,255,0.12)',
          }}
        >
          <span style={{ ...fontCss('carlito', 44), color: '#FFD98A', width: 70 }}>
            {i + 1}
          </span>
          <span style={{ ...fontCss('carlito', 46), color: '#FFFFFF', flex: 1 }}>
            {r.name}
          </span>
          <span style={{ ...fontCss('carlito', 46), color: '#FFFFFF', opacity: 0.9 }}>
            {r.score.toLocaleString('it-IT')}
          </span>
        </div>
      ))}
      <div style={rlb(918, 275, 89, 89)}>
        <IconButtonView skin={skin} kind="close" size={89} group="game" />
      </div>
    </>
  );
  return (
    <Hotspot id="popup" label="Popup classifica" style={pos(LB.x, LB.y, LB.w, LB.h)}>
      {original ? (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/sprites/LeaderboardPopup2-f00.png)', backgroundSize: '100% 100%' }}>
          {body}
        </div>
      ) : (
        <PopupSurface skin={skin} w={LB.w} h={LB.h}>{body}</PopupSurface>
      )}
    </Hotspot>
  );
}

// -------------------------------------------------------------- screen -----

export function ScreenPopups() {
  const skin = useStudio((s) => s.skin);
  const tab = useStudio((s) => s.popupTab);
  // Game Over shows over a dimmed board (like the real game).
  const bg = tab === 'gameover' ? <GameBoard hotspot={false} /> : null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <BackgroundView skin={skin} />
      {bg}
      {tab === 'pause' && <PausePopup />}
      {tab === 'gameover' && <GameOverOverlay />}
      {tab === 'ranking' && <RankingPopup />}
    </div>
  );
}
