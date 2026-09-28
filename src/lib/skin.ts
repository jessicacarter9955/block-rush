// Block Blast Skin Studio — skin data model, fonts, presets.
// Original values come from the reverse-engineered game (palette.dart,
// layout_constants.dart, manifest.json) so "Originale" is pixel-faithful.

import type { CSSProperties } from 'react';

export type BlockStyleId =
  | 'original' | 'relief' | 'flat' | 'gradient' | 'glossy'
  | 'neon' | 'pixel' | 'glass' | 'outline' | 'choco' | 'praline'
  | 'image';

/** Premium 3D icon button variants (glossy materials, like the candy game). */
export type IconPremiumId = 'gold' | 'candy' | 'jewel' | 'glass' | 'chrome' | 'neon';

export type IconGroupVariant = IconPremiumId | 'base';

export interface IconGroupVariants {
  /** icon row on the home screen (music / sfx / ranking) */
  home: IconGroupVariant;
  /** buttons shown while playing (pause, home, reset, close…) */
  game: IconGroupVariant;
  /** music / sfx toggles in the pause popup */
  settings: IconGroupVariant;
}

export const ICON_PREMIUM_VARIANTS: { id: IconPremiumId; label: string }[] = [
  { id: 'gold', label: 'Oro 3D' },
  { id: 'candy', label: 'Caramella' },
  { id: 'jewel', label: 'Gemma' },
  { id: 'glass', label: 'Vetro' },
  { id: 'chrome', label: 'Cromo' },
  { id: 'neon', label: 'Neon' },
];

/** User-uploaded block tile images (data URLs or bundled /textures paths). */
export interface BlockImageState {
  mode: 'single' | 'perColor';
  /** one tile used for every color */
  single: string | null;
  /** one tile per color (8 slots) */
  perColor: (string | null)[];
  /** multiply the block RGB color over the image */
  tint: boolean;
  /** 'fill' stretches to the cell, 'contain' keeps aspect */
  fit: 'fill' | 'contain';
  /** drop shadow strength 0–100 (follows the tile silhouette) */
  shadow: number;
}

export function defaultBlockImage(): BlockImageState {
  return { mode: 'single', single: null, perColor: Array(8).fill(null), tint: false, fit: 'fill', shadow: 35 };
}

/** Resolve the tile for a block color: per-color slot → single → null. */
export function blockImgTile(skin: SkinState, colorIdx: number): string | null {
  const img = skin.blocks.img;
  if (!img) return null;
  if (img.mode === 'perColor' && img.perColor?.[colorIdx]) return img.perColor[colorIdx];
  return img.single ?? null;
}

export type FontId =
  | 'riffic' | 'fredoka' | 'baloo' | 'luckiest' | 'lilita' | 'bangers'
  | 'press' | 'carlito' | 'tinos' | 'wenkai' | 'dejavu' | 'mono';

export interface FontDef {
  id: FontId;
  name: string;
  family: string;
  weight: number;
  category: string;
  tracking?: number; // suggested letter-spacing (em)
  upper?: boolean;
}

export const FONTS: FontDef[] = [
  { id: 'riffic', name: 'Riffic (originale)', family: 'Riffic', weight: 700, category: 'Gioco', upper: true, tracking: 0.02 },
  { id: 'fredoka', name: 'Fredoka', family: 'Fredoka', weight: 700, category: 'Arrotondato' },
  { id: 'baloo', name: 'Baloo 2', family: 'Baloo 2', weight: 800, category: 'Arrotondato' },
  { id: 'lilita', name: 'Lilita One', family: 'Lilita One', weight: 400, category: 'Cartoon' },
  { id: 'luckiest', name: 'Luckiest Guy', family: 'Luckiest Guy', weight: 400, category: 'Cartoon', upper: true },
  { id: 'bangers', name: 'Bangers', family: 'Bangers', weight: 400, category: 'Fumetto', upper: true, tracking: 0.04 },
  { id: 'press', name: 'Press Start 2P', family: 'Press Start 2P', weight: 400, category: 'Pixel', upper: true },
  { id: 'carlito', name: 'Carlito', family: 'Carlito', weight: 700, category: 'Moderno' },
  { id: 'tinos', name: 'Tinos (serif)', family: 'Tinos', weight: 700, category: 'Serif' },
  { id: 'wenkai', name: 'WenKai (a mano)', family: 'LXGW WenKai', weight: 500, category: 'Manoscritto' },
  { id: 'dejavu', name: 'DejaVu Sans', family: 'DejaVu Sans', weight: 700, category: 'Neutro' },
  { id: 'mono', name: 'Liberation Mono', family: 'Liberation Mono', weight: 700, category: 'Mono' },
];

export function fontDef(id: FontId): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export function fontCss(id: FontId, sizePx: number): CSSProperties {
  const f = fontDef(id);
  return {
    fontFamily: `'${f.family}', 'Carlito', sans-serif`,
    fontWeight: f.weight,
    fontSize: sizePx,
    letterSpacing: f.tracking ? `${f.tracking}em` : undefined,
    textTransform: f.upper ? 'uppercase' : undefined,
  };
}

// ---------------------------------------------------------------- sounds ---

export type SoundKind = 'file' | 'original' | 'synth';

export interface SoundRef {
  kind: SoundKind;
  /** file path (no extension) or synth preset id; empty for 'original'. */
  src: string;
  pitch: number; // 0.5 – 2
  vol: number;   // 0 – 1.5
}

export type SoundEvent =
  | 'place' | 'clear' | 'cheer' | 'button' | 'pickup'
  | 'invalid' | 'gameOver' | 'music';

export const SYNTH_PRESETS = [
  { id: 'blip', name: 'Blip 8-bit' },
  { id: 'pop', name: 'Pop' },
  { id: 'chime', name: 'Campanella' },
  { id: 'zap', name: 'Zap' },
  { id: 'coin', name: 'Moneta' },
  { id: 'thud', name: 'Tonfo' },
  { id: 'fanfare', name: 'Fanfara' },
] as const;

// ------------------------------------------------------------------ skin ---

export interface SkinState {
  blocks: {
    style: BlockStyleId;
    colors: string[]; // 8 hex, original order
    radius: number;   // % of block size
    gap: number;      // design px inset per cell
    border: number;   // design px (CSS styles)
    img: BlockImageState; // used when style === 'image'
  };
  ghost: {
    style: 'original' | 'tint' | 'outline';
    opacity: number;
  };
  background: {
    style: 'original' | 'solid' | 'gradient' | 'radial' | 'night';
    c1: string;
    c2: string;
    vignette: number; // 0–100
    decor: 'none' | 'stars' | 'bubbles' | 'grid';
    /** optional full-screen background image (data URL or /textures path) */
    img: string | null;
    /** optional different background for the HOME screen (falls back to img) */
    imgHome: string | null;
    imgFit: 'cover' | 'contain' | 'fill';
    /** dark overlay over the image, 0–100 */
    imgDim: number;
  };
  board: {
    style: 'original' | 'dark' | 'glass' | 'neon' | 'outline' | 'gold' | 'image';
    frameColor: string;
    cellColor: string;
    lineColor: string;
    radius: number; // px (design units)
    /** optional cell tile image (data URL or /textures path) */
    cellImg: string | null;
    /** optional full board-frame image with alpha (neon border etc.) */
    img: string | null;
  };
  tray: {
    style: 'original' | 'glass' | 'dark' | 'none';
    color: string;
    opacity: number; // 0–100
    /** optional tray holder tile image (data URL or /textures path) */
    img: string | null;
  };
  playBtn: {
    style: 'original' | 'pill' | 'rounded' | 'neon' | 'pixel';
    c1: string;
    c2: string;
    textColor: string;
    text: string;
    glow: number; // 0–100
    /** optional real button image with alpha (pixel perfect) */
    img: string | null;
    /** scale % of the 625×216 box */
    size: number;
    /** home play button center-Y override (design px, default 1295) */
    y: number | null;
  };
  iconBtn: {
    style: 'original' | 'circle' | 'rounded' | 'pixel' | 'outline';
    bg: string;
    iconColor: string;
    /** premium 3D variants, selectable per icon group (home row / in-game / settings) */
    variants: IconGroupVariants;
    /** optional generic button shell image (glyph rendered on top) */
    img: string | null;
    /** optional per-kind FULL button images (glyph baked in) — pixel perfect */
    imgs: Record<string, string>;
    /** home-row button size override (design px, default 170) */
    size: number | null;
    /** home icon-row center-Y override (design px, default 1770) */
    rowY: number | null;
  };
  popup: {
    style: 'original' | 'dark' | 'light' | 'neon';
    c1: string;
  };
  logo: {
    style: 'original' | 'text' | 'image';
    text: string;
    font: FontId;
    c1: string;
    c2: string;
    gradient: boolean;
    stroke: string;
    strokeWidth: number;
    shadow: number; // 0–100
    size: number;   // % of original 837 width
    /** optional real logo image with alpha (pixel perfect) */
    img: string | null;
    /** home logo center-Y override (design px, default 532) */
    y: number | null;
  };
  score: {
    style: 'bitmap' | 'css';
    font: FontId;
    color: string;
    c2: string;
    gradient: boolean;
    stroke: string;
    strokeWidth: number;
    size: number; // % of original
  };
  best: {
    font: FontId;
    color: string;
    size: number;
    /** optional crown/best icon image with alpha (replaces the cup sprite) */
    iconImg: string | null;
  };
  plus100: {
    style: 'bitmap' | 'classic' | 'neon' | 'candy' | 'pixel';
    color: string;
    glow: string;
    size: number; // %
  };
  combo: {
    font: FontId;
    color: string;
    glow: string;
    size: number; // %
  };
  effects: {
    flashColor: string;
    particles: 'original' | 'confetti' | 'rings' | 'none';
    shake: number; // 0–100
    comboGlow: string;
  };
  sounds: Record<SoundEvent, SoundRef> & {
    sfxVol: number;
    musicVol: number;
  };
}

// Original block palette (RGB sampled from the original sprite frames).
export const ORIGINAL_COLORS = [
  '#8D5FD7', // 0 lavanda (139, 95, 215)
  '#36B2E1', // 1 ciano    (54, 178, 225)
  '#3BB43B', // 2 verde    (59, 180, 59)
  '#4864E7', // 3 blu      (72, 100, 231)
  '#EDB632', // 4 giallo   (237, 182, 50)
  '#ED7821', // 5 arancio  (237, 120, 33)
  '#C93131', // 6 rosso    (201, 49, 49)
  '#D35FD7', // 7 rosa     (211, 95, 215)
];

export const COLOR_NAMES = [
  'Lavanda', 'Ciano', 'Verde', 'Blu', 'Giallo', 'Arancione', 'Rosso', 'Rosa',
];

const file = (src: string, vol = 1, pitch = 1): SoundRef =>
  ({ kind: 'file', src, vol, pitch });

export function defaultSkin(): SkinState {
  return {
    blocks: {
      style: 'original',
      colors: [...ORIGINAL_COLORS],
      radius: 8,
      gap: 4,
      border: 3,
      img: defaultBlockImage(),
    },
    ghost: { style: 'original', opacity: 45 },
    background: {
      style: 'original',
      c1: '#4259A5',
      c2: '#334D8E',
      vignette: 25,
      decor: 'none',
      img: null,
      imgHome: null,
      imgFit: 'cover',
      imgDim: 0,
    },
    board: {
      style: 'original',
      frameColor: '#0D1533',
      cellColor: '#18244A',
      lineColor: '#0D1533',
      radius: 12,
      cellImg: null,
      img: null,
    },
    tray: { style: 'original', color: '#101B3E', opacity: 60, img: null },
    playBtn: {
      style: 'original',
      c1: '#F0AE34',
      c2: '#DD950F',
      textColor: '#FFFFFF',
      text: 'PLAY',
      glow: 35,
      img: null,
      size: 100,
      y: null,
    },
    iconBtn: {
      style: 'original', bg: '#1C2A55', iconColor: '#FFFFFF',
      variants: { home: 'base', game: 'base', settings: 'base' },
      img: null,
      imgs: {},
      size: null,
      rowY: null,
    },
    popup: { style: 'original', c1: '#4259B5' },
    logo: {
      style: 'original',
      text: 'BLOCK BLAST',
      font: 'riffic',
      c1: '#FFD84D',
      c2: '#FF9F1C',
      gradient: true,
      stroke: '#3A2410',
      strokeWidth: 14,
      shadow: 55,
      size: 100,
      img: null,
      y: null,
    },
    score: {
      style: 'bitmap',
      font: 'riffic',
      color: '#FFFFFF',
      c2: '#FFD84D',
      gradient: false,
      stroke: '#1A1030',
      strokeWidth: 10,
      size: 100,
    },
    best: { font: 'carlito', color: '#BFC9EE', size: 100, iconImg: null },
    plus100: { style: 'bitmap', color: '#FFFFFF', glow: '#FFE066', size: 100 },
    combo: { font: 'riffic', color: '#FFFFFF', glow: '#FF9F1C', size: 100 },
    effects: {
      flashColor: '#FFFFFF',
      particles: 'original',
      shake: 60,
      comboGlow: '#FFC94D',
    },
    sounds: {
      place: file('put'),
      clear: { kind: 'original', src: '', vol: 1, pitch: 1 },
      cheer: { kind: 'original', src: '', vol: 1, pitch: 1 },
      button: file('beep'),
      pickup: file('whoosh'),
      invalid: file('return'),
      gameOver: file('lose'),
      music: file('music', 1, 1),
      sfxVol: 90,
      musicVol: 56,
    },
  };
}

// --------------------------------------------------------------- presets ---

export interface PresetDef {
  id: string;
  name: string;
  desc: string;
  swatch: [string, string, string];
  build: () => SkinState;
}

/** Recursively fill defaults: persisted/imported skins may miss new keys. */
export function mergeSkin(base: SkinState, over: unknown): SkinState {
  if (over === null || over === undefined) return base;
  if (typeof over !== 'object' || Array.isArray(over)) return base;
  const out: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const bv = out[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)
      && bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = mergeSkin(bv as SkinState, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as unknown as SkinState;
}

/** Deep-merge preset overrides on top of the default skin. */
function merge<T extends object>(base: T, over: Record<string, unknown>): T {
  const out = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null) {
      out[k] = merge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as unknown as T;
}

type Over = Record<string, unknown>;

// -------------------------------------------------------- candy family ---
// The candy-game replica: one main color per theme, same glossy candy
// blocks, red-glossy board, 3 trays, premium gold 3D icons.

const CANDY_TILES = Array.from(
  { length: 8 }, (_, i) => `/textures/choco-shot-${i}.png`,
);

const CANDY_BLOCK_COLORS = [
  '#C42E49', '#ECB020', '#636F02', '#4D1902',
  '#E15202', '#3A1302', '#02A07E', '#D62549',
];

interface CandyTheme {
  id: string;
  name: string;
  bgC1: string;
  bgC2: string;
  frame: string;
  cell: string;
  tray: string;
  iconFace: string;
  play1: string;
  play2: string;
  popup: string;
  /** bright background → dark texts instead of cream/gold */
  light?: boolean;
  stroke?: string;
}

const CANDY_THEMES: CandyTheme[] = [
  { id: 'rosso', name: 'Rosso', bgC1: '#A5131E', bgC2: '#61060D', frame: '#B00E20', cell: '#930D17', tray: '#2E0206', iconFace: '#8E0B16', play1: '#E2314E', play2: '#A5071D', popup: '#5E0710' },
  { id: 'nero', name: 'Nero', bgC1: '#454B57', bgC2: '#12151B', frame: '#3A404C', cell: '#1E222A', tray: '#101318', iconFace: '#2A2E36', play1: '#565E6B', play2: '#2E333C', popup: '#171A21' },
  { id: 'bianco', name: 'Bianco', light: true, bgC1: '#FFFFFF', bgC2: '#D5D1CB', frame: '#E8E4DE', cell: '#C9C5BE', tray: '#9B9791', iconFace: '#F4F2EE', play1: '#FFD84D', play2: '#EAB308', popup: '#F5F3EF', stroke: '#8A8F98' },
  { id: 'viola', name: 'Viola', bgC1: '#9A54EE', bgC2: '#4A1B8F', frame: '#7C3DE0', cell: '#3D0E75', tray: '#230952', iconFace: '#6E35C9', play1: '#B26BF5', play2: '#7C3DE0', popup: '#3A1178' },
  { id: 'giallo', name: 'Giallo', light: true, bgC1: '#F7C924', bgC2: '#B97806', frame: '#E8AF08', cell: '#7A4E03', tray: '#3C2702', iconFace: '#DEA90A', play1: '#FFD84D', play2: '#EAB308', popup: '#8F5E06', stroke: '#7A4E02' },
  { id: 'verde', name: 'Verde', bgC1: '#A5E36A', bgC2: '#43892B', frame: '#6FBE3C', cell: '#2E6114', tray: '#18390D', iconFace: '#62B23A', play1: '#B4EC6A', play2: '#7CC93F', popup: '#2E6B16' },
  { id: 'azzurro', name: 'Azzurro', bgC1: '#8EDBFF', bgC2: '#2785BC', frame: '#56BBEA', cell: '#0E4B6E', tray: '#0E3954', iconFace: '#4CA6DC', play1: '#A5E3FF', play2: '#5FC2F0', popup: '#1D6A96' },
  { id: 'blu', name: 'Blu', bgC1: '#4A78F7', bgC2: '#1D3A9E', frame: '#3358DC', cell: '#12246E', tray: '#0F1C46', iconFace: '#2F55D6', play1: '#6D95FF', play2: '#3360E8', popup: '#1B2F7E' },
  { id: 'arancio', name: 'Arancio', bgC1: '#FFAE4D', bgC2: '#C75A05', frame: '#F08415', cell: '#7A3403', tray: '#3A1A03', iconFace: '#E5740F', play1: '#FFB970', play2: '#F97B1C', popup: '#96500A' },
  { id: 'rosa', name: 'Rosa', bgC1: '#FF9EC2', bgC2: '#D4478A', frame: '#EE6AA2', cell: '#7E1547', tray: '#440C28', iconFace: '#E75E97', play1: '#FFB3D0', play2: '#F76CA3', popup: '#B03A6F' },
  { id: 'menta', name: 'Menta', bgC1: '#8FF0D4', bgC2: '#269B7A', frame: '#48C8A2', cell: '#0F5C44', tray: '#0D4635', iconFace: '#3DBE95', play1: '#A5F2DC', play2: '#4ECDAA', popup: '#1F7A5F' },
];

function candyPreset(t: CandyTheme): PresetDef {
  const dark = !t.light;
  const textMain = dark ? '#FFF8E1' : '#4A2E04';
  const textStroke = dark ? t.bgC2 : '#FFFFFF';
  const best = dark ? '#FFD700' : '#B07800';
  return {
    id: `candy-${t.id}`,
    name: t.name,
    desc: `Caramella ${t.name.toLowerCase()}: replica del gioco di riferimento (board lucida, blocchi caramella, vassoi, icone oro 3D) in versione ${t.name.toLowerCase()}`,
    swatch: [t.bgC1, t.frame, '#C42E49'],
    build: () =>
      merge(defaultSkin(), {
        blocks: {
          style: 'image',
          radius: 14,
          gap: 4,
          colors: [...CANDY_BLOCK_COLORS],
          img: {
            mode: 'perColor',
            single: null,
            perColor: [...CANDY_TILES],
            tint: false,
            fit: 'fill',
            shadow: 40,
          },
        },
        ghost: { style: 'tint', opacity: 45 },
        background: {
          style: 'gradient',
          c1: t.bgC1,
          c2: t.bgC2,
          decor: 'none',
          vignette: 14,
          img: `/textures/candy/bg-${t.id}.jpg`,
          imgFit: 'cover',
          imgDim: 0,
        },
        board: {
          style: 'gold',
          frameColor: t.frame,
          cellColor: t.cell,
          lineColor: t.cell,
          radius: 13,
          cellImg: `/textures/candy/cell-${t.id}.png`,
        },
        tray: {
          style: 'dark',
          color: t.tray,
          opacity: 100,
          img: `/textures/candy/tray-${t.id}.png`,
        },
        playBtn: {
          style: 'rounded',
          c1: t.play1,
          c2: t.play2,
          textColor: dark ? '#FFF8E1' : '#4A2E04',
          text: 'PLAY',
          glow: 35,
        },
        iconBtn: {
          style: 'circle',
          bg: t.iconFace,
          iconColor: '#FFD700',
          variants: { home: 'gold', game: 'gold', settings: 'gold' },
        },
        popup: { style: t.light ? 'light' : 'dark', c1: t.popup },
        logo: {
          style: 'text',
          text: 'BLOCK BLAST',
          font: 'lilita',
          c1: '#FFF3C4',
          c2: '#D4AF37',
          gradient: true,
          stroke: t.stroke ?? t.bgC2,
          strokeWidth: 14,
          shadow: 55,
        },
        score: {
          style: 'css',
          font: 'riffic',
          color: textMain,
          c2: textMain,
          gradient: false,
          stroke: textStroke,
          strokeWidth: 8,
          size: 100,
        },
        best: { color: best },
        plus100: { style: 'classic', color: '#FFF3C4', glow: '#FFD700' },
        combo: { color: '#FFD700', glow: t.play1 },
        effects: { flashColor: '#FFF3D6', particles: 'confetti', comboGlow: '#FFD700' },
      } as Over),
  };
}

const CANDY_PRESETS: PresetDef[] = CANDY_THEMES.map(candyPreset);

// ------------------------------------------------------- block rush 1:1 ---
// LA versione 1:1 pixel perfect — ogni asset qui sotto è estratto dai due
// screenshot reali dell'utente (gameplay + home) via /uploader:
//   bg bokeh navy con blocchi fluttuanti · board con bordo neon ciano
//   celle scure incassate · blocchi candy glossy 3D (8 colori)
//   logo BLOCK RUSH su rombo viola · PLAY arancio · bottoni circolari viola.

// Block Rush 1:1 — asset estratti pixel perfect dai due screenshot caricati
// dall'utente via /uploader (gameplay 941×1672 + home 942×1670).
const RUSH11_TILES = [
  '/textures/rush/block-0-viola.png',
  '/textures/rush/block-1-azzurro.png',
  '/textures/rush/block-2-verde.png',
  '/textures/rush/block-3-giallo.png',
  '/textures/rush/block-4-arancione.png',
  '/textures/rush/block-5-rosso.png',
  '/textures/rush/block-6-rosa.png',
  '/textures/rush/block-7-blu.png',
];
const RUSH11_COLORS = [
  '#AC39FC', '#03BEFD', '#0DD830', '#FCEA27',
  '#FC8115', '#E31D2C', '#DE3BEF', '#1451FD',
];

export const BLOCK_RUSH_PRESET: PresetDef = {
  id: 'rush',
  name: 'Block Rush 1:1',
  desc: 'LA replica pixel perfect di Block Rush, estratta 1:1 dai due screen dell\'utente: bg bokeh navy, board bordo neon ciano, celle incassate, blocchi candy glossy, logo BLOCK RUSH su rombo viola, PLAY arancio, bottoni circolari viola',
  swatch: ['#0A1755', '#3FE8FE', '#AC39FC'],
  build: () =>
    merge(defaultSkin(), {
      blocks: {
        style: 'image',
        radius: 0,
        gap: 0,
        colors: [...RUSH11_COLORS],
        img: {
          mode: 'perColor',
          single: null,
          perColor: [...RUSH11_TILES],
          tint: false,
          fit: 'fill',
          shadow: 0,
        },
      },
      ghost: { style: 'tint', opacity: 40 },
      background: {
        style: 'gradient',
        c1: '#0E1D56',
        c2: '#0A1755',
        decor: 'stars',
        vignette: 0,
        img: '/textures/rush/bg-game.jpg',
        imgHome: '/textures/rush/bg-home.jpg',
        imgFit: 'cover',
        imgDim: 0,
      },
      board: {
        style: 'image',
        frameColor: '#0A1755',
        cellColor: '#0A1755',
        lineColor: '#0A1755',
        radius: 14,
        cellImg: '/textures/rush/cell.png',
        img: '/textures/rush/frame.png',
      },
      tray: { style: 'none', color: '#0A1755', opacity: 100, img: null },
      playBtn: {
        style: 'rounded',
        c1: '#FC8115',
        c2: '#FD8401',
        textColor: '#FFFFFF',
        text: 'PLAY',
        glow: 30,
        img: '/textures/rush/play.png',
        size: 108,
        y: 1334,
      },
      iconBtn: {
        style: 'circle',
        bg: '#2E1B5E',
        iconColor: '#FFFFFF',
        variants: { home: 'base', game: 'base', settings: 'base' },
        img: null,
        imgs: {
          music: '/textures/rush/btn-music.png',
          sfx: '/textures/rush/btn-sfx.png',
          ranking: '/textures/rush/btn-ranking.png',
          pause: '/textures/rush/btn-pause.png',
        },
        size: 132,
        rowY: 1655,
      },
      popup: { style: 'dark', c1: '#2E1B5E' },
      logo: {
        style: 'image',
        text: 'BLOCK RUSH',
        font: 'luckiest',
        c1: '#FFFFFF',
        c2: '#FFD700',
        gradient: true,
        stroke: '#2A0140',
        strokeWidth: 14,
        shadow: 50,
        size: 92,
        img: '/textures/rush/logo.png',
        y: 580,
      },
      score: {
        style: 'css',
        font: 'riffic',
        color: '#FFFFFF',
        c2: '#FFFFFF',
        gradient: false,
        stroke: '#2E7FE8',
        strokeWidth: 8,
        size: 100,
      },
      best: { color: '#FFC94D', iconImg: '/textures/rush/crown.png' },
      plus100: { style: 'classic', color: '#FFFFFF', glow: '#FFD700' },
      combo: { color: '#FFD700', glow: '#3FE8FE' },
      effects: { flashColor: '#FFFFFF', particles: 'original', comboGlow: '#FFD700' },
    } as Over),
};


export const PRESETS: PresetDef[] = [
  BLOCK_RUSH_PRESET,
  {
    id: 'original',
    name: 'Originale',
    desc: 'Il Block Blast originale, sprite e colori 1:1',
    swatch: ['#8D5FD7', '#EDB632', '#4259A5'],
    build: () => defaultSkin(),
  },
  {
    id: 'neon',
    name: 'Neon Night',
    desc: 'Notte blu notte, blocchi al neon e glow elettrico',
    swatch: ['#00E5FF', '#FF3C8A', '#0B1026'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'neon', colors: ['#FF3C8A', '#00E5FF', '#7C4DFF', '#39FF14', '#FFE93C', '#FF7A00', '#FF2E63', '#E040FB'] },
        background: { style: 'night', c1: '#0B1026', c2: '#1B1040', decor: 'stars', vignette: 55 },
        board: { style: 'neon', frameColor: '#0A0F24', cellColor: '#101833', lineColor: '#1E2C5E' },
        tray: { style: 'glass', color: '#0A0F24', opacity: 50 },
        playBtn: { style: 'neon', c1: '#00E5FF', c2: '#7C4DFF', glow: 80 },
        iconBtn: { style: 'circle', bg: '#101833', iconColor: '#00E5FF' },
        popup: { style: 'neon', c1: '#00E5FF' },
        logo: { style: 'text', font: 'fredoka', c1: '#00E5FF', c2: '#FF3C8A', gradient: true, stroke: '#04070F', strokeWidth: 12 },
        score: { style: 'css', color: '#FFFFFF', stroke: '#00E5FF', strokeWidth: 8 },
        plus100: { style: 'neon', color: '#00E5FF', glow: '#00E5FF' },
        combo: { color: '#FF3C8A', glow: '#FF3C8A' },
        effects: { flashColor: '#00E5FF', particles: 'confetti', comboGlow: '#00E5FF' },
      } as Over),
  },
  {
    id: 'candy',
    name: 'Candy Pop',
    desc: 'Caramelle lucide su fondo rosa, tutto bombato',
    swatch: ['#FF8FAB', '#63C7FF', '#FFD3E8'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'glossy', radius: 18, colors: ['#FD6A8A', '#63C7FF', '#95E06C', '#7E6BF2', '#FFD166', '#FF9F68', '#F38BA0', '#C58BF2'] },
        background: { style: 'gradient', c1: '#FFD3E8', c2: '#B98BD9', decor: 'bubbles', vignette: 10 },
        board: { style: 'glass', frameColor: '#FFFFFF', cellColor: '#8A5FAE', lineColor: '#FFFFFF' },
        tray: { style: 'glass', color: '#FFFFFF', opacity: 35 },
        playBtn: { style: 'pill', c1: '#FF8FAB', c2: '#FD6A8A', glow: 55 },
        iconBtn: { style: 'rounded', bg: '#FFFFFF', iconColor: '#FD6A8A' },
        popup: { style: 'light', c1: '#FFFFFF' },
        logo: { style: 'text', font: 'lilita', c1: '#FFFFFF', c2: '#FFB3C6', gradient: true, stroke: '#B4527A', strokeWidth: 16 },
        score: { style: 'css', color: '#FFFFFF', stroke: '#B4527A', strokeWidth: 10 },
        best: { color: '#FFE3EE' },
        plus100: { style: 'candy', color: '#FFFFFF', glow: '#FF9BC4' },
        combo: { color: '#FFF', glow: '#FF9BC4' },
        effects: { flashColor: '#FFE3EE', particles: 'confetti' },
      } as Over),
  },
  {
    id: 'retro',
    name: 'Retro Arcade',
    desc: 'Pixel anni 80, palette PICO-8 e font 8-bit',
    swatch: ['#FF004D', '#29ADFF', '#101014'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'pixel', radius: 0, gap: 6, border: 5, colors: ['#FF004D', '#29ADFF', '#00E436', '#7E2553', '#FFEC27', '#FF77A8', '#83769C', '#FFA300'] },
        background: { style: 'solid', c1: '#101014', c2: '#101014', decor: 'grid', vignette: 45 },
        board: { style: 'outline', frameColor: '#29ADFF', cellColor: '#16161F', lineColor: '#292937', radius: 0 },
        tray: { style: 'dark', color: '#16161F', opacity: 80 },
        playBtn: { style: 'pixel', c1: '#FFEC27', c2: '#FFA300', textColor: '#101014', glow: 20 },
        iconBtn: { style: 'pixel', bg: '#1D1D28', iconColor: '#FFEC27' },
        popup: { style: 'dark', c1: '#1D1D28' },
        logo: { style: 'text', font: 'bangers', c1: '#FFEC27', c2: '#FFA300', gradient: true, stroke: '#101014', strokeWidth: 18, size: 92 },
        score: { style: 'css', font: 'press', color: '#FFEC27', stroke: '#101014', strokeWidth: 6, size: 80 },
        best: { font: 'press', color: '#83769C', size: 70 },
        plus100: { style: 'pixel', color: '#00E436', glow: '#00E436' },
        combo: { font: 'press', color: '#FF004D', glow: '#FF004D' },
        effects: { flashColor: '#FFEC27', particles: 'confetti', comboGlow: '#29ADFF' },
      } as Over),
  },
  {
    id: 'ocean',
    name: 'Oceano Profondo',
    desc: 'Vetro e tinte marine su blu abissale',
    swatch: ['#2EC4B6', '#4CC9F0', '#072A4A'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'glass', colors: ['#4CC9F0', '#2EC4B6', '#56CFE1', '#4895EF', '#80ED99', '#FFD166', '#EF476F', '#9B5DE5'] },
        background: { style: 'gradient', c1: '#072A4A', c2: '#0E4D6E', decor: 'bubbles', vignette: 35 },
        board: { style: 'glass', frameColor: '#0A3552', cellColor: '#0C3B57', lineColor: '#12557A' },
        playBtn: { style: 'rounded', c1: '#4CC9F0', c2: '#2EC4B6', glow: 45 },
        iconBtn: { style: 'circle', bg: '#0C3B57', iconColor: '#4CC9F0' },
        popup: { style: 'dark', c1: '#0C3B57' },
        logo: { style: 'text', font: 'fredoka', c1: '#4CC9F0', c2: '#2EC4B6', gradient: true, stroke: '#052033', strokeWidth: 12 },
        score: { style: 'css', color: '#E0FBFC', stroke: '#052033', strokeWidth: 8 },
        plus100: { style: 'classic', color: '#80ED99', glow: '#4CC9F0' },
        combo: { color: '#FFD166', glow: '#4CC9F0' },
        effects: { flashColor: '#E0FBFC', particles: 'rings' },
      } as Over),
  },
  {
    id: 'sunset',
    name: 'Tramonto',
    desc: 'Gradienti caldi arancio-viola da fine estate',
    swatch: ['#FF6B6B', '#FFD43B', '#7A2E6F'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'gradient', colors: ['#FF6B6B', '#FFA94D', '#FFD43B', '#F76707', '#E8590C', '#D6336C', '#AE3EC9', '#7048E8'] },
        background: { style: 'gradient', c1: '#FFB25E', c2: '#7A2E6F', decor: 'stars', vignette: 30 },
        board: { style: 'dark', frameColor: '#5C2A5E', cellColor: '#6B3A6E', lineColor: '#5C2A5E' },
        playBtn: { style: 'rounded', c1: '#FF9F1C', c2: '#FF6B6B', glow: 55 },
        iconBtn: { style: 'circle', bg: '#5C2A5E', iconColor: '#FFD43B' },
        popup: { style: 'dark', c1: '#5C2A5E' },
        logo: { style: 'text', font: 'lilita', c1: '#FFF5D6', c2: '#FF9F1C', gradient: true, stroke: '#5C2A5E', strokeWidth: 16 },
        score: { style: 'css', color: '#FFF5D6', stroke: '#5C2A5E', strokeWidth: 10 },
        plus100: { style: 'candy', color: '#FFF5D6', glow: '#FF9F1C' },
        combo: { color: '#FFD43B', glow: '#FF6B6B' },
        effects: { flashColor: '#FFF5D6', particles: 'confetti', comboGlow: '#FF9F1C' },
      } as Over),
  },
  {
    id: 'pastel',
    name: 'Pastello',
    desc: 'Flat pastello su crema, morbido e leggero',
    swatch: ['#C9B6F5', '#A5E3F0', '#FDF6EC'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'flat', radius: 14, colors: ['#C9B6F5', '#A5E3F0', '#B5E5B0', '#A5C8F0', '#F5E3A5', '#F5C5A0', '#F5AFC0', '#E0B5F0'] },
        background: { style: 'solid', c1: '#FDF6EC', c2: '#FDF6EC', vignette: 0, decor: 'none' },
        board: { style: 'dark', frameColor: '#EAD9C2', cellColor: '#F0E4D2', lineColor: '#EAD9C2', radius: 20 },
        tray: { style: 'glass', color: '#FFFFFF', opacity: 60 },
        playBtn: { style: 'pill', c1: '#C9B6F5', c2: '#A5C8F0', textColor: '#4A4260', glow: 25 },
        iconBtn: { style: 'rounded', bg: '#FFFFFF', iconColor: '#8B7EC8' },
        popup: { style: 'light', c1: '#FFFFFF' },
        logo: { style: 'text', font: 'baloo', c1: '#8B7EC8', c2: '#A5C8F0', gradient: true, stroke: '#FFFFFF', strokeWidth: 0, shadow: 20, size: 90 },
        score: { style: 'css', color: '#5B5B7A', stroke: '#FFFFFF', strokeWidth: 0 },
        best: { color: '#9B9AB5' },
        plus100: { style: 'classic', color: '#8B7EC8', glow: '#C9B6F5' },
        combo: { color: '#8B7EC8', glow: '#C9B6F5' },
        effects: { flashColor: '#FFFFFF', particles: 'rings', shake: 30 },
      } as Over),
  },
  {
    id: 'foresta',
    name: 'Foresta',
    desc: 'Verdi muschio e legno, atmosfera bosco',
    swatch: ['#95E06C', '#2F5D3A', '#F2E8C9'],
    build: () =>
      merge(defaultSkin(), {
        blocks: { style: 'relief', colors: ['#95E06C', '#5FAD56', '#3E8948', '#E4B94E', '#C97B3D', '#A35B2E', '#D68A5C', '#7FA65A'] },
        background: { style: 'gradient', c1: '#2F5D3A', c2: '#1B3A26', decor: 'grid', vignette: 40 },
        board: { style: 'dark', frameColor: '#24422C', cellColor: '#2B4A34', lineColor: '#1E3A26' },
        tray: { style: 'dark', color: '#24422C', opacity: 70 },
        playBtn: { style: 'rounded', c1: '#95E06C', c2: '#3E8948', glow: 40 },
        iconBtn: { style: 'rounded', bg: '#24422C', iconColor: '#F2E8C9' },
        popup: { style: 'dark', c1: '#24422C' },
        logo: { style: 'text', font: 'luckiest', c1: '#F2E8C9', c2: '#E4B94E', gradient: true, stroke: '#1B3A26', strokeWidth: 16 },
        score: { style: 'css', color: '#F2E8C9', stroke: '#1B3A26', strokeWidth: 8 },
        plus100: { style: 'classic', color: '#E4B94E', glow: '#95E06C' },
        combo: { color: '#E4B94E', glow: '#95E06C' },
        effects: { flashColor: '#F2E8C9', particles: 'confetti', comboGlow: '#E4B94E' },
      } as Over),
  },
  {
    id: 'choco',
    name: 'Cioccolato',
    desc: 'Barrette e cioccolatini modellati, scatola blu con cornice oro',
    swatch: ['#4E342E', '#D4AF37', '#1A237E'],
    build: () =>
      merge(defaultSkin(), {
        blocks: {
          style: 'choco',
          radius: 12,
          colors: ['#C2185B', '#FDD835', '#7CB342', '#4E342E', '#EF6C00', '#00ACC1', '#AD1457', '#8D6E63'],
        },
        background: { style: 'gradient', c1: '#1A237E', c2: '#0D1642', decor: 'none', vignette: 40 },
        board: { style: 'gold', frameColor: '#D4AF37', cellColor: '#101A4C', lineColor: '#8A6511', radius: 18 },
        tray: { style: 'dark', color: '#0D1642', opacity: 72 },
        playBtn: { style: 'rounded', c1: '#FDD835', c2: '#EF6C00', textColor: '#3E2723', glow: 50 },
        iconBtn: { style: 'rounded', bg: '#141E5E', iconColor: '#FFD54F' },
        popup: { style: 'dark', c1: '#1A237E' },
        logo: { style: 'text', text: 'CHOCO BLAST', font: 'lilita', c1: '#FFF3C4', c2: '#D4AF37', gradient: true, stroke: '#3E2723', strokeWidth: 16, shadow: 60 },
        score: { style: 'css', color: '#FFF8E1', stroke: '#3E2723', strokeWidth: 10 },
        best: { color: '#E6C870' },
        plus100: { style: 'classic', color: '#FFF8E1', glow: '#FFD700' },
        combo: { color: '#FFD700', glow: '#EF6C00' },
        effects: { flashColor: '#FFF3D6', particles: 'confetti', comboGlow: '#FFD700' },
      } as Over),
  },
  {
    id: 'cioccolatini',
    name: 'Cioccolatini (immagini)',
    desc: 'Tessere immagine caricate/AI per gusto — sostituiscile con le tue PNG',
    swatch: ['#D42D5B', '#6B3E26', '#D4AF37'],
    build: () =>
      merge(defaultSkin(), {
        blocks: {
          style: 'image',
          radius: 18,
          gap: 4,
          colors: ['#D42D5B', '#E8B830', '#8CB832', '#6B3E26', '#E87D30', '#2DB892', '#4E342E', '#C98A4B'],
          img: {
            mode: 'perColor',
            single: null,
            perColor: [
              '/textures/praline-0-lampone.png', '/textures/praline-1-limone.png',
              '/textures/praline-2-lime.png', '/textures/praline-3-latte.png',
              '/textures/praline-4-arancio.png', '/textures/praline-5-menta.png',
              '/textures/praline-6-fondente.png', '/textures/praline-7-caramello.png',
            ],
            tint: false,
            fit: 'fill',
            shadow: 40,
          },
        },
        background: { style: 'gradient', c1: '#1A237E', c2: '#0D1642', decor: 'none', vignette: 40 },
        board: {
          style: 'gold',
          frameColor: '#D4AF37', cellColor: '#101A4C', lineColor: '#8A6511', radius: 18,
          cellImg: '/textures/board-cell-velvet.png',
        },
        tray: { style: 'dark', color: '#0D1642', opacity: 72 },
        playBtn: { style: 'rounded', c1: '#FDD835', c2: '#EF6C00', textColor: '#3E2723', glow: 50 },
        iconBtn: { style: 'rounded', bg: '#141E5E', iconColor: '#FFD54F' },
        popup: { style: 'dark', c1: '#1A237E' },
        logo: { style: 'text', text: 'CHOCO BLAST', font: 'lilita', c1: '#FFF3C4', c2: '#D4AF37', gradient: true, stroke: '#3E2723', strokeWidth: 16, shadow: 60 },
        score: { style: 'css', color: '#FFF8E1', stroke: '#3E2723', strokeWidth: 10 },
        best: { color: '#E6C870' },
        plus100: { style: 'classic', color: '#FFF8E1', glow: '#FFD700' },
        combo: { color: '#FFD700', glow: '#EF6C00' },
        effects: { flashColor: '#FFF3D6', particles: 'confetti', comboGlow: '#FFD700' },
      } as Over),
  },
  {
    id: 'ciocoShot',
    name: 'Cioccolato (screenshot)',
    desc: 'I quadratini VERI estratti dallo screenshot del gioco cioccolato (8 gusti)',
    swatch: ['#C42E49', '#ECB020', '#02A07E'],
    build: () =>
      merge(defaultSkin(), {
        blocks: {
          style: 'image',
          radius: 14,
          gap: 4,
          colors: ['#C42E49', '#ECB020', '#636F02', '#4D1902', '#E15202', '#3A1302', '#02A07E', '#C23C54'],
          img: {
            mode: 'perColor',
            single: null,
            perColor: [
              '/textures/choco-shot-0.png', '/textures/choco-shot-1.png',
              '/textures/choco-shot-2.png', '/textures/choco-shot-3.png',
              '/textures/choco-shot-4.png', '/textures/choco-shot-5.png',
              '/textures/choco-shot-6.png', '/textures/choco-shot-7.png',
            ],
            tint: false,
            fit: 'fill',
            shadow: 40,
          },
        },
        background: { style: 'gradient', c1: '#253064', c2: '#171D46', decor: 'none', vignette: 35 },
        board: { style: 'dark', frameColor: '#2A3570', cellColor: '#061B55', lineColor: '#0D1740', radius: 16 },
        tray: { style: 'dark', color: '#171D46', opacity: 72 },
        playBtn: { style: 'rounded', c1: '#ECB020', c2: '#E15202', textColor: '#3E2723', glow: 50 },
        iconBtn: { style: 'rounded', bg: '#1B2560', iconColor: '#ECB020' },
        popup: { style: 'dark', c1: '#1B2560' },
        logo: { style: 'text', text: 'CHOCO BLAST', font: 'lilita', c1: '#FFF3C4', c2: '#ECB020', gradient: true, stroke: '#3E2723', strokeWidth: 16, shadow: 60 },
        score: { style: 'css', color: '#FFF8E1', stroke: '#3E2723', strokeWidth: 10 },
        best: { color: '#C9D4F0' },
        plus100: { style: 'classic', color: '#FFF8E1', glow: '#ECB020' },
        combo: { color: '#ECB020', glow: '#E15202' },
        effects: { flashColor: '#FFF3D6', particles: 'confetti', comboGlow: '#ECB020' },
      } as Over),
  },
  ...CANDY_PRESETS,
];

export function presetById(id: string): PresetDef | undefined {
  return PRESETS.find((p) => p.id === id);
}

// ------------------------------------------------------- demo tile sets ---

const DEMO_FLAVORS = [
  'lampone', 'limone', 'lime', 'latte', 'arancio', 'menta', 'fondente', 'caramello',
];

export interface DemoTileSet {
  id: string;
  name: string;
  desc: string;
  tiles: string[];
}

/** Bundled AI-generated praline tile sets: same 8 flavors, two camera views. */
export const DEMO_TILE_SETS: DemoTileSet[] = [
  {
    id: 'flat',
    name: 'Dall\u2019alto',
    desc: 'Vista esattamente dall\u2019alto (flat), come i blocchi originali',
    tiles: DEMO_FLAVORS.map((f, i) => `/textures/praline-${i}-${f}.png`),
  },
  {
    id: 'iso',
    name: 'Isometrica',
    desc: 'Vista 3/4 inclinata con spessore e lati visibili',
    tiles: DEMO_FLAVORS.map((f, i) => `/textures/praline-iso-${i}-${f}.png`),
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
    desc: 'I quadratini reali estratti dallo screenshot del gioco cioccolato',
    tiles: Array.from({ length: 8 }, (_, i) => `/textures/choco-shot-${i}.png`),
  },
];
