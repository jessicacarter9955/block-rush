'use client';

// PhonePreview — 9:16 device frame that scales the 1080×1920 design space
// to the available area, routes between screens and hosts the playable game.

import { useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { ScreenHome } from './ScreenHome';
import { ScreenGame } from './ScreenGame';
import { ScreenPopups } from './ScreenPopups';
import { PlayGame } from '@/components/game/PlayGame';

export function PhonePreview() {
  const screen = useStudio((s) => s.screen);
  const popupTab = useStudio((s) => s.popupTab);
  const setPopupTab = useStudio((s) => s.setPopupTab);
  const playing = useStudio((s) => s.playing);
  const selected = useStudio((s) => s.selected);
  const hotspots = useStudio((s) => s.hotspots);

  const areaRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setScale(Math.min(width / 1080, height / 1920));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3">
      <div ref={areaRef} className="flex min-h-0 flex-1 items-center justify-center p-2">
        {/* device */}
        <div
          className="relative overflow-hidden rounded-[2.2rem] bg-black shadow-2xl ring-8 ring-zinc-800/90"
          style={{ width: 1080 * scale, height: 1920 * scale }}
        >
          {/* notch */}
          <div
            className="absolute left-1/2 top-0 z-[100] -translate-x-1/2 rounded-b-2xl bg-black"
            style={{ width: 280 * scale, height: 44 * scale }}
          />
          {/* 1080×1920 design space */}
          <div
            ref={designRef}
            style={{
              width: 1080, height: 1920,
              transform: `scale(${scale})`, transformOrigin: 'top left',
              position: 'absolute', top: 0, left: 0,
              background: '#101528',
            }}
          >
            {playing ? (
              <PlayGame areaRef={designRef} />
            ) : screen === 'home' ? (
              <ScreenHome />
            ) : screen === 'game' ? (
              <ScreenGame />
            ) : (
              <ScreenPopups />
            )}
          </div>
        </div>
      </div>

      {/* under-phone controls */}
      <div className="flex h-8 shrink-0 items-center gap-2">
        {!playing && screen === 'popups' && (
          <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
            {([['pause', 'PAUSA'], ['gameover', 'GAME OVER'], ['ranking', 'CLASSIFICA']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPopupTab(id)}
                className={`rounded-lg px-3 py-1 text-[11px] font-bold transition-colors ${
                  popupTab === id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!playing && hotspots && (
          <span className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-500">
            <Hand size={11} className="text-amber-400/80" />
            {selected
              ? 'elemento selezionato — modifica tutto nel pannello a destra'
              : 'clicca un elemento del telefono per modificarlo'}
          </span>
        )}
      </div>
    </div>
  );
}
