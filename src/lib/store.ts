'use client';

// Studio store — skin state, selection, screen routing, persistence.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultSkin, mergeSkin, presetById, type SkinState } from './skin';

export type ScreenId = 'home' | 'game' | 'popups';
export type PopupTab = 'pause' | 'gameover' | 'ranking';

/** What part of a preset gets applied on click. */
export type PresetScope = 'all' | 'blocks' | 'ui';

interface StudioState {
  skin: SkinState;
  presetId: string;
  screen: ScreenId;
  popupTab: PopupTab;
  playing: boolean;
  selected: string | null;
  focusColorIdx: number | null;
  hotspots: boolean;

  setIn: (path: string, value: unknown) => void;
  applyPreset: (id: string, scope?: PresetScope) => void;
  resetAll: () => void;
  importSkin: (json: string) => boolean;
  select: (id: string | null, colorIdx?: number | null) => void;
  setScreen: (s: ScreenId) => void;
  setPopupTab: (t: PopupTab) => void;
  setPlaying: (p: boolean) => void;
  toggleHotspots: () => void;
}

function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const root: unknown = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as object) };
  let cur = root as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    const replaced: unknown = Array.isArray(next)
      ? [...(next as unknown[])]
      : { ...(next as object) };
    cur[k] = replaced;
    cur = replaced as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return root as T;
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      skin: defaultSkin(),
      presetId: 'original',
      screen: 'home',
      popupTab: 'pause',
      playing: false,
      selected: null,
      focusColorIdx: null,
      hotspots: true,

      setIn: (path, value) => {
        set((s) => ({
          skin: setPath(s.skin, path, value) as SkinState,
          presetId: 'custom',
        }));
      },

      applyPreset: (id, scope = 'all') => {
        const p = presetById(id);
        if (!p) return;
        const next = p.build();
        set((s) => {
          if (scope === 'blocks') {
            // only the blocks (and their ghost) change, the rest of the UI stays
            return { skin: { ...s.skin, blocks: next.blocks, ghost: next.ghost }, presetId: 'custom' };
          }
          if (scope === 'ui') {
            // only the UI (background, board, texts, popups...) changes, blocks stay
            return { skin: { ...next, blocks: s.skin.blocks, ghost: s.skin.ghost }, presetId: 'custom' };
          }
          return { skin: next, presetId: id };
        });
      },

      resetAll: () => set({ skin: defaultSkin(), presetId: 'original' }),

      importSkin: (json) => {
        try {
          const parsed = JSON.parse(json) as { skin?: SkinState; presetId?: string };
          const skin = parsed.skin ?? (parsed as unknown as SkinState);
          // basic shape validation
          if (!skin || !skin.blocks || !Array.isArray(skin.blocks.colors)) return false;
          set({ skin: mergeSkin(defaultSkin(), skin), presetId: parsed.presetId ?? 'custom' });
          return true;
        } catch {
          return false;
        }
      },

      select: (id, colorIdx = null) =>
        set({ selected: id, focusColorIdx: colorIdx }),

      setScreen: (screen) => set({ screen, playing: false }),
      setPopupTab: (popupTab) => set({ popupTab }),
      setPlaying: (playing) => set({ playing }),
      toggleHotspots: () => set((s) => ({ hotspots: !s.hotspots })),
    }),
    {
      name: 'bb-skin-studio',
      partialize: (s) => ({
        skin: s.skin,
        presetId: s.presetId,
        hotspots: s.hotspots,
      }),
      // Old saved skins lack newer keys (blocks.img, board.cellImg): fill defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...p,
          skin: p.skin ? mergeSkin(defaultSkin(), p.skin) : current.skin,
        };
      },
    },
  ),
);

export function exportSkin(state: { skin: SkinState; presetId: string }): string {
  return JSON.stringify(
    { app: 'block-blast-skin-studio', version: 1, ...state },
    null,
    2,
  );
}
