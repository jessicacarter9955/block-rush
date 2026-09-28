'use client';

// Layout system — editable positions/sizes/texts for every UI element,
// multiple named layouts saved in localStorage and applied live to BOTH the
// studio preview screens and the playable game.
//
// Coordinates: 1080×1920 design space, CENTER-based rects {x, y, w, h}.
// Elements with a `parent` are positioned relative to the parent's box
// (same coordinate system the DOM uses inside the parent container).

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Rect {
  /** center X (design units) */
  x: number;
  /** center Y (design units) */
  y: number;
  w: number;
  h: number;
}

export interface LayoutOverride {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** static text override (labels like GAME OVER / SCORE…) */
  text?: string;
  /** hide the element (in edit mode it stays selectable, dimmed) */
  visible?: boolean;
}

export type LayoutState = Record<string, LayoutOverride>;

export type LayoutScreen = 'home' | 'game' | 'popups';

export interface LayoutElDef {
  key: string;
  label: string;
  screen: LayoutScreen;
  /** original geometry (center-based; parent-relative when `parent` is set) */
  def: Rect;
  /** parent element key — coords are relative to the parent's top-left */
  parent?: string;
  movable?: boolean;
  resizable?: boolean;
  /** keep w/h locked to the original ratio */
  lockRatio?: number;
  /** keep w === h */
  lockSquare?: boolean;
  minW?: number;
  minH?: number;
  /** static default text (editable → stored in the layout override) */
  text?: string;
  /** text stored in the SKIN store (logo.text / playBtn.text) */
  skinTextPath?: string;
  /** dynamic number rendered with the original BITMAP sprite font (double-click
   *  shows a hint card offering the switch to a real CSS font). Path in the
   *  skin store, e.g. 'score' → skin.score.style === 'bitmap' */
  skinStylePath?: string;
  /** linked skin element (EditorPanel shows its fields under the layout card) */
  elementId?: string;
}

// ------------------------------------------------------------- registry ---

const L: LayoutElDef[] = [
  // ---- HOME ----
  { key: 'home.logo', label: 'Logo', screen: 'home', def: { x: 540.5, y: 532, w: 837, h: 888 }, skinTextPath: 'logo.text', elementId: 'logo' },
  { key: 'home.playBtn', label: 'Bottone PLAY', screen: 'home', def: { x: 540, y: 1295, w: 625, h: 216 }, lockRatio: 625 / 216, skinTextPath: 'playBtn.text', elementId: 'playBtn' },
  { key: 'home.btnSfx', label: 'Bottone effetti', screen: 'home', def: { x: 175, y: 1770, w: 170, h: 170 }, lockSquare: true, elementId: 'iconBtn' },
  { key: 'home.btnRanking', label: 'Bottone classifica', screen: 'home', def: { x: 540, y: 1770, w: 170, h: 170 }, lockSquare: true, elementId: 'iconBtn' },
  { key: 'home.btnMusic', label: 'Bottone musica', screen: 'home', def: { x: 906, y: 1770, w: 170, h: 170 }, lockSquare: true, elementId: 'iconBtn' },

  // ---- GAME (HUD) ----
  { key: 'game.score', label: 'Punteggio', screen: 'game', def: { x: 540, y: 211.5, w: 700, h: 160 }, elementId: 'score', skinStylePath: 'score' },
  { key: 'game.heart', label: 'Cuore combo', screen: 'game', def: { x: 540, y: 210, w: 240, h: 240 }, lockSquare: true, elementId: 'heartIcon' },
  { key: 'game.cup', label: 'Coppa', screen: 'game', def: { x: 97, y: 76, w: 104, h: 104 }, lockSquare: true, elementId: 'cupIcon' },
  { key: 'game.best', label: 'Record', screen: 'game', def: { x: 230, y: 82, w: 300, h: 64 }, elementId: 'best' },
  { key: 'game.gems', label: 'Saldo gemme', screen: 'game', def: { x: 230, y: 152, w: 320, h: 60 } },
  { key: 'game.pause', label: 'Bottone pausa', screen: 'game', def: { x: 974, y: 88, w: 100, h: 100 }, lockSquare: true, elementId: 'iconBtn' },
  { key: 'game.combo', label: 'Combo', screen: 'game', def: { x: 540, y: 480, w: 320, h: 180 }, elementId: 'combo' },
  { key: 'game.plus100', label: '+100 guadagno', screen: 'game', def: { x: 540, y: 1415, w: 360, h: 150 }, elementId: 'plus100', skinStylePath: 'plus100' },

  // ---- GAME (board & tray) ----
  { key: 'game.board', label: 'Tabellone', screen: 'game', def: { x: 540, y: 831, w: 1000, h: 1000 }, lockSquare: true, minW: 400, elementId: 'board' },
  { key: 'game.tray0', label: 'Vassoio sinistra', screen: 'game', def: { x: 196.5, y: 1626, w: 250, h: 250 }, lockSquare: true, elementId: 'tray' },
  { key: 'game.tray1', label: 'Vassoio centro', screen: 'game', def: { x: 539.5, y: 1626, w: 250, h: 250 }, lockSquare: true, elementId: 'tray' },
  { key: 'game.tray2', label: 'Vassoio destra', screen: 'game', def: { x: 883.5, y: 1626, w: 250, h: 250 }, lockSquare: true, elementId: 'tray' },

  // ---- GAME (boosters & daily) ----
  { key: 'game.booster0', label: 'Booster pulisci', screen: 'game', def: { x: 236, y: 1426, w: 150, h: 150 }, lockSquare: true },
  { key: 'game.booster1', label: 'Booster rimescola', screen: 'game', def: { x: 540, y: 1426, w: 150, h: 150 }, lockSquare: true },
  { key: 'game.booster2', label: 'Booster elimina', screen: 'game', def: { x: 844, y: 1426, w: 150, h: 150 }, lockSquare: true },
  { key: 'game.dailyChip', label: 'Chip sfida del giorno', screen: 'game', def: { x: 540, y: 1400, w: 880, h: 130 } },

  // ---- POPUP pausa (children relative to the popup box) ----
  { key: 'popups.pause', label: 'Popup pausa', screen: 'popups', def: { x: 540, y: 960.5, w: 886, h: 1113 }, minW: 500, minH: 600, elementId: 'popup' },
  { key: 'popups.pause.close', label: 'Chiudi', screen: 'popups', def: { x: 802, y: 78, w: 80, h: 80 }, parent: 'popups.pause', lockSquare: true, elementId: 'iconBtn' },
  { key: 'popups.pause.sfx', label: 'Effetti', screen: 'popups', def: { x: 697, y: 250, w: 210, h: 100 }, parent: 'popups.pause', lockRatio: 2.1, elementId: 'iconBtn' },
  { key: 'popups.pause.music', label: 'Musica', screen: 'popups', def: { x: 697, y: 413, w: 210, h: 100 }, parent: 'popups.pause', lockRatio: 2.1, elementId: 'iconBtn' },
  { key: 'popups.pause.home', label: 'Home', screen: 'popups', def: { x: 664, y: 590, w: 115, h: 115 }, parent: 'popups.pause', lockSquare: true, elementId: 'iconBtn' },
  { key: 'popups.pause.reset', label: 'Rigioca', screen: 'popups', def: { x: 664, y: 760, w: 116, h: 116 }, parent: 'popups.pause', lockSquare: true, elementId: 'iconBtn' },
  { key: 'popups.pause.ranking', label: 'Classifica', screen: 'popups', def: { x: 664, y: 940, w: 114, h: 114 }, parent: 'popups.pause', lockSquare: true, elementId: 'iconBtn' },

  // ---- POPUP game over ----
  { key: 'popups.gameover.banner', label: 'Banner Game Over', screen: 'popups', def: { x: 540.2, y: 506.4, w: 940, h: 156 }, lockRatio: 940 / 156, text: 'GAME OVER', elementId: 'popup' },
  { key: 'popups.gameover.scoreLabel', label: 'Etichetta SCORE', screen: 'popups', def: { x: 540, y: 761.3, w: 600, h: 90 }, text: 'SCORE', elementId: 'score' },
  { key: 'popups.gameover.score', label: 'Punteggio finale', screen: 'popups', def: { x: 540, y: 905, w: 800, h: 180 }, elementId: 'score', skinStylePath: 'score' },
  { key: 'popups.gameover.bestLabel', label: 'Etichetta BEST SCORE', screen: 'popups', def: { x: 540, y: 1113, w: 700, h: 90 }, text: 'BEST SCORE', elementId: 'best' },
  { key: 'popups.gameover.cup', label: 'Coppa', screen: 'popups', def: { x: 407.5, y: 1205.5, w: 140, h: 140 }, lockSquare: true, elementId: 'cupIcon' },
  { key: 'popups.gameover.best', label: 'Record', screen: 'popups', def: { x: 560, y: 1223, w: 300, h: 64 }, elementId: 'best' },
  { key: 'popups.gameover.gems', label: 'Riga gemme', screen: 'popups', def: { x: 540, y: 1430, w: 920, h: 90 } },
  { key: 'popups.gameover.buttons', label: 'Bottoni fine partita', screen: 'popups', def: { x: 540, y: 1597.9, w: 900, h: 177 } },

  // ---- POPUP classifica ----
  { key: 'popups.ranking', label: 'Popup classifica', screen: 'popups', def: { x: 540, y: 966.5, w: 928, h: 1535 }, minW: 500, minH: 700, elementId: 'popup' },
  { key: 'popups.ranking.title', label: 'Titolo', screen: 'popups', def: { x: 464, y: 84, w: 700, h: 110 }, parent: 'popups.ranking', text: 'CLASSIFICA' },
  { key: 'popups.ranking.close', label: 'Chiudi', screen: 'popups', def: { x: 842, y: 76, w: 89, h: 89 }, parent: 'popups.ranking', lockSquare: true, elementId: 'iconBtn' },
];

export const LAYOUT: Record<string, LayoutElDef> = Object.fromEntries(
  L.map((d) => [d.key, d]),
);

export function layoutElementsByScreen(screen: LayoutScreen): LayoutElDef[] {
  return L.filter((d) => d.screen === screen);
}

// -------------------------------------------------------------- helpers ---

/** Effective rect = original geometry merged with the current override. */
export function effRect(key: string, ov: LayoutOverride | undefined): Rect {
  const d = LAYOUT[key];
  if (!d) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: ov?.x ?? d.def.x,
    y: ov?.y ?? d.def.y,
    w: ov?.w ?? d.def.w,
    h: ov?.h ?? d.def.h,
  };
}

/** Board geometry derived from its (possibly resized) rect. */
export function boardMetrics(rect: Rect): {
  left: number; top: number; pad: number; cell: number; size: number;
} {
  const size = rect.w;
  const pad = (20 * size) / 1000;
  const cell = (size - pad * 2) / 8;
  return { left: rect.x - size / 2, top: rect.y - size / 2, pad, cell, size };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------- store ---

export interface SavedLayout {
  id: string;
  name: string;
  overrides: LayoutState;
  savedAt: number;
}

interface LayoutStore {
  /** studio-only editing mode (drag/resize/text on the preview) */
  editMode: boolean;
  selectedKey: string | null;
  /** snapping grid in design units (0 = free) */
  snap: number;
  overrides: LayoutState;
  saved: SavedLayout[];
  activeSavedId: string | null;

  setEditMode: (v: boolean) => void;
  toggleEditMode: () => void;
  select: (key: string | null) => void;
  setSnap: (n: number) => void;
  setRect: (key: string, patch: Partial<Rect>) => void;
  setText: (key: string, text: string) => void;
  setVisible: (key: string, v: boolean) => void;
  resetKey: (key: string) => void;
  resetAll: () => void;
  saveAs: (name: string) => void;
  saveActive: () => void;
  loadSaved: (id: string) => void;
  deleteSaved: (id: string) => void;
  renameSaved: (id: string, name: string) => void;
  importLayout: (json: string) => boolean;
}

const newId = () => `lay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const useLayout = create<LayoutStore>()(
  persist(
    (set, get) => ({
      editMode: false,
      selectedKey: null,
      snap: 10,
      overrides: {},
      saved: [],
      activeSavedId: null,

      setEditMode: (v) => set({ editMode: v, selectedKey: v ? get().selectedKey : null }),
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode, selectedKey: s.editMode ? null : s.selectedKey })),
      select: (selectedKey) => set({ selectedKey }),
      setSnap: (snap) => set({ snap }),

      setRect: (key, patch) =>
        set((s) => ({
          overrides: {
            ...s.overrides,
            [key]: {
              ...s.overrides[key],
              ...(patch.x !== undefined ? { x: r1(patch.x) } : {}),
              ...(patch.y !== undefined ? { y: r1(patch.y) } : {}),
              ...(patch.w !== undefined ? { w: Math.max(20, r1(patch.w)) } : {}),
              ...(patch.h !== undefined ? { h: Math.max(20, r1(patch.h)) } : {}),
            },
          },
        })),

      setText: (key, text) =>
        set((s) => ({
          overrides: { ...s.overrides, [key]: { ...s.overrides[key], text } },
        })),

      setVisible: (key, v) =>
        set((s) => ({
          overrides: { ...s.overrides, [key]: { ...s.overrides[key], visible: v } },
        })),

      resetKey: (key) =>
        set((s) => {
          if (!s.overrides[key]) return s;
          const next = { ...s.overrides };
          delete next[key];
          return { overrides: next };
        }),

      resetAll: () => set({ overrides: {}, activeSavedId: null }),

      saveAs: (name) =>
        set((s) => {
          const item: SavedLayout = {
            id: newId(),
            name: name.trim() || `Layout ${s.saved.length + 1}`,
            overrides: JSON.parse(JSON.stringify(s.overrides)) as LayoutState,
            savedAt: Date.now(),
          };
          return { saved: [...s.saved, item], activeSavedId: item.id };
        }),

      saveActive: () =>
        set((s) => {
          if (!s.activeSavedId) return s;
          return {
            saved: s.saved.map((it) =>
              it.id === s.activeSavedId
                ? { ...it, overrides: JSON.parse(JSON.stringify(s.overrides)) as LayoutState, savedAt: Date.now() }
                : it,
            ),
          };
        }),

      loadSaved: (id) =>
        set((s) => {
          const item = s.saved.find((it) => it.id === id);
          if (!item) return s;
          return {
            overrides: JSON.parse(JSON.stringify(item.overrides)) as LayoutState,
            activeSavedId: id,
          };
        }),

      deleteSaved: (id) =>
        set((s) => ({
          saved: s.saved.filter((it) => it.id !== id),
          activeSavedId: s.activeSavedId === id ? null : s.activeSavedId,
        })),

      renameSaved: (id, name) =>
        set((s) => ({
          saved: s.saved.map((it) => (it.id === id ? { ...it, name: name.trim() || it.name } : it)),
        })),

      importLayout: (json) => {
        try {
          const parsed = JSON.parse(json) as {
            overrides?: LayoutState;
          };
          if (!parsed || typeof parsed.overrides !== 'object' || parsed.overrides === null) return false;
          // keep only known keys with sane values
          const clean: LayoutState = {};
          for (const [k, v] of Object.entries(parsed.overrides)) {
            if (!LAYOUT[k] || typeof v !== 'object' || v === null) continue;
            clean[k] = {
              ...(typeof v.x === 'number' ? { x: v.x } : {}),
              ...(typeof v.y === 'number' ? { y: v.y } : {}),
              ...(typeof v.w === 'number' ? { w: v.w } : {}),
              ...(typeof v.h === 'number' ? { h: v.h } : {}),
              ...(typeof v.text === 'string' ? { text: v.text } : {}),
              ...(typeof v.visible === 'boolean' ? { visible: v.visible } : {}),
            };
          }
          set({ overrides: clean, activeSavedId: null });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'bb-layouts',
      partialize: (s) => ({
        snap: s.snap,
        overrides: s.overrides,
        saved: s.saved,
        activeSavedId: s.activeSavedId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutStore>;
        return {
          ...current,
          ...p,
          overrides: p.overrides ?? {},
          saved: Array.isArray(p.saved) ? p.saved : [],
        };
      },
    },
  ),
);

/** React hook: effective rect of a layout element (live). */
export function useEffRect(key: string): Rect {
  const ov = useLayout((s) => s.overrides[key]);
  return useMemo(() => effRect(key, ov), [key, ov]);
}

/** Static text of a layout element (override → default). */
export function effText(key: string, ov: LayoutOverride | undefined): string {
  const d = LAYOUT[key];
  return ov?.text ?? d?.text ?? '';
}

export function exportLayout(name: string, state: { overrides: LayoutState }): string {
  return JSON.stringify(
    { app: 'block-blast-layout', version: 1, name, overrides: state.overrides },
    null,
    2,
  );
}
