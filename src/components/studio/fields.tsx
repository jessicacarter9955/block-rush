'use client';

// Editor field controls — color (hex+RGB+picker), sliders, selects, fonts,
// variant thumbnails and sound assignment with live preview.

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ImagePlus, Music, Pause, Play, RotateCcw, ScanSearch, Upload, Volume2, X } from 'lucide-react';
import { TileExtractorModal } from '@/components/studio/TileExtractorModal';
import { Switch } from '@/components/ui/switch';
import {
  hexToRgb, isValidHex, normalizeHex, rgbString, rgbToHex,
} from '@/lib/color';
import {
  FONTS, SYNTH_PRESETS, DEMO_TILE_SETS, fontCss, blockImgTile,
  ICON_PREMIUM_VARIANTS, type BlockImageState, type SkinState,
  type IconGroupVariants, type IconGroupVariant, type IconPremiumId,
} from '@/lib/skin';
import { AUDIO_FILES } from '@/lib/assets-data';
import { soundEngine } from '@/lib/audio';
import { BlockTile } from '@/components/blocks/BlockTile';
import { IconButtonView } from '@/components/game/Kit';
import { darken, lighten, withAlpha } from '@/lib/color';
import type { SoundRef, SoundEvent } from '@/lib/skin';

// ------------------------------------------------------------- primitives --

export function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-zinc-300">{label}</span>
        {hint && <span className="text-[11px] text-zinc-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function SliderField({
  label, value, min, max, step = 1, unit = '', onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <FieldRow label={label} hint={`${Math.round(value * 10) / 10}${unit}`}>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bb-range flex-1"
        />
        <input
          type="number" min={min} max={max} step={step} value={Math.round(value * 10) / 10}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded-md border border-zinc-700 bg-zinc-800/80 px-1.5 py-1 text-right text-xs text-zinc-200 tabular-nums outline-none focus:border-amber-500"
        />
      </div>
    </FieldRow>
  );
}

export function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] font-semibold text-zinc-300">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

export function SelectField({
  label, value, options, onChange,
}: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <FieldRow label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-[13px] text-zinc-200 outline-none focus:border-amber-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldRow>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FieldRow label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-[13px] text-zinc-200 outline-none focus:border-amber-500"
      />
    </FieldRow>
  );
}

// ------------------------------------------------------------------ color --

export function ColorField({
  label, value, original, onChange, swatches,
}: {
  label: string; value: string; original?: string;
  onChange: (hex: string) => void; swatches?: string[];
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  const rgb = hexToRgb(value);

  // keep the text input in sync when the value changes externally
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  const commit = (t: string) => {
    setText(t);
    if (isValidHex(t)) onChange(normalizeHex(t));
  };

  const setChannel = (ch: 'r' | 'g' | 'b', n: number) => {
    onChange(rgbToHex({ ...rgb, [ch]: n }));
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
      <div className="flex items-center gap-2">
        <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-zinc-600 shadow-inner" style={{ background: value }}>
          <input
            type="color" value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-zinc-300">{label}</span>
            {original && original.toUpperCase() !== value.toUpperCase() && (
              <button
                onClick={() => onChange(original)}
                title={`Ripristina originale ${original}`}
                className="flex shrink-0 items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-amber-400 hover:bg-zinc-700"
              >
                <RotateCcw size={10} /> {original}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => commit(e.target.value)}
              className="w-[74px] rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-200 outline-none focus:border-amber-500"
            />
            <span className="font-mono text-[11px] text-zinc-400">{rgbString(value)}</span>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(`${value} · ${rgbString(value)}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="text-zinc-500 hover:text-amber-400"
              title="Copia HEX + RGB"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:border-amber-500 hover:text-amber-400"
        >
          RGB
        </button>
      </div>

      {open && (
        <div className="mt-2.5 space-y-1.5 border-t border-zinc-800 pt-2.5">
          {(['r', 'g', 'b'] as const).map((ch) => (
            <div key={ch} className="flex items-center gap-2">
              <span className="w-3 text-[11px] font-bold uppercase" style={{ color: ch === 'r' ? '#F87171' : ch === 'g' ? '#4ADE80' : '#60A5FA' }}>
                {ch}
              </span>
              <input
                type="range" min={0} max={255} value={rgb[ch]}
                onChange={(e) => setChannel(ch, Number(e.target.value))}
                className="bb-range flex-1"
                style={{ accentColor: ch === 'r' ? '#F87171' : ch === 'g' ? '#4ADE80' : '#60A5FA' }}
              />
              <input
                type="number" min={0} max={255} value={rgb[ch]}
                onChange={(e) => setChannel(ch, Number(e.target.value))}
                className="w-14 rounded border border-zinc-700 bg-zinc-800/80 px-1 py-0.5 text-right text-[11px] tabular-nums text-zinc-200 outline-none focus:border-amber-500"
              />
            </div>
          ))}
          {swatches && swatches.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {swatches.map((s) => (
                <button
                  key={s}
                  onClick={() => onChange(s)}
                  className="h-5 w-5 rounded border border-zinc-600 hover:scale-110 transition-transform"
                  style={{ background: s }}
                  title={s}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- font --

export function FontField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FieldRow label={label} hint="anteprima live">
      <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto bb-scroll p-0.5">
        {FONTS.map((f) => (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            className={`rounded-lg border px-2 py-2 text-left transition-colors ${
              value === f.id
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
            }`}
          >
            <div className="truncate" style={{ ...fontCss(f.id, 17), color: '#F4F4F5' }}>Aa 123</div>
            <div className="mt-0.5 truncate text-[10px] text-zinc-500">{f.name} · {f.category}</div>
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

// ---------------------------------------------------------------- variant --

export function VariantGrid({
  label, value, variants, onChange, render,
}: {
  label: string; value: string;
  variants: { id: string; label: string }[];
  onChange: (v: string) => void;
  render: (id: string) => React.ReactNode;
}) {
  return (
    <FieldRow label={label} hint="clicca per applicare">
      <div className="grid grid-cols-3 gap-1.5">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            title={v.label}
            className={`group flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
              value === v.id
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
            }`}
          >
            <div className="flex h-12 w-full items-center justify-center overflow-hidden rounded">
              {render(v.id)}
            </div>
            <span className={`w-full truncate text-center text-[10px] ${value === v.id ? 'text-amber-400 font-semibold' : 'text-zinc-400'}`}>
              {v.label}
            </span>
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

// ------------------------------------------------------------------ sound --

const AUDIO_LABELS: Record<string, string> = {
  put: 'Piazzamento (put)', return: 'Ritorno pezzo', whoosh: 'Prendi pezzo',
  no_space: 'Niente spazio', lose: 'Sconfitta', revive: 'Rianima', beep: 'Beep',
  music: 'Musica di sottofondo', score: 'Punti (base)',
};

function audioLabel(f: string): string {
  if (AUDIO_LABELS[f]) return AUDIO_LABELS[f];
  if (f.startsWith('score/s')) return `Punti combo ${f.slice(8)}`;
  if (f.startsWith('cheerful/c')) return `Complimento ${f.slice(11)}`;
  return f;
}

export function SoundEventField({
  label, event, ref_: soundRef, onChange,
}: {
  label: string; event: SoundEvent; ref_: SoundRef;
  onChange: (r: SoundRef) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const progression = event === 'clear' || event === 'cheer';

  const test = () => {
    setPlaying(true);
    setTimeout(() => setPlaying(false), 700);
    if (event === 'clear') soundEngine.playClear(soundRef, 2);
    else if (event === 'cheer') soundEngine.playCheer(soundRef, 3);
    else if (event === 'music') void soundEngine.playFile(soundRef.src || 'music', { pitch: soundRef.pitch, vol: soundRef.vol });
    else soundEngine.playEvent(soundRef);
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300">
          {event === 'music' ? <Music size={13} className="text-amber-400" /> : <Volume2 size={13} className="text-amber-400" />}
          {label}
        </span>
        <button
          onClick={test}
          className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:border-amber-500 hover:text-amber-400"
        >
          {playing ? <Pause size={11} /> : <Play size={11} />} Prova
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={soundRef.kind}
          onChange={(e) => {
            const kind = e.target.value as SoundRef['kind'];
            if (kind === 'original') onChange({ kind, src: '', vol: soundRef.vol, pitch: soundRef.pitch });
            else if (kind === 'synth') onChange({ kind, src: 'blip', vol: soundRef.vol, pitch: soundRef.pitch });
            else onChange({ kind, src: defaultFile(event), vol: soundRef.vol, pitch: soundRef.pitch });
          }}
          className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500"
        >
          {progression && <option value="original">Originale (progressione)</option>}
          <option value="file">File audio</option>
          <option value="synth">Sintetizzato</option>
        </select>

        {soundRef.kind === 'file' && (
          <select
            value={soundRef.src}
            onChange={(e) => onChange({ ...soundRef, src: e.target.value })}
            className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500"
          >
            {AUDIO_FILES.map((f) => (
              <option key={f} value={f}>{audioLabel(f)}</option>
            ))}
          </select>
        )}
        {soundRef.kind === 'synth' && (
          <select
            value={soundRef.src}
            onChange={(e) => onChange({ ...soundRef, src: e.target.value })}
            className="rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500"
          >
            {SYNTH_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {soundRef.kind === 'original' && (
          <div className="flex items-center px-1 text-[11px] text-zinc-500">
            {event === 'clear' ? 's1 → s15 con la combo' : 'c2 → c6 per righe'}
          </div>
        )}
      </div>

      {soundRef.kind !== 'original' && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-8 text-[10px] text-zinc-500">Pitch</span>
            <input
              type="range" min={0.5} max={2} step={0.05} value={soundRef.pitch}
              onChange={(e) => onChange({ ...soundRef, pitch: Number(e.target.value) })}
              className="bb-range flex-1"
            />
            <span className="w-8 text-right text-[10px] tabular-nums text-zinc-400">{soundRef.pitch.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-8 text-[10px] text-zinc-500">Vol</span>
            <input
              type="range" min={0} max={1.5} step={0.05} value={soundRef.vol}
              onChange={(e) => onChange({ ...soundRef, vol: Number(e.target.value) })}
              className="bb-range flex-1"
            />
            <span className="w-8 text-right text-[10px] tabular-nums text-zinc-400">{soundRef.vol.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultFile(event: SoundEvent): string {
  switch (event) {
    case 'place': return 'put';
    case 'button': return 'beep';
    case 'pickup': return 'whoosh';
    case 'invalid': return 'return';
    case 'gameOver': return 'lose';
    case 'music': return 'music';
    default: return 'put';
  }
}

export function SoundLibraryField() {
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const out: Record<string, number> = {};
      for (const f of AUDIO_FILES) {
        out[f] = await soundEngine.durationOf(f);
        if (!mounted.current) return;
      }
      if (mounted.current) setDurations(out);
    })();
    return () => { mounted.current = false; };
  }, []);

  return (
    <FieldRow label={`Libreria suoni originali (${AUDIO_FILES.length} file)`} hint="clicca per ascoltare">
      <div className="max-h-72 space-y-1 overflow-y-auto bb-scroll rounded-lg border border-zinc-800 bg-zinc-900/60 p-1.5">
        {AUDIO_FILES.map((f) => (
          <button
            key={f}
            onClick={() => {
              setCurrent(f);
              void soundEngine.playFile(f);
              setTimeout(() => setCurrent(null), 900);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800"
          >
            {current === f
              ? <Pause size={12} className="shrink-0 text-amber-400" />
              : <Play size={12} className="shrink-0 text-zinc-500" />}
            <span className="flex-1 truncate text-[12px] text-zinc-300">{audioLabel(f)}</span>
            <span className="font-mono text-[10px] text-zinc-600">{f}</span>
            <span className="w-10 text-right font-mono text-[10px] tabular-nums text-zinc-500">
              {durations[f] ? `${durations[f].toFixed(1)}s` : '–'}
            </span>
          </button>
        ))}
      </div>
    </FieldRow>
  );
}

// ---------------------------------------------------------- block colors --

export const BLOCK_SWATCHES = [
  '#8D5FD7', '#36B2E1', '#3BB43B', '#4864E7', '#EDB632', '#ED7821', '#C93131', '#D35FD7',
  '#FF3C8A', '#00E5FF', '#39FF14', '#FF6B6B', '#4CC9F0', '#95E06C', '#F5AFC0', '#2EC4B6',
];

export function BlockColorsField({
  colors, focusIdx, onChange,
}: {
  colors: string[]; focusIdx: number | null; onChange: (idx: number, hex: string) => void;
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (focusIdx != null && refs.current[focusIdx]) {
      refs.current[focusIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusIdx]);

  return (
    <div className="space-y-1.5">
      {colors.map((c, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          style={focusIdx === i ? { borderRadius: 12, outline: '3px solid #F59E0B', outlineOffset: 2 } : undefined}
        >
          <ColorField
            label={`Colore ${i + 1} · ${['Lavanda', 'Ciano', 'Verde', 'Blu', 'Giallo', 'Arancione', 'Rosso', 'Rosa'][i]}`}
            value={c}
            original={['#8D5FD7', '#36B2E1', '#3BB43B', '#4864E7', '#EDB632', '#ED7821', '#C93131', '#D35FD7'][i]}
            swatches={BLOCK_SWATCHES}
            onChange={(hex) => onChange(i, hex)}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- image --

/** Load a file, normalize it to a square 256×256 PNG data URL (keeps alpha). */
function fileToSquareTile(file: File, done: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const canvas = document.createElement('canvas');
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const side = Math.min(img.width, img.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // center-crop to square, then resample to 256×256
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      done(canvas.toDataURL('image/png'));
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

const CHECKER = 'repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%)';

function ImageSlot({
  value, onPick, onClear, size = 56, rounded = 'rounded-lg', ratio = 1,
}: {
  value: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  size?: number;
  rounded?: string;
  /** width / height — 1 = square, 9/16 = phone background */
  ratio?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith('image/')) onPick(f);
      }}
      className={`relative shrink-0 ${rounded} border ${over ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 bg-zinc-900/60'}`}
      style={{ width: size, height: Math.round(size / ratio), background: value ? undefined : CHECKER, backgroundSize: value ? undefined : '12px 12px' }}
      title={value ? 'Clicca per sostituire · trascina un PNG' : 'Clicca o trascina un\'immagine PNG'}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 flex items-center justify-center"
      >
        {value ? (
          <img src={value} alt="tessera" className="h-full w-full object-contain" draggable={false} />
        ) : (
          <ImagePlus size={size >= 48 ? 18 : 14} className="text-zinc-500" />
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-zinc-400 hover:text-red-400"
          title="Rimuovi"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

export function ImageField({
  label, value, hint, onChange,
}: {
  label: string; value: string | null; hint?: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <FieldRow label={label} hint={hint ?? 'PNG · viene ridotta a 256×256'}>
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
        <ImageSlot
          value={value}
          onPick={(f) => fileToSquareTile(f, onChange)}
          onClear={() => onChange(null)}
          size={72}
        />
        <div className="min-w-0 flex-1 space-y-1 text-[11px] leading-relaxed text-zinc-500">
          <p className="flex items-center gap-1.5 text-zinc-400">
            <Upload size={11} /> Trascina qui un&apos;immagine o clicca il riquadro
          </p>
          <p>Una sola tessera quadrata = un blocchetto. Il gioco la replica su ogni cella di ogni posizione.</p>
          {value && <p className="font-mono text-[10px] text-zinc-600">{value.startsWith('data:') ? 'PNG 256×256 (incorporata)' : value}</p>}
        </div>
      </div>
    </FieldRow>
  );
}

/** Load a background file: cap at 1080×1920 keeping aspect; JPEG if opaque. */
function fileToBgImage(file: File, done: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAXW = 1080, MAXH = 1920;
      const k = Math.min(1, MAXW / img.width, MAXH / img.height);
      const w = Math.max(1, Math.round(img.width * k));
      const h = Math.max(1, Math.round(img.height * k));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      // alpha detection on a sparse sample
      let hasAlpha = false;
      try {
        const data = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3; i < data.length; i += 4 * 97) {
          if (data[i] < 250) { hasAlpha = true; break; }
        }
      } catch { /* tainted canvas — assume opaque */ }
      done(hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88));
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

export function BgImageField({
  label, value, onChange,
}: {
  label: string; value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <FieldRow label={label} hint="Consigliato 1080×1920 (9:16) · JPG/PNG">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
        <ImageSlot
          value={value}
          onPick={(f) => fileToBgImage(f, onChange)}
          onClear={() => onChange(null)}
          size={64}
          ratio={9 / 16}
        />
        <div className="min-w-0 flex-1 space-y-1 text-[11px] leading-relaxed text-zinc-500">
          <p className="flex items-center gap-1.5 text-zinc-400">
            <Upload size={11} /> Sfondo a tutto schermo (sostituisce lo stile)
          </p>
          <p>Viene ridotta a massimo 1080×1920. Con «Adattamento» scegli come riempire lo schermo, con «Scurisci» abbassi la luminosità.</p>
          {value && <p className="font-mono text-[10px] text-zinc-600">{value.startsWith('data:') ? 'immagine incorporata' : value}</p>}
        </div>
      </div>
    </FieldRow>
  );
}

export function IconVariantsField({
  variants, onChange, skin,
}: {
  variants: IconGroupVariants;
  onChange: (group: keyof IconGroupVariants, v: IconGroupVariant) => void;
  skin: SkinState;
}) {
  const groups: { id: keyof IconGroupVariants; label: string; hint: string; kind: Parameters<typeof IconButtonView>[0]['kind']; wide: boolean }[] = [
    { id: 'home', label: 'Home', hint: 'i 3 bottoni in basso nella home', kind: 'music', wide: false },
    { id: 'game', label: 'In gioco', hint: 'pausa, home, reset, chiudi…', kind: 'pause', wide: false },
    { id: 'settings', label: 'Impostazioni', hint: 'toggle musica / effetti', kind: 'music', wide: true },
  ];
  return (
    <FieldRow label="Varianti premium" hint="Materiali 3D lucidi, ispirati al gioco di riferimento">
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <span className="text-[11px] font-bold text-zinc-300">{g.label}</span>
              <span className="text-[10px] text-zinc-600">{g.hint}</span>
            </div>
            <div className="flex flex-wrap items-end gap-1.5">
              <button
                type="button"
                onClick={() => onChange(g.id, 'base')}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                  variants?.[g.id] === 'base' || !variants?.[g.id]
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                }`}
                title="Stile classico qui sopra"
              >
                <div style={{ width: g.wide ? 88 : 44, height: 42 }} className="flex items-center justify-center">
                  <IconButtonView skin={skin} kind={g.kind} size={40} variant={g.wide ? 'wide' : 'round'} group={g.id} forceVariant={undefined} />
                </div>
                <span className="text-[9px] font-semibold text-zinc-400">Base</span>
              </button>
              {ICON_PREMIUM_VARIANTS.map((v: { id: IconPremiumId; label: string }) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange(g.id, v.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
                    variants?.[g.id] === v.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                  }`}
                  title={v.label}
                >
                  <div style={{ width: g.wide ? 88 : 44, height: 42 }} className="flex items-center justify-center">
                    <IconButtonView skin={skin} kind={g.kind} size={40} variant={g.wide ? 'wide' : 'round'} forceVariant={v.id} />
                  </div>
                  <span className="text-[9px] font-semibold text-zinc-400">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </FieldRow>
  );
}

export function BlockImagesField({
  img, colors, style, onChangePath,
}: {
  img: BlockImageState;
  colors: string[];
  style: string;
  onChangePath: (path: string, value: unknown) => void;
}) {
  const set = (patch: Partial<BlockImageState>) => onChangePath('blocks.img', { ...img, ...patch });
  const [extractorOpen, setExtractorOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-zinc-200">Tessere immagine</span>
        {style !== 'image' && (
          <button
            onClick={() => onChangePath('blocks.style', 'image')}
            className="rounded-md border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/20"
          >
            Attiva stile Immagine
          </button>
        )}
      </div>

      <SelectField
        label="Modalità"
        value={img.mode}
        options={[
          { value: 'single', label: 'Unica tessera (tutti i colori)' },
          { value: 'perColor', label: 'Una tessera per colore/gusto (8)' },
        ]}
        onChange={(v) => set({ mode: v as BlockImageState['mode'] })}
      />

      {/* extract real tiles from a screenshot */}
      <button
        onClick={() => setExtractorOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-[12px] font-bold text-cyan-300 transition-colors hover:bg-cyan-500/20"
      >
        <ScanSearch size={14} /> Estrai quadratini da screenshot
      </button>
      <TileExtractorModal
        open={extractorOpen}
        onClose={() => setExtractorOpen(false)}
        onApply={(tiles, hexes) => {
          onChangePath('blocks.style', 'image');
          onChangePath('blocks.img', {
            ...img,
            mode: 'perColor',
            perColor: tiles,
            tint: false,
          });
          onChangePath('blocks.colors', hexes);
        }}
      />

      {/* demo tile sets — fill all 8 slots with a bundled AI set */}
      {img.mode === 'perColor' && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Set demo</span>
          {DEMO_TILE_SETS.map((s) => {
            const active =
              s.tiles.length === img.perColor?.length &&
              s.tiles.every((t, i) => img.perColor?.[i] === t);
            return (
              <button
                key={s.id}
                title={s.desc}
                onClick={() => set({ perColor: [...s.tiles] })}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-amber-500/70 bg-amber-500/15 text-amber-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <span className="flex h-4 w-12 overflow-hidden rounded-[3px]">
                  {s.tiles.slice(0, 3).map((t) => (
                    <img key={t} src={t} alt="" className="h-full w-1/3 object-cover" draggable={false} />
                  ))}
                </span>
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {img.mode === 'single' ? (
        <ImageSlot
          value={img.single}
          onPick={(f) => fileToSquareTile(f, (d) => set({ single: d }))}
          onClear={() => set({ single: null })}
          size={72}
          rounded="rounded-xl"
        />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {colors.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <ImageSlot
                value={img.perColor?.[i] ?? null}
                onPick={(f) => fileToSquareTile(f, (d) => {
                  const pc = [...(img.perColor ?? Array(8).fill(null))];
                  pc[i] = d;
                  set({ perColor: pc });
                })}
                onClear={() => {
                  const pc = [...(img.perColor ?? Array(8).fill(null))];
                  pc[i] = null;
                  set({ perColor: pc });
                }}
                size={54}
                rounded="rounded-md"
              />
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm border border-zinc-600" style={{ background: c }} />
                <span className="text-[9px] text-zinc-500">{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {img.mode === 'perColor' && (
        <p className="text-[10px] leading-relaxed text-zinc-600">
          Slot vuoto = tratteggiato con il colore RGB di quel gusto (o usa la modalità tinta sotto con la tessera unica).
        </p>
      )}

      <ToggleField
        label="Tinta col colore RGB (multiply)"
        value={img.tint}
        onChange={(v) => set({ tint: v })}
      />
      <SelectField
        label="Adattamento"
        value={img.fit}
        options={[
          { value: 'fill', label: 'Riempi la cella (consigliato)' },
          { value: 'contain', label: 'Contieni (mantiene margini)' },
        ]}
        onChange={(v) => set({ fit: v as BlockImageState['fit'] })}
      />
      <SliderField
        label="Ombra sotto il blocchetto"
        value={img.shadow}
        min={0} max={100} unit="%"
        onChange={(v) => set({ shadow: v })}
      />

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2 text-[10px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-zinc-400">Come fare la tessera:</span>{' '}
        PNG quadrata con UN solo blocchetto (es. 256×256), luce da sopra-sinistra, senza ombra esterna
        (la aggiunge l&apos;editor). Angoli trasparenti per cioccolatini staccati, oppure a tutto campo
        (senza trasparenza) per l&apos;effetto barretta continua — poi regola "Angoli arrotondati".
      </div>
    </div>
  );
}

// ------------------------------------------------------- variant thumbs ---

export function variantThumbRender(elementId: string, skin: SkinState): (id: string) => React.ReactNode {
  return (id: string) => {
    switch (elementId) {
      case 'blocks': {
        const tile = blockImgTile(skin, 4);
        if (id === 'image' && !tile) {
          return (
            <div className="flex h-10 w-full items-center justify-center rounded border-2 border-dashed border-zinc-600 bg-zinc-900/60">
              <ImagePlus size={16} className="text-zinc-500" />
            </div>
          );
        }
        return (
          <BlockTile colorIdx={4} color={skin.blocks.colors[4]} style={id as never} size={40}
            radius={skin.blocks.radius} gap={2} border={2}
            imgSrc={tile} imgTint={skin.blocks.img?.tint} imgFit={skin.blocks.img?.fit}
            imgShadow={id === 'image' ? skin.blocks.img?.shadow : undefined} />
        );
      }
      case 'ghost':
        return (
          <BlockTile colorIdx={2} color={skin.blocks.colors[2]} style={skin.blocks.style} size={40}
            ghost={id as never} ghostOpacity={skin.ghost.opacity}
            imgSrc={blockImgTile(skin, 2)} imgTint={skin.blocks.img?.tint} imgFit={skin.blocks.img?.fit} imgShadow={0} />
        );
      case 'background': {
        const c1 = skin.background.c1, c2 = skin.background.c2;
        if (id === 'original') {
          // Non-shorthand only: never mix `background` with `backgroundSize`.
          return <div className="h-10 w-full rounded" style={{ backgroundImage: 'url(/sprites/Bg-f00.png)', backgroundSize: '400% 100%' }} />;
        }
        const map: Record<string, string> = {
          solid: c1,
          gradient: `linear-gradient(180deg, ${c1}, ${c2})`,
          radial: `radial-gradient(80% 70% at 50% 30%, ${c1}, ${c2})`,
          night: `linear-gradient(160deg, ${darken(c1, 0.25)}, ${darken(c2, 0.15)})`,
        };
        const v = map[id] ?? c1;
        const style = v.startsWith('#') ? { backgroundColor: v } : { backgroundImage: v };
        return <div className="h-10 w-full rounded" style={style} />;
      }
      case 'board': {
        if (id === 'original') return <div className="h-10 w-full rounded" style={{ backgroundImage: 'url(/sprites/Board-f00.png)', backgroundSize: 'cover' }} />;
        const b = skin.board;
        const map: Record<string, React.CSSProperties> = {
          dark: { background: b.frameColor, borderRadius: 8, border: `1px solid ${withAlpha('#000', 0.5)}` },
          glass: { background: withAlpha(b.frameColor, 0.5), borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)' },
          neon: { background: darken(b.cellColor, 0.2), borderRadius: 8, border: `2px solid ${b.lineColor}`, boxShadow: `0 0 10px ${withAlpha(b.lineColor, 0.7)}` },
          outline: { borderRadius: 4, border: `2px solid ${b.lineColor}`, background: withAlpha(b.frameColor, 0.3) },
          gold: {
            borderRadius: 8,
            backgroundImage: `linear-gradient(135deg, ${lighten(b.frameColor, 0.42)}, ${b.frameColor} 40%, ${darken(b.frameColor, 0.26)})`,
            border: `1px solid ${darken(b.frameColor, 0.38)}`,
          },
        };
        return <div className="h-10 w-full" style={map[id]} />;
      }
      case 'tray': {
        if (id === 'none') return <span className="text-[10px] text-zinc-600">nessuno</span>;
        if (id === 'original') return <div className="h-10 w-full rounded-lg" style={{ backgroundImage: 'url(/sprites/PlaceHolder-f00.png)', backgroundSize: 'cover' }} />;
        const t = skin.tray;
        const map: Record<string, React.CSSProperties> = {
          glass: { background: withAlpha(t.color, t.opacity / 100), borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)' },
          dark: { background: withAlpha(t.color, t.opacity / 100), borderRadius: 10 },
        };
        return <div className="h-10 w-full" style={map[id]} />;
      }
      case 'playBtn': {
        if (id === 'original') return <div className="h-9 w-[76px]" style={{ backgroundImage: 'url(/sprites/BtnPlay-f00.png)', backgroundSize: '100% 100%' }} />;
        const p = skin.playBtn;
        const map: Record<string, React.CSSProperties> = {
          pill: { borderRadius: 999, background: `linear-gradient(180deg, ${lighten(p.c1, 0.15)}, ${p.c2})`, border: '2px solid rgba(255,255,255,0.4)' },
          rounded: { borderRadius: 14, background: `linear-gradient(165deg, ${p.c1}, ${p.c2})` },
          neon: { borderRadius: 999, background: darken(p.c1, 0.8), border: `2px solid ${p.c1}`, boxShadow: `0 0 8px ${withAlpha(p.c1, 0.8)}` },
          pixel: { borderRadius: 2, background: p.c1, border: `3px solid ${darken(p.c1, 0.35)}`, boxShadow: `0 3px 0 ${darken(p.c1, 0.45)}` },
        };
        return (
          <div className="flex h-9 w-[76px] items-center justify-center" style={map[id]}>
            <span style={{ ...fontCss(id === 'pixel' ? 'press' : 'riffic', 11), color: p.textColor, textTransform: 'uppercase', lineHeight: 1 }}>PLAY</span>
          </div>
        );
      }
      case 'iconBtn': {
        if (id === 'original') return <div className="h-10 w-10" style={{ backgroundImage: 'url(/sprites/BtnMusic2-f00.png)', backgroundSize: '100% 100%' }} />;
        const st = skin.iconBtn;
        const map: Record<string, React.CSSProperties> = {
          circle: { borderRadius: '50%', background: st.bg, border: '1px solid rgba(255,255,255,0.22)' },
          rounded: { borderRadius: 10, background: st.bg, border: '1px solid rgba(255,255,255,0.22)' },
          pixel: { borderRadius: 2, background: st.bg, border: `2px solid ${darken(st.bg, 0.45)}`, boxShadow: `0 2px 0 ${darken(st.bg, 0.5)}` },
          outline: { borderRadius: '50%', border: `2px solid ${st.iconColor}` },
        };
        return <div className="flex h-10 w-10 items-center justify-center" style={map[id]}><Music size={16} color={st.iconColor} /></div>;
      }
      case 'popup': {
        if (id === 'original') return <div className="h-10 w-12 rounded" style={{ backgroundImage: 'url(/sprites/PausePopup-f00.png)', backgroundSize: 'cover' }} />;
        const p = skin.popup;
        const map: Record<string, React.CSSProperties> = {
          dark: { background: 'rgba(20,22,40,0.95)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' },
          light: { background: 'linear-gradient(180deg,#FFFFFF,#EEF1FA)', borderRadius: 8, border: `2px solid ${withAlpha(p.c1, 0.4)}` },
          neon: { background: 'rgba(8,10,24,0.95)', borderRadius: 8, border: `2px solid ${p.c1}`, boxShadow: `0 0 8px ${withAlpha(p.c1, 0.6)}` },
        };
        return <div className="h-10 w-12" style={map[id]} />;
      }
      case 'logo':
        if (id === 'original') return <div className="h-11 w-11" style={{ backgroundImage: 'url(/sprites/Sprite2-f00.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />;
        return <span style={{ ...fontCss(skin.logo.font, 15), color: skin.logo.c1, lineHeight: 1 }}>BB</span>;
      case 'score':
        if (id === 'bitmap') return <BitmapThumb sheet="txtScore" text="42" />;
        return <span style={{ ...fontCss(skin.score.font, 18), color: skin.score.color, lineHeight: 1 }}>42</span>;
      case 'plus100':
        if (id === 'bitmap') return <BitmapThumb sheet="txtEarnedScore" text="+42" />;
        return (
          <span
            style={{
              ...fontCss(id === 'pixel' ? 'press' : 'riffic', id === 'pixel' ? 10 : 15),
              color: skin.plus100.color, lineHeight: 1,
              textShadow: `0 0 8px ${withAlpha(skin.plus100.glow, 0.9)}`,
            }}
          >+42</span>
        );
      default:
        return null;
    }
  };
}

function BitmapThumb({ sheet, text }: { sheet: 'txtScore' | 'txtEarnedScore'; text: string }) {
  const S = sheet === 'txtScore'
    ? { url: '/sprites/txtScore-f00.png', w: 1024, pitch: 92.13, cols: 10, charset: '0123456789' }
    : { url: '/sprites/txtEarnedScore-fixed.png', w: 512, pitch: 46.545, cols: 11, charset: '0123456789+' };
  return (
    <div className="flex">
      {[...text].map((ch, i) => {
        const idx = S.charset.indexOf(ch);
        if (idx < 0) return null;
        return (
          <div
            key={i}
            style={{
              width: S.pitch * 0.32, height: 100 * 0.32,
              backgroundImage: `url(${S.url})`,
              backgroundSize: `${S.w * 0.32}px 128px`,
              backgroundPosition: `-${idx * S.pitch * 0.32}px -11px`,
            }}
          />
        );
      })}
    </div>
  );
}
