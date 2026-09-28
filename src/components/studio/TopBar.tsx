'use client';

// TopBar — preset picker, screen tabs, play toggle, export/import/reset,
// music toggle and hotspot switch.

import { useRef, useState } from 'react';
import {
  Download, Gamepad2, Music, Upload, Eye, EyeOff, RotateCcw, Palette, Layers, ImagePlus,
} from 'lucide-react';
import { PRESETS } from '@/lib/skin';
import { exportSkin, useStudio, type PresetScope } from '@/lib/store';
import { soundEngine } from '@/lib/audio';
import { toast } from '@/hooks/use-toast';

export function TopBar() {
  const skin = useStudio((s) => s.skin);
  const presetId = useStudio((s) => s.presetId);
  const applyPreset = useStudio((s) => s.applyPreset);
  const resetAll = useStudio((s) => s.resetAll);
  const importSkin = useStudio((s) => s.importSkin);
  const screen = useStudio((s) => s.screen);
  const setScreen = useStudio((s) => s.setScreen);
  const playing = useStudio((s) => s.playing);
  const setPlaying = useStudio((s) => s.setPlaying);
  const hotspots = useStudio((s) => s.hotspots);
  const toggleHotspots = useStudio((s) => s.toggleHotspots);
  const fileRef = useRef<HTMLInputElement>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [scope, setScope] = useState<PresetScope>('all');

  const scopeLabel: Record<PresetScope, string> = {
    all: 'Tutto',
    blocks: 'Solo blocchi',
    ui: 'Solo UI',
  };

  const applyWithScope = (id: string, name: string) => {
    applyPreset(id, scope);
    soundEngine.playEvent(skin.sounds.button);
    toast({
      title: `Preset "${name}" applicato`,
      description:
        scope === 'blocks' ? 'Solo i BLOCCHI — UI (sfondo, punteggio, popup…) invariata'
        : scope === 'ui' ? 'Solo la UI — i blocchi restano quelli attuali'
        : undefined,
    });
  };

  const doExport = () => {
    const blob = new Blob([exportSkin({ skin, presetId })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'block-blast-skin.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Skin esportata', description: 'block-blast-skin.json scaricato' });
  };

  const doImport = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importSkin(String(reader.result));
      if (ok) toast({ title: 'Skin importata!' });
      else toast({ title: 'Errore', description: 'File skin non valido' });
    };
    reader.readAsText(f);
  };

  const toggleMusic = () => {
    if (musicOn) {
      soundEngine.stopMusic();
      setMusicOn(false);
    } else {
      soundEngine.setVolumes(skin.sounds.sfxVol, skin.sounds.musicVol);
      void soundEngine.startMusic(skin.sounds.music);
      setMusicOn(true);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
          <Palette size={16} className="text-zinc-950" />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-black tracking-tight text-zinc-100">
            Block Blast <span className="text-amber-400">Skin Studio</span>
          </div>
          <div className="text-[10px] text-zinc-500">editor UI completo · web</div>
        </div>
      </div>

      {/* presets + application scope */}
      <div className="bb-scroll ml-2 flex max-w-[46vw] items-center gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        <button
          title={
            scope === 'all'
              ? 'Ogni preset sostituisce TUTTO (blocchi + UI)'
              : scope === 'blocks'
                ? 'Ogni preset applica SOLO i blocchi (stile, colori, immagini). UI invariata — così puoi mescolare es. cioccolatini + UI Neon'
                : 'Ogni preset applica SOLO la UI (sfondo, punteggio, logo, popup…). I blocchi restano quelli scelti'
          }
          onClick={() => {
            const order: PresetScope[] = ['all', 'blocks', 'ui'];
            setScope(order[(order.indexOf(scope) + 1) % order.length]);
          }}
          className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
            scope === 'all'
              ? 'text-zinc-500 hover:text-zinc-300'
              : 'bg-amber-500 text-zinc-950'
          }`}
        >
          <Layers size={13} />
          <span className="hidden 2xl:inline">{scopeLabel[scope]}</span>
        </button>
        <span className="h-5 w-px shrink-0 bg-zinc-800" />
        {PRESETS.map((p) => (
          <span key={`wrap-${p.id}`} className="flex shrink-0 items-center gap-1">
            {p.id === 'candy-rosso' && (
              <span className="h-5 w-px bg-zinc-800" title="Famiglia Caramella: la replica del gioco di riferimento in 11 colori" />
            )}
            <button
              key={p.id}
              title={p.desc}
              onClick={() => applyWithScope(p.id, p.name)}
              className={`group relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                presetId === p.id
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <span className="flex h-3.5 w-3.5 overflow-hidden rounded-full border border-black/30">
                {p.swatch.map((c) => (
                  <span key={c} className="h-full w-full" style={{ background: c }} />
                ))}
              </span>
              <span className="hidden xl:inline">{p.name}</span>
            </button>
          </span>
        ))}
      </div>

      <div className="flex-1" />

      {/* screen tabs */}
      <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        {(['home', 'game', 'popups'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScreen(s)}
            disabled={playing}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-40 ${
              screen === s && !playing
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s === 'home' ? 'HOME' : s === 'game' ? 'GIOCO' : 'POPUP'}
          </button>
        ))}
      </div>

      {/* play */}
      <button
        onClick={() => {
          soundEngine.playEvent(skin.sounds.button);
          setPlaying(!playing);
        }}
        className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-black transition-all ${
          playing
            ? 'bg-red-500/90 text-white hover:bg-red-500'
            : 'bg-gradient-to-b from-amber-400 to-orange-500 text-zinc-950 shadow-lg shadow-amber-500/25 hover:brightness-110'
        }`}
      >
        <Gamepad2 size={15} />
        {playing ? 'ESCI' : 'GIOCA'}
      </button>

      {/* tools */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleHotspots}
          title={hotspots ? 'Nascondi hotspot (elementi cliccabili)' : 'Mostra hotspot'}
          className={`rounded-lg border p-2 transition-colors ${
            hotspots
              ? 'border-amber-500/50 text-amber-400'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {hotspots ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          onClick={toggleMusic}
          title={musicOn ? 'Ferma musica' : 'Ascolta la musica con la skin corrente'}
          className={`rounded-lg border p-2 transition-colors ${
            musicOn
              ? 'border-amber-500/50 text-amber-400'
              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Music size={15} />
        </button>
        <a href="/uploader" target="_blank" rel="noreferrer" title="Uploader riferimenti 1:1 — carica i tuoi screenshot e li trasformo in preset pixel perfect" className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:text-amber-400">
          <ImagePlus size={15} />
        </a>
        <button onClick={doExport} title="Esporta skin (JSON)" className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:text-amber-400">
          <Download size={15} />
        </button>
        <button onClick={() => fileRef.current?.click()} title="Importa skin (JSON)" className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:text-amber-400">
          <Upload size={15} />
        </button>
        <button
          onClick={() => {
            resetAll();
            toast({ title: 'Skin ripristinata all\'originale' });
          }}
          title="Reset totale"
          className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:text-red-400"
        >
          <RotateCcw size={15} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}
