'use client';

// EditorPanel — the right-hand panel: selected element info (original sprite,
// real pixel dimensions, drawn size), a live mini-preview and all fields.

import { useEffect, useRef } from 'react';
import { Box, MousePointerClick } from 'lucide-react';
import { ELEMENTS, elementById, type Field } from '@/lib/elements';
import { SPRITES } from '@/lib/assets-data';
import { useStudio, getPath } from '@/lib/store';
import {
  ColorField, FontField, ImageField, SelectField, SliderField, SoundEventField,
  SoundLibraryField, TextField, ToggleField, VariantGrid,
  BlockColorsField, BlockImagesField, variantThumbRender,
  BgImageField, IconVariantsField,
} from './fields';
import type { SoundEvent, SoundRef } from '@/lib/skin';
import { MaskIconView } from '@/components/game/Kit';

const SOUND_EVENT_LABELS: Record<SoundEvent, string> = {
  place: 'Piazzamento pezzo',
  clear: 'Righe completate',
  cheer: 'Complimento (2+ righe)',
  button: 'Click bottone',
  pickup: 'Prendi in mano il pezzo',
  invalid: 'Mossa non valida',
  gameOver: 'Game over',
  music: 'Musica',
};

function SpriteInfoCard({ elementId }: { elementId: string }) {
  const el = elementById(elementId);
  const focusColorIdx = useStudio((s) => s.focusColorIdx);
  if (!el?.sprite) return null;
  const info = SPRITES[el.sprite.name];
  if (!info) return null;
  const [dw, dh] = el.sprite.drawn ?? [info.w, info.h];
  const scale = ((dw / info.w) * 100).toFixed(0);
  return (
    <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-3">
      <div className="flex gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] bg-[length:16px_16px] p-1.5">
          {elementId === 'handIcon' || elementId === 'spotIcon' || elementId === 'cupIcon' || elementId === 'heartIcon' ? (
            <MaskIconView sprite={`${el.sprite.name}-f00.png`} color="#E4E4E7" size={64} />
          ) : (
             
            <img
              src={info.frames[focusColorIdx ?? 0] ?? info.frames[0]}
              alt={el.sprite.name}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
              {el.sprite.name}
            </span>
            <span className="text-zinc-500">{info.frames.length > 1 ? `${info.frames.length} frame` : '1 frame'}</span>
          </div>
          <div className="text-zinc-400">
            File originale: <span className="font-mono text-zinc-200">{info.w}×{info.h}px</span>
          </div>
          <div className="text-zinc-400">
            Disegnato a: <span className="font-mono text-zinc-200">{dw}×{dh}px</span>
            {scale !== '100' && <span className="text-zinc-500"> (×{(dw / info.w).toFixed(2)})</span>}
          </div>
          {el.sprite.frames && el.sprite.frames > 1 && (
            <div className="text-zinc-500">Frame mostrato: {focusColorIdx ?? 0}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldView({ field }: { field: Field }) {
  const skin = useStudio((s) => s.skin);
  const setIn = useStudio((s) => s.setIn);
  const focusColorIdx = useStudio((s) => s.focusColorIdx);

  const value = (path: string) => getPath(skin, path);

  switch (field.type) {
    case 'variant':
      return (
        <VariantGrid
          label={field.label}
          value={String(value(field.path))}
          variants={field.variants}
          onChange={(v) => setIn(field.path, v)}
          render={variantThumbRender(field.path.split('.')[0], skin)}
        />
      );
    case 'color':
      return (
        <ColorField
          label={field.label}
          value={String(value(field.path))}
          original={field.original}
          onChange={(hex) => setIn(field.path, hex)}
        />
      );
    case 'slider':
      return (
        <SliderField
          label={field.label}
          value={Number(value(field.path))}
          min={field.min} max={field.max} step={field.step} unit={field.unit}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'toggle':
      return (
        <ToggleField
          label={field.label}
          value={Boolean(value(field.path))}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'select':
      return (
        <SelectField
          label={field.label}
          value={String(value(field.path))}
          options={field.options}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'text':
      return (
        <TextField
          label={field.label}
          value={String(value(field.path))}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'font':
      return (
        <FontField
          label={field.label}
          value={String(value(field.path))}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'blockColors':
      return (
        <BlockColorsField
          colors={skin.blocks.colors}
          focusIdx={focusColorIdx}
          onChange={(i, hex) => setIn(`blocks.colors.${i}`, hex)}
        />
      );
    case 'blockImages':
      return (
        <BlockImagesField
          img={skin.blocks.img}
          colors={skin.blocks.colors}
          style={skin.blocks.style}
          onChangePath={(p, v) => setIn(p, v)}
        />
      );
    case 'image':
      return (
        <ImageField
          label={field.label}
          hint={field.hint}
          value={(value(field.path) as string | null | undefined) ?? null}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'bgimage':
      return (
        <BgImageField
          label={field.label}
          value={(value(field.path) as string | null | undefined) ?? null}
          onChange={(v) => setIn(field.path, v)}
        />
      );
    case 'iconVariants':
      return (
        <IconVariantsField
          variants={skin.iconBtn.variants}
          skin={skin}
          onChange={(group, v) => setIn(`iconBtn.variants.${group}`, v)}
        />
      );
    case 'soundEvents':
      return (
        <div className="space-y-2">
          {(Object.keys(SOUND_EVENT_LABELS) as SoundEvent[]).map((ev) => (
            <SoundEventField
              key={ev}
              label={SOUND_EVENT_LABELS[ev]}
              event={ev}
              ref_={skin.sounds[ev] as SoundRef}
              onChange={(r) => setIn(`sounds.${ev}`, r)}
            />
          ))}
        </div>
      );
    case 'soundLibrary':
      return <SoundLibraryField />;
    default:
      return null;
  }
}

export function EditorPanel() {
  const selected = useStudio((s) => s.selected);
  const focusColorIdx = useStudio((s) => s.focusColorIdx);
  const el = elementById(selected);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scroll to top on element switch, unless a block color was focused
    if (focusColorIdx == null) panelRef.current?.scrollTo({ top: 0 });
  }, [selected, focusColorIdx]);

  if (!el) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <MousePointerClick size={40} className="text-zinc-700" />
        <p className="text-sm font-semibold text-zinc-400">Nessun elemento selezionato</p>
        <p className="max-w-[240px] text-xs leading-relaxed text-zinc-600">
          Clicca un elemento nell&apos;anteprima o nella lista a sinistra per
          modificarlo: varianti, colori RGB, dimensioni e suoni.
        </p>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="bb-scroll h-full space-y-4 overflow-y-auto p-4">
      <div>
        <div className="flex items-center gap-2">
          <Box size={15} className="text-amber-400" />
          <h2 className="text-[15px] font-bold text-zinc-100">{el.label}</h2>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{el.description}</p>
      </div>

      <SpriteInfoCard elementId={el.id} />

      {el.fields.map((f, i) => (
        <FieldView key={`${el.id}-${i}`} field={f} />
      ))}

      {el.fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-[12px] text-zinc-500">
          Questo elemento usa gli sprite originali e i colori degli altri
          elementi (bord Board, bagliore effetti…).
        </p>
      )}
    </div>
  );
}

export { ELEMENTS };
