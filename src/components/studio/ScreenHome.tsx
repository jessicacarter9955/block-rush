'use client';

// Screen: HOME — logo, play button, bottom icon row (ranking/music/sfx).

import { BackgroundView, IconButtonView, LogoView, PlayButtonView, pos } from '@/components/game/Kit';
import { Hotspot } from './Hotspot';
import { useStudio } from '@/lib/store';
import { soundEngine } from '@/lib/audio';

export function ScreenHome() {
  const skin = useStudio((s) => s.skin);
  const iconSize = skin.iconBtn.size ?? 170;
  const logoY = skin.logo.y ?? 532;
  const playY = skin.playBtn.y ?? 1295;
  const rowY = skin.iconBtn.rowY ?? 1770;
  const setScreen = useStudio((s) => s.setScreen);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <BackgroundView skin={skin} variant="home" />
      <Hotspot id="background" label="Sfondo" style={{ position: 'absolute', inset: 0 }}>
        <div />
      </Hotspot>

      <Hotspot id="logo" label="Logo" style={pos(540.5, logoY, 837, 888)}>
        <LogoView skin={skin} />
      </Hotspot>

      <Hotspot id="playBtn" label="Bottone PLAY" style={pos(540, playY, 625, 216)}>
        <PlayButtonView
          skin={skin}
          onClick={() => {
            soundEngine.playEvent(skin.sounds.button);
            setScreen('game');
          }}
        />
      </Hotspot>

      {/* bottom row: sfx (175) · ranking (540) · music (906) at Y 1770 */}
      <Hotspot
        id="iconBtn"
        label="Bottoni icona"
        style={{ position: 'absolute', left: 0, top: rowY - 85, width: 1080, height: 170 }}
      >
        <div style={{ ...pos(906, 85, 170, 170) }}>
          <IconButtonView skin={skin} kind="music" size={iconSize} group="home" />
        </div>
        <div style={{ ...pos(175, 85, 170, 170) }}>
          <IconButtonView skin={skin} kind="sfx" size={iconSize} group="home" />
        </div>
        <div style={{ ...pos(540, 85, 170, 170) }}>
          <IconButtonView skin={skin} kind="ranking" size={iconSize} group="home" />
        </div>
      </Hotspot>
    </div>
  );
}
