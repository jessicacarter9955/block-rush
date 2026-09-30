'use client';

// Rendering kit — shared skin-aware game elements used by the preview
// screens, the editor variant thumbnails and the playable game.
// All coordinates are in the original 1080×1920 design space.

import type { CSSProperties, ReactNode } from 'react';
import { BP } from '@/lib/bp';
import {
  Home, Medal, Music, Pause, RotateCcw, Trophy, Volume2, VolumeX, X, Heart as HeartIcon,
} from 'lucide-react';
import { darken, lighten, withAlpha } from '@/lib/color';
import {
  blockImgTile, fontCss, type IconPremiumId, type SkinState,
} from '@/lib/skin';
import { BlockTile } from '@/components/blocks/BlockTile';

/** center-based absolute positioning in design units */
export function pos(cx: number, cy: number, w: number, h: number): CSSProperties {
  return {
    position: 'absolute',
    left: cx - w / 2,
    top: cy - h / 2,
    width: w,
    height: h,
  };
}

/**
 * Position a child INSIDE a popup container. X/Y are absolute design coords,
 * px/py/W/H describe the popup (center + size). Converts to coordinates
 * relative to the popup's top-left corner.
 */
export function relPos(
  X: number, Y: number, w: number, h: number,
  px: number, py: number, W: number, H: number,
): CSSProperties {
  return pos(X - px + W / 2, Y - py + H / 2, w, h);
}

// ------------------------------------------------------------ background ---

function seeded(n: number): () => number {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function BackgroundView({ skin, variant = 'game' }: { skin: SkinState; variant?: 'home' | 'game' }) {
  const bg = skin.background;
  const bgImg = variant === 'home' && bg.imgHome ? bg.imgHome : bg.img;
  const layer: CSSProperties =
    bgImg
      ? {
          backgroundImage: `url(${bgImg})`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize:
            bg.imgFit === 'cover' ? 'cover' : bg.imgFit === 'contain' ? 'contain' : '100% 100%',
        }
      : bg.style === 'original'
      ? { backgroundImage: `url(${BP}/sprites/Bg-f00.png)`, backgroundSize: '100% 100%' }
      : bg.style === 'solid'
        ? { background: bg.c1 }
        : bg.style === 'radial'
          ? { background: `radial-gradient(120% 90% at 50% 28%, ${bg.c1} 0%, ${bg.c2} 78%)` }
          : { background: `linear-gradient(168deg, ${bg.c1} 0%, ${bg.c2} 100%)` };

  const rand = seeded(42);
  const stars = Array.from({ length: 34 }, () => ({
    x: rand() * 100, y: rand() * 100, s: 2 + rand() * 4, d: rand() * 4,
  }));
  const bubbles = Array.from({ length: 14 }, () => ({
    x: rand() * 100, s: 8 + rand() * 26, d: rand() * 12, dur: 9 + rand() * 10,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...layer }}>
      {bgImg && bg.imgDim > 0 && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `rgba(5,7,15,${bg.imgDim / 125})`,
          }}
        />
      )}
      {bg.decor === 'stars' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {stars.map((s, i) => (
            <span
              key={i}
              className="bb-twinkle"
              style={{
                position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
                width: s.s * 2, height: s.s * 2, borderRadius: '50%',
                background: '#FFFFFF', opacity: 0.75,
                animationDelay: `${s.d}s`,
              }}
            />
          ))}
        </div>
      )}
      {bg.decor === 'bubbles' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {bubbles.map((s, i) => (
            <span
              key={i}
              className="bb-rise"
              style={{
                position: 'absolute', left: `${s.x}%`, top: '104%',
                width: s.s, height: s.s, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.08)',
                animationDelay: `${s.d}s`, animationDuration: `${s.dur}s`,
              }}
            />
          ))}
        </div>
      )}
      {bg.decor === 'grid' && (
        <div
          style={{
            position: 'absolute', inset: 0, opacity: 0.16,
            backgroundImage:
              `repeating-linear-gradient(0deg, ${withAlpha('#8FA3FF', 0.5)} 0 2px, transparent 2px 120px),` +
              `repeating-linear-gradient(90deg, ${withAlpha('#8FA3FF', 0.5)} 0 2px, transparent 2px 120px)`,
          }}
        />
      )}
      {bg.vignette > 0 && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: `inset 0 0 ${300 + bg.vignette * 4}px ${withAlpha('#05070F', bg.vignette / 165)}`,
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------- board ---

// Geometria 1:1 misurata dai reference: la griglia (slot 0,0) parte a
// (74.5, 385) in coordinate design; slot 115.8125 x 117.9375; il frame
// completo (bordo neon + interno) occupa (26,343)-(1045,1374).
export const GRID = { x0: 74.5, y0: 385, px: 115.8125, py: 117.9375, n: 8 };
// board container == area della griglia (per cellRect); il frame sborda con frameRect
export const BOARD = {
  x: GRID.x0 + (GRID.px * GRID.n) / 2,   // 537.75
  y: GRID.y0 + (GRID.py * GRID.n) / 2,   // 856.75
  size: GRID.px * GRID.n,                // 926.5 (w)
  h: GRID.py * GRID.n,                   // 943.5 (h)
  cell: GRID.px,
  gridX: GRID.x0,
  gridY: GRID.y0,
  originX: GRID.x0,
  originY: GRID.y0,
};

export function BoardFrameView({ skin }: { skin: SkinState }) {
  const b = skin.board;
  const common: CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1000, height: 1000 };
  if (b.style === 'original') {
    return (
      <div style={{ ...common, backgroundImage: `url(${BP}/sprites/Board-f00.png)`, backgroundSize: '100% 100%' }} />
    );
  }
  if (b.style === 'image' && b.img) {
    // Frame 1:1: rettangolo (di default 1086×1086 a offset -43) oppure esplicito
    // via board.frameRect (board COMPLETO col interno: interiorBaked).
    const fr = b.frameRect ?? { left: -48.5, top: -42, w: 1019, h: 1031 };
    return (
      <div
        style={{
          position: 'absolute',
          left: fr.left, top: fr.top, width: fr.w, height: fr.h,
          backgroundImage: `url(${b.img})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          pointerEvents: 'none',
        }}
      />
    );
  }
  if (b.style === 'glass') {
    return (
      <div
        style={{
          ...common, borderRadius: b.radius * 2, boxSizing: 'border-box',
          background: withAlpha(b.frameColor, 0.45), backdropFilter: 'blur(6px)',
          border: `3px solid ${withAlpha('#FFFFFF', 0.25)}`,
          boxShadow: `0 24px 60px ${withAlpha('#000000', 0.35)}, inset 0 2px 24px ${withAlpha('#FFFFFF', 0.12)}`,
        }}
      />
    );
  }
  if (b.style === 'neon') {
    return (
      <div
        style={{
          ...common, borderRadius: b.radius * 2, boxSizing: 'border-box',
          background: withAlpha(darken(b.cellColor, 0.2), 0.9),
          border: `4px solid ${b.lineColor}`,
          boxShadow: `0 0 46px ${withAlpha(b.lineColor, 0.6)}, inset 0 0 40px ${withAlpha(b.lineColor, 0.25)}`,
        }}
      />
    );
  }
  if (b.style === 'outline') {
    return (
      <div
        style={{
          ...common, borderRadius: b.radius, boxSizing: 'border-box',
          border: `5px solid ${b.lineColor}`, background: withAlpha(b.frameColor, 0.35),
        }}
      />
    );
  }
  if (b.style === 'gold') {
    // Metallic frame derived from frameColor (chocolate-box look).
    const g = b.frameColor;
    return (
      <div
        style={{
          ...common, borderRadius: b.radius * 2, boxSizing: 'border-box',
          background: `linear-gradient(135deg, ${lighten(g, 0.42)} 0%, ${g} 26%, ${darken(g, 0.24)} 52%, ${lighten(g, 0.3)} 74%, ${darken(g, 0.32)} 100%)`,
          border: `3px solid ${withAlpha(darken(g, 0.38), 0.9)}`,
          boxShadow: `0 26px 70px ${withAlpha('#000000', 0.5)}, inset 0 4px 16px ${withAlpha(lighten(g, 0.55), 0.55)}, inset 0 -4px 14px ${withAlpha(darken(g, 0.45), 0.6)}`,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...common, borderRadius: b.radius * 2, boxSizing: 'border-box',
        background: b.frameColor,
        border: `3px solid ${withAlpha(darken(b.frameColor, 0.4), 0.9)}`,
        boxShadow: `0 26px 70px ${withAlpha('#000000', 0.45)}, inset 0 3px 20px ${withAlpha(lighten(b.frameColor, 0.25), 0.18)}`,
      }}
    />
  );
}

/** Slot (r,c) rect inside the board container (= grid area).
 *  `size` scala il contenuto dentro lo slot (default: slot pieno — la tile
 *  contiene già blocchi + separatori estratti 1:1 dal reference). */
export function cellRect(r: number, c: number, size = 1): CSSProperties {
  const w = GRID.px * size, h = GRID.py * size;
  return {
    position: 'absolute',
    left: c * GRID.px + (GRID.px - w) / 2,
    top: r * GRID.py + (GRID.py - h) / 2,
    width: w, height: h,
  };
}

export function EmptyCellsView({ skin }: { skin: SkinState }) {
  if (skin.board.style === 'original') return null;
  const b = skin.board;
  // board con interno incluso nell'immagine frame (interiorBaked): niente celle
  if (b.style === 'image' && b.interiorBaked) return null;
  const cells: ReactNode[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            ...cellRect(r, c, b.cellImg ? 1 : 0.93),
            borderRadius: skin.board.radius,
            ...(b.cellImg
              ? {
                  backgroundImage: `url(${b.cellImg})`,
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                }
              : { background: `linear-gradient(135deg,#12265b,${b.cellColor})`,border:'2px solid #1c3263' }),
            boxShadow: b.style === 'outline'
              ? `inset 0 0 0 2px ${withAlpha(b.lineColor, 0.8)}`
              : `inset 0 2px 6px ${withAlpha('#000000', 0.4)}`,
          }}
        />,
      );
    }
  }
  return <><div style={{position:'absolute',inset:0,background:'#050e32'}}/>{cells}</>;
}

// ----------------------------------------------------------------- pieces ---

export function PieceView({
  skin, cells, color, w, h, cellSize,
}: {
  skin: SkinState;
  cells: [number, number][];
  color: number;
  w: number;
  h: number;
  cellSize: number;
}) {
  const img = skin.blocks.img;
  const imgSrc = blockImgTile(skin, color);
  return (
    <div style={{ position: 'relative', width: w * cellSize, height: h * cellSize }}>
      {cells.map(([r, c], i) => (
        <div key={i} style={{ position: 'absolute', left: c * cellSize, top: r * cellSize }}>
          <BlockTile
            colorIdx={color}
            color={skin.blocks.colors[color]}
            style={skin.blocks.style}
            size={cellSize}
            radius={skin.blocks.radius}
            gap={skin.blocks.gap * (cellSize / 120)}
            border={skin.blocks.border * (cellSize / 120)}
            imgSrc={imgSrc}
            imgTint={img?.tint}
            imgFit={img?.fit}
            imgShadow={img?.shadow}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- buttons ---

export type IconKind =
  | 'music' | 'sfx' | 'pause' | 'ranking' | 'home'
  | 'reset' | 'close' | 'revive' | 'showRanking';

const SPRITE_OF: Record<IconKind, { obj: string; toggle: boolean }> = {
  music: { obj: 'BtnMusic2', toggle: true },
  sfx: { obj: 'BtnSFX2', toggle: true },
  pause: { obj: 'BtnPause', toggle: false },
  ranking: { obj: 'BtnRanking', toggle: false },
  home: { obj: 'BtnHome', toggle: false },
  reset: { obj: 'BtnReset', toggle: false },
  close: { obj: 'BtnClose', toggle: false },
  revive: { obj: 'BtnRevive', toggle: false },
  showRanking: { obj: 'BtnShowRanking', toggle: false },
};

const WIDE_OF: Partial<Record<IconKind, string>> = { music: 'BtnMusic', sfx: 'BtnSFX' };

function LucideOf(kind: IconKind, on: boolean) {
  switch (kind) {
    case 'music': return Music;
    case 'sfx': return on ? Volume2 : VolumeX;
    case 'pause': return Pause;
    case 'ranking': return Trophy;
    case 'home': return Home;
    case 'reset': return RotateCcw;
    case 'close': return X;
    case 'revive': return HeartIcon;
    case 'showRanking': return Medal;
  }
}

/** Icon group: where the button appears — decides which premium variant applies. */
export type IconGroup = 'home' | 'game' | 'settings';

/**
 * Premium 3D icon button — six glossy materials inspired by the candy game
 * (round face + metallic ring + beveled glyph). `wide` renders the pill
 * version used by the music/sfx toggles.
 */
export function PremiumIconButton({
  variant, kind, on = true, size, wide = false, bg, iconColor, onClick, active,
}: {
  variant: IconPremiumId;
  kind: IconKind;
  on?: boolean;
  size: number;
  wide?: boolean;
  bg: string;
  iconColor: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Icon = LucideOf(kind, on);
  const w = wide ? size * 2.1 : size;
  const rad = wide ? size / 2 : '50%';
  const gs = size * (wide ? 0.46 : 0.52);
  const dark = darken(bg, 0.5);
  const cursor = onClick ? 'pointer' : 'default';
  const activeFx = active ? 'drop-shadow(0 0 12px #FFC94D)' : undefined;

  // material surface per variant
  let surface: CSSProperties;
  if (variant === 'gold') {
    surface = {
      background: `linear-gradient(155deg, #FFF6C9 0%, #F7D774 28%, #C9971E 52%, #8A6410 76%, #E9C765 100%)`,
      padding: Math.max(4, size * 0.055),
      boxShadow: `0 ${size * 0.05}px ${size * 0.14}px ${withAlpha('#000000', 0.5)}`,
    };
  } else if (variant === 'candy') {
    surface = {
      background: `linear-gradient(180deg, ${lighten(bg, 0.22)} 0%, ${bg} 45%, ${darken(bg, 0.18)} 100%)`,
      border: `${Math.max(3, size * 0.045)}px solid ${dark}`,
      boxShadow: `0 ${size * 0.05}px 0 ${dark}, 0 ${size * 0.1}px ${size * 0.2}px ${withAlpha('#000000', 0.4)}, inset 0 ${size * 0.03}px ${size * 0.06}px ${withAlpha('#FFFFFF', 0.5)}, inset 0 -${size * 0.04}px ${size * 0.08}px ${withAlpha('#000000', 0.3)}`,
    };
  } else if (variant === 'jewel') {
    surface = {
      background: `conic-gradient(from 210deg, ${lighten(bg, 0.4)}, ${bg} 17%, ${darken(bg, 0.35)} 33%, ${lighten(bg, 0.28)} 50%, ${darken(bg, 0.3)} 67%, ${lighten(bg, 0.45)} 83%, ${darken(bg, 0.25)} 100%)`,
      border: `2px solid ${withAlpha('#FFFFFF', 0.55)}`,
      boxShadow: `0 ${size * 0.06}px ${size * 0.16}px ${withAlpha('#000000', 0.45)}, inset 0 0 ${size * 0.12}px ${withAlpha('#FFFFFF', 0.25)}`,
    };
  } else if (variant === 'glass') {
    surface = {
      background: withAlpha('#FFFFFF', 0.14),
      backdropFilter: 'blur(8px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(8px) saturate(1.3)',
      border: `2px solid ${withAlpha('#FFFFFF', 0.5)}`,
      boxShadow: `0 ${size * 0.06}px ${size * 0.18}px ${withAlpha('#000000', 0.35)}, inset 0 1px 0 ${withAlpha('#FFFFFF', 0.6)}`,
    };
  } else if (variant === 'chrome') {
    surface = {
      background: 'linear-gradient(205deg, #FEFEFF 0%, #C6CCD5 30%, #97A0AC 50%, #E9EDF2 66%, #A9B2BE 88%, #D7DCE3 100%)',
      boxShadow: `0 ${size * 0.06}px ${size * 0.16}px ${withAlpha('#0A101C', 0.4)}, inset 0 2px 3px ${withAlpha('#FFFFFF', 0.9)}, inset 0 -3px 6px ${withAlpha('#141C28', 0.35)}`,
    };
  } else {
    // neon
    surface = {
      background: darken(bg, 0.68),
      border: `${Math.max(3, size * 0.04)}px solid ${iconColor}`,
      boxShadow: `0 0 ${size * 0.16}px ${withAlpha(iconColor, 0.55)}, inset 0 0 ${size * 0.12}px ${withAlpha(iconColor, 0.3)}`,
    };
  }

  // inner face for the gold variant (ring = outer padding)
  const facePad = variant === 'gold' ? Math.max(4, size * 0.055) : 0;
  const faceRadius = wide
    ? `calc(${size / 2}px - ${facePad}px)`
    : `calc(50% - ${facePad}px)`;

  const glyph =
    variant === 'gold' ? (
      // stacked beveled gold glyph
      <div style={{ position: 'relative', width: gs, height: gs, filter: activeFx }}>
        <Icon size={gs} color="#6E4E0B" style={{ position: 'absolute', left: 0, top: size * 0.028 }} strokeWidth={2.6} />
        <Icon size={gs} color="#B8891B" style={{ position: 'absolute', left: 0, top: size * 0.014 }} strokeWidth={2.6} />
        <Icon
          size={gs} color="#FFDE6B" strokeWidth={2.6}
          style={{ position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 -1px 0 rgba(255,246,200,0.8))' }}
        />
      </div>
    ) : variant === 'candy' ? (
      <Icon size={gs} color={iconColor} strokeWidth={2.6} style={{ filter: `${activeFx ?? ''} drop-shadow(0 2px 3px rgba(0,0,0,0.45))`.trim() }} />
    ) : variant === 'jewel' ? (
      <Icon size={gs} color="#FFFFFF" strokeWidth={2.6} style={{ filter: `${activeFx ?? ''} drop-shadow(0 0 6px rgba(255,255,255,0.9))`.trim() }} />
    ) : variant === 'chrome' ? (
      <Icon size={gs} color="#232A38" strokeWidth={2.6} style={{ filter: `${activeFx ?? ''} drop-shadow(0 1px 0 rgba(255,255,255,0.7))`.trim() }} />
    ) : variant === 'neon' ? (
      <Icon size={gs} color={iconColor} strokeWidth={2.6} style={{ filter: `drop-shadow(0 0 6px ${iconColor}) drop-shadow(0 0 12px ${iconColor})` }} />
    ) : (
      <Icon size={gs} color={iconColor} strokeWidth={2.6} style={{ filter: activeFx }} />
    );

  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: size, borderRadius: rad, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor, boxSizing: 'border-box', ...surface,
      }}
    >
      {variant === 'gold' && (
        <div
          style={{
            position: 'absolute', inset: facePad, borderRadius: faceRadius,
            background: `radial-gradient(circle at 38% 30%, ${lighten(bg, 0.25)}, ${bg} 52%, ${darken(bg, 0.3)})`,
            boxShadow: `inset 0 2px 6px ${withAlpha('#FFFFFF', 0.35)}, inset 0 -3px 8px ${withAlpha('#000000', 0.4)}`,
          }}
        />
      )}
      {variant === 'gold' && (
        <div
          style={{
            position: 'absolute', inset: facePad, borderRadius: faceRadius, pointerEvents: 'none',
            background: `linear-gradient(155deg, ${withAlpha('#FFFFFF', 0.5)}, transparent 42%)`,
          }}
        />
      )}
      {variant === 'candy' && (
        <div
          style={{
            position: 'absolute', left: '12%', top: '7%', width: '56%', height: '40%',
            borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.75), rgba(255,255,255,0) 70%)',
          }}
        />
      )}
      {variant === 'glass' && (
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: rad, pointerEvents: 'none', overflow: 'hidden',
            background: 'linear-gradient(115deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.42) 30%, transparent 30.5%)',
          }}
        />
      )}
      {variant === 'jewel' && (
        <>
          <div style={{ position: 'absolute', left: '18%', top: '14%', width: size * 0.16, height: size * 0.16, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', filter: 'blur(2px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', right: '20%', bottom: '18%', width: size * 0.09, height: size * 0.09, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', filter: 'blur(1.5px)', pointerEvents: 'none' }} />
        </>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.5, transition: 'opacity 0.15s' }}>
        {glyph}
      </div>
      {wide && !on && (
        <div
          style={{
            position: 'absolute', left: '8%', right: '8%', top: '50%',
            height: Math.max(3, size * 0.045), background: '#E04040',
            borderRadius: 99, boxShadow: '0 0 6px rgba(224,64,64,0.6)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

export function IconButtonView({
  skin, kind, size, on = true, variant = 'round', group = 'game',
  onClick, active, forceVariant, w,
}: {
  skin: SkinState;
  kind: IconKind;
  size: number;
  on?: boolean;
  variant?: 'round' | 'wide';
  group?: IconGroup;
  onClick?: () => void;
  active?: boolean;
  /** preview override used by the editor variant grid */
  forceVariant?: IconPremiumId;
  /** explicit width for non-square original sprites (design px) */
  w?: number;
}) {
  const st = skin.iconBtn;
  const wide = variant === 'wide' ? WIDE_OF[kind] : undefined;
  const spriteObj = wide ?? SPRITE_OF[kind].obj;
  const premium = forceVariant ?? st.variants?.[group] ?? 'base';
  const frame = SPRITE_OF[kind].toggle ? (on ? 0 : 1) : 0;
  const bw = w ?? (wide ? size * (210 / 100) : size);

  // Bottone icona 1:1 con glifo incluso (estratto dallo screenshot).
  // Asset normalizzato: il disco occupa la frazione imgScale del canvas
  // (default 0.70) → img scalata size/imgScale, così il disco misura `size`
  // e il glow sborda (trasparente). OFF: usa imgsOff se presente.
  const fullImg = (!on && st.imgsOff?.[kind]) || st.imgs?.[kind];
  if (fullImg) {
    const scale = st.imgScale?.[kind] ?? 0.70;
    const iw = size / scale;
    const ih = w ? size : iw; // w esplicito: aspect naturale del patch
    return (
      <div
        onClick={onClick}
        style={{
          position: 'relative', width: bw, height: size, cursor: onClick ? 'pointer' : 'default',
          filter: active ? 'drop-shadow(0 0 12px #FFC94D)' : undefined,
        }}
      >
        <img src={fullImg} alt={kind} draggable={false}
          style={{
            position: 'absolute',
            left: (bw - iw) / 2, top: (size - ih) / 2,
            width: iw, height: ih, objectFit: 'fill',
          }} />
      </div>
    );
  }

  if (premium !== 'base') {
    return (
      <PremiumIconButton
        variant={premium}
        kind={kind}
        on={on}
        size={size}
        wide={!!wide}
        bg={st.bg}
        iconColor={st.iconColor}
        onClick={onClick}
        active={active}
      />
    );
  }

  if (st.style === 'original' && !st.img) {
    return (
      <div
        onClick={onClick}
        style={{
          position: 'relative', width: bw, height: size, cursor: onClick ? 'pointer' : 'default',
          filter: active ? 'drop-shadow(0 0 12px #FFC94D)' : undefined,
        }}
      >
        { }
        <img
          src={`${BP}/sprites/${spriteObj}-f${String(frame).padStart(2, '0')}.png`}
          alt={kind}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill' }}
        />
      </div>
    );
  }

  const Icon = LucideOf(kind, on);
  const radius = st.style === 'circle' ? '50%' : st.style === 'rounded' ? '28%' : st.style === 'pixel' ? '4px' : '50%';
  const surface: CSSProperties =
    st.img
      ? {
          backgroundImage: `url(${st.img})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }
      : st.style === 'outline'
      ? { background: 'transparent', border: `3px solid ${st.iconColor}` }
      : st.style === 'pixel'
        ? {
            background: st.bg, border: `3px solid ${darken(st.bg, 0.45)}`,
            boxShadow: `inset 3px 3px 0 ${withAlpha(lighten(st.bg, 0.4), 0.5)}, inset -3px -3px 0 ${withAlpha('#000', 0.4)}, 0 4px 0 ${darken(st.bg, 0.5)}`,
          }
        : {
            background: st.bg,
            border: `2px solid ${withAlpha('#FFFFFF', 0.22)}`,
            boxShadow: `0 6px 16px ${withAlpha('#000000', 0.35)}, inset 0 2px 8px ${withAlpha('#FFFFFF', 0.18)}`,
          };

  return (
    <div
      onClick={onClick}
      style={{
        width: bw, height: size, borderRadius: radius, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        filter: active ? 'drop-shadow(0 0 12px #FFC94D)' : undefined,
        ...surface,
      }}
    >
      <Icon size={size * 0.5} color={st.iconColor} strokeWidth={2.6} />
    </div>
  );
}

export function PlayButtonView({ skin, onClick }: { skin: SkinState; onClick?: () => void }) {
  const p = skin.playBtn;
  if (p.img) {
    // Bottone 1:1 estratto dal reference (patch con alpha pulita, 682×282,
    // core 646×246 centrato — il patch include il glow che sfuma).
    const PW = 682, PH = 282;
    const bw = PW * (p.size / 100);
    const bh = PH * (p.size / 100);
    return (
      <div onClick={onClick} style={{ position: 'relative', width: PW, height: PH, cursor: 'pointer' }}>
        <img src={p.img} alt="play" draggable={false}
          style={{
            position: 'absolute', left: (PW - bw) / 2, top: (PH - bh) / 2,
            width: bw, height: bh, objectFit: 'fill',
          }} />
      </div>
    );
  }
  if (p.style === 'original') {
    return (
      <div onClick={onClick} style={{ position: 'relative', width: 625, height: 216, cursor: 'pointer' }}>
        { }
        <img src={`${BP}/sprites/BtnPlay-f00.png`} alt="play" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
      </div>
    );
  }
  const glow = (p.glow / 100) * 60;
  const surface: CSSProperties =
    p.style === 'pill'
      ? {
          borderRadius: 999, background: `linear-gradient(180deg, ${lighten(p.c1, 0.15)}, ${p.c2})`,
          border: `4px solid ${withAlpha('#FFFFFF', 0.4)}`,
          boxShadow: `0 ${glow * 0.4}px ${glow * 1.4}px ${withAlpha(p.c1, 0.55)}, inset 0 ${6}px ${18}px ${withAlpha('#FFFFFF', 0.45)}, inset 0 -${8}px ${20}px ${withAlpha(darken(p.c2, 0.3), 0.5)}`,
        }
      : p.style === 'rounded'
        ? {
            borderRadius: 64, background: `linear-gradient(165deg, ${p.c1}, ${p.c2})`,
            border: `5px solid ${withAlpha('#FFFFFF', 0.5)}`,
            boxShadow: `0 ${glow * 0.35}px ${glow * 1.3}px ${withAlpha(p.c1, 0.5)}, 0 18px 40px ${withAlpha('#000', 0.35)}, inset 0 6px 16px ${withAlpha('#FFFFFF', 0.4)}`,
          }
        : p.style === 'neon'
          ? {
              borderRadius: 999, background: withAlpha(darken(p.c1, 0.82), 0.9),
              border: `5px solid ${p.c1}`,
              boxShadow: `0 0 ${20 + glow}px ${withAlpha(p.c1, 0.8)}, inset 0 0 ${24}px ${withAlpha(p.c1, 0.55)}`,
            }
          : {
              borderRadius: 10, background: p.c1,
              border: `6px solid ${darken(p.c1, 0.35)}`,
              boxShadow: `0 14px 0 ${darken(p.c1, 0.45)}, ${glow ? `0 ${glow * 0.8}px ${glow * 1.6}px ${withAlpha(p.c1, 0.5)}` : ''}`,
            };
  const font = p.style === 'pixel' ? fontCss('press', 86) : fontCss('riffic', 96);
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', width: 625, height: 216, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...surface,
      }}
    >
      <span
        style={{
          ...font, color: p.textColor, lineHeight: 1, letterSpacing: '0.06em',
          textShadow: `0 5px 0 ${withAlpha('#000000', 0.35)}`,
          textTransform: 'uppercase',
        }}
      >
        {p.text || 'PLAY'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- popups ---

export function PopupSurface({
  skin, w, h, children, className, onClick,
}: {
  skin: SkinState; w: number; h: number; children?: ReactNode; className?: string; onClick?: () => void;
}) {
  const p = skin.popup;
  const surface: CSSProperties =
    p.style === 'dark'
      ? {
          background: `linear-gradient(180deg, ${withAlpha(p.c1, 0.94)}, ${withAlpha(darken(p.c1, 0.3), 0.96)})`,
          borderRadius: 56,
          border: `3px solid ${withAlpha('#FFFFFF', 0.14)}`,
          boxShadow: `0 40px 90px ${withAlpha('#000000', 0.55)}`,
          backdropFilter: 'blur(8px)',
        }
      : p.style === 'light'
        ? {
            background: 'linear-gradient(180deg, #FFFFFF, #EEF1FA)', borderRadius: 56,
            border: `4px solid ${withAlpha(p.c1, 0.35)}`,
            boxShadow: `0 40px 90px ${withAlpha('#000000', 0.35)}`,
          }
        : p.style === 'neon'
          ? {
              background: 'rgba(8,10,24,0.94)', borderRadius: 56,
              border: `4px solid ${p.c1}`,
              boxShadow: `0 0 60px ${withAlpha(p.c1, 0.55)}, 0 30px 80px ${withAlpha('#000000', 0.6)}`,
              backdropFilter: 'blur(8px)',
            }
          : {};
  return (
    <div onClick={onClick} className={className} style={{ position: 'relative', width: w, height: h, ...surface }}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ texts ---

const SHEETS: Record<string, { url: string; w: number; h: number; pitch: number; cellH: number; cols: number; charset: string }> = {
  txtScore: { url: `${BP}/sprites/txtScore-f00.png`, w: 1024, h: 128, pitch: 92.13, cellH: 128, cols: 10, charset: '0123456789' },
  txtEarnedScore: { url: `${BP}/sprites/txtEarnedScore-fixed.png`, w: 512, h: 128, pitch: 46.545, cellH: 128, cols: 11, charset: '0123456789+' },
  txtComboNum: { url: `${BP}/sprites/txtComboNum-f00.png`, w: 700, h: 400, pitch: 140, cellH: 200, cols: 5, charset: '1234567890' },
};

/** Original bitmap digit font (sprite sheet glyphs). */
export function BitmapText({
  sheet, text, scale = 1, opacity = 1,
}: {
  sheet: 'txtScore' | 'txtEarnedScore' | 'txtComboNum';
  text: string;
  scale?: number;
  opacity?: number;
}) {
  const S = SHEETS[sheet];
  const glyphH = S.cellH * 0.78;
  const totalW = text.length * S.pitch;
  return (
    <div style={{ position: 'relative', width: totalW * scale, height: glyphH * scale, opacity }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute' }}>
        {[...text].map((ch, i) => {
          const idx = S.charset.indexOf(ch);
          if (idx < 0) return <div key={i} style={{ width: S.pitch, height: glyphH, float: 'left' }} />;
          const col = idx % S.cols;
          const row = Math.floor(idx / S.cols);
          return (
            <div
              key={i}
              style={{
                width: S.pitch, height: glyphH, float: 'left',
                backgroundImage: `url(${S.url})`,
                backgroundSize: `${S.w}px ${S.h}px`,
                backgroundPosition: `-${col * S.pitch}px -${row * S.cellH + 11}px`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function gradientText(c1: string, c2: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, ${c1} 20%, ${c2} 90%)`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };
}

export function ScoreTextView({
  skin, value, animateKey,
}: {
  skin: SkinState; value: number | string; animateKey?: number;
}) {
  const s = skin.score;
  const text = String(value);
  const size = 110 * (s.size / 100);
  if (s.style === 'bitmap') {
    return (
      <div key={animateKey} className="bb-pop">
        <BitmapText sheet="txtScore" text={text} scale={(s.size / 100) * 0.92} />
      </div>
    );
  }
  return (
    <div
      key={animateKey}
      className="bb-pop"
      style={{
        ...fontCss(s.font, size),
        ...(s.gradient ? gradientText(s.color, s.c2) : { color: s.color }),
        WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.stroke}` : undefined,
        paintOrder: 'stroke fill',
        textShadow: s.glow
          ? `0 0 22px ${s.glow}, 0 0 58px ${s.glow}`
          : s.strokeWidth === 0 ? `0 4px 14px ${withAlpha('#000000', 0.45)}` : undefined,
        lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
}

export function BestTextView({ skin, value, align = 'center' }: { skin: SkinState; value: number | string; align?: 'left' | 'center' }) {
  const b = skin.best;
  return (
    <div
      style={{
        ...fontCss(b.font, 44 * (b.size / 100)),
        color: b.color, lineHeight: 1, textAlign: align,
        ...(b.strokeWidth ? { WebkitTextStroke: `${b.strokeWidth}px ${b.stroke}`, paintOrder: 'stroke fill' as const } : {}),
        textShadow: b.glow
          ? `0 0 18px ${b.glow}`
          : '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {value}
    </div>
  );
}

export function Plus100View({ skin, value }: { skin: SkinState; value: number }) {
  const p = skin.plus100;
  const text = `+${value}`;
  const scale = p.size / 100;
  if (p.style === 'bitmap') {
    return <BitmapText sheet="txtEarnedScore" text={text} scale={scale * 1.15} />;
  }
  const font = p.style === 'pixel' ? fontCss('press', 92) : fontCss('riffic', 108);
  const css: CSSProperties =
    p.style === 'neon'
      ? {
          color: p.color,
          textShadow: `0 0 18px ${p.glow}, 0 0 46px ${p.glow}, 0 2px 0 ${withAlpha('#000', 0.3)}`,
        }
      : p.style === 'candy'
        ? {
            ...gradientText(lighten(p.color, 0.25), p.color),
            WebkitTextStroke: `7px ${darken(p.glow, 0.15)}`,
            paintOrder: 'stroke fill',
            filter: `drop-shadow(0 6px 18px ${withAlpha(p.glow, 0.75)})`,
          }
        : p.style === 'pixel'
          ? {
              color: p.color,
              textShadow: `6px 6px 0 ${withAlpha(darken(p.glow, 0.2), 0.9)}`,
            }
          : {
              color: p.color,
              textShadow: `0 0 24px ${withAlpha(p.glow, 0.9)}, 0 3px 10px ${withAlpha(darken(p.glow, 0.3), 0.8)}`,
            };
  return (
    <div style={{ ...font, ...css, lineHeight: 1, transform: `scale(${scale})` }}>
      {text}
    </div>
  );
}

export function ComboTextView({ skin, value }: { skin: SkinState; value: number }) {
  const c = skin.combo;
  return (
    <div
      style={{
        ...fontCss(c.font, 150 * (c.size / 100)),
        color: c.color, lineHeight: 1,
        textShadow: `0 0 26px ${withAlpha(c.glow, 0.95)}, 0 0 60px ${withAlpha(c.glow, 0.6)}, 0 4px 0 ${withAlpha('#000', 0.35)}`,
      }}
    >
      ×{value}
    </div>
  );
}

export function LogoView({ skin }: { skin: SkinState }) {
  const l = skin.logo;
  if (l.img) {
    // Logo 1:1 estratto dallo screenshot (rombo, lettere colorate, ellisse dorata)
    const lw = 837 * (l.size / 100);
    const lh = 888 * (l.size / 100);
    return (
      <div style={{ position: 'relative', width: 837, height: 888 }}>
        <img src={l.img} alt="logo" draggable={false}
          style={{
            position: 'absolute', left: (837 - lw) / 2, top: (888 - lh) / 2,
            width: lw, height: lh, objectFit: 'contain',
          }} />
      </div>
    );
  }
  if (l.style === 'original') {
    return (
      <div style={{ position: 'relative', width: 837, height: 888 }}>
        { }
        <img src={`${BP}/sprites/Sprite2-f00.png`} alt="Block Blast" draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'fill' }} />
      </div>
    );
  }
  const size = 150 * (l.size / 100);
  const words = l.text.split(' ');
  return (
    <div
      style={{
        textAlign: 'center', lineHeight: 1.02,
        ...fontCss(l.font, size),
        ...(l.gradient ? gradientText(l.c1, l.c2) : { color: l.c1 }),
        WebkitTextStroke: l.strokeWidth > 0 ? `${l.strokeWidth}px ${l.stroke}` : undefined,
        paintOrder: 'stroke fill',
        filter: l.shadow > 0
          ? `drop-shadow(0 ${8 * (l.shadow / 100)}px ${18 * (l.shadow / 100)}px ${withAlpha('#000000', 0.25 + 0.45 * (l.shadow / 100))})`
          : undefined,
      }}
    >
      {words.map((w, i) => <div key={i}>{w || '\u00A0'}</div>)}
    </div>
  );
}

// ------------------------------------------------------------------ icons ---

/** Crown/best icon: 1:1 image when skin.best.iconImg is set, else the cup sprite. */
export function BestIconView({ skin, size, glow = 18 }: { skin: SkinState; size: number; glow?: number }) {
  if (skin.best.iconImg) {
    return (
      <img src={skin.best.iconImg} alt="best" draggable={false}
        style={{ width: size, height: size, objectFit: 'contain', filter: `drop-shadow(0 0 ${glow}px #FFE066)` }} />
    );
  }
  return <MaskIconView sprite="CupIcon-f00.png" color="#F3BF08" size={size} glow={glow} glowColor="#FFE066" />;
}

export function MaskIconView({
  sprite, color, size, glow, glowColor, className, style,
}: {
  sprite: string; color: string; size: number; glow?: number; glowColor?: string; className?: string; style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        width: size, height: size,
        WebkitMaskImage: `url(${BP}/sprites/${sprite})`,
        maskImage: `url(${BP}/sprites/${sprite})`,
        WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        background: color,
        filter: glow ? `drop-shadow(0 0 ${glow}px ${glowColor ?? color})` : undefined,
        ...style,
      }}
    />
  );
}

// ---------------------------------------------------------------- ranking ---

export const RANKING_LIST: { name: string; score: number }[] = [
  { name: 'Kara', score: 1720 },
  { name: 'Camila', score: 1586 },
  { name: 'Philip', score: 1520 },
  { name: 'Gianni', score: 1378 },
  { name: 'Lya', score: 1250 },
  { name: 'Ava', score: 1232 },
  { name: 'Royce', score: 650 },
  { name: 'Logan', score: 580 },
];

/** Classifica candy viola condivisa (home + menu pausa) — palette reference. */
export function RankingPanel({
  skin, onClose, best,
}: {
  skin: SkinState; onClose: () => void; best: number;
}) {
  const rows = [...RANKING_LIST, { name: 'Tu', score: best, you: true }];
  const medal = (i: number) => (i === 0 ? '#FFD54A' : i === 1 ? '#D7DCE8' : i === 2 ? '#E8A05C' : null);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.66)', zIndex: 85 }}>
      <div style={pos(540, 940, 920, 1400)}>
        <PopupSurface skin={skin} w={920} h={1400} />
        <div style={pos(460, 350, 116, 116)}>
          <MaskIconView sprite="CupIcon-f00.png" color="#F3BF08" size={116} glow={26} glowColor="#FFE066" />
        </div>
        <div style={{ ...pos(460, 492, 800, 150), ...fontCss('riffic', 84), color: '#FFFFFF', textAlign: 'center', letterSpacing: '0.1em', textShadow: '0 0 30px rgba(159,107,255,0.85), 0 6px 0 rgba(0,0,0,0.35)' }}>
          CLASSIFICA
        </div>
        <div style={pos(850, 315, 80, 80)}>
          <IconButtonView skin={skin} kind="close" size={80} group="game" onClick={onClose} />
        </div>
        <div style={{ position: 'absolute', left: 64, right: 64, top: 592, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => {
            const m = medal(i);
            const you = 'you' in r && r.you;
            return (
              <div
                key={r.name}
                style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 24,
                  padding: '10px 28px', borderRadius: 22, boxSizing: 'border-box',
                  background: you
                    ? 'linear-gradient(180deg, rgba(255,213,74,0.28), rgba(255,160,60,0.16))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))',
                  border: you
                    ? '3px solid rgba(255,201,77,0.75)'
                    : m ? `3px solid ${m}55` : '3px solid rgba(255,255,255,0.12)',
                  boxShadow: you ? '0 0 26px rgba(255,201,77,0.35)' : 'inset 0 2px 8px rgba(255,255,255,0.06)',
                }}
              >
                <span style={{
                  ...fontCss('riffic', 42), width: 68, textAlign: 'center', lineHeight: 1.05,
                  color: m ?? 'rgba(255,255,255,0.55)',
                  textShadow: m ? `0 0 16px ${m}88` : undefined,
                }}>
                  {i + 1}
                </span>
                <span style={{ ...fontCss('riffic', 42), color: '#FFFFFF', flex: 1, lineHeight: 1.05, textShadow: '0 3px 0 rgba(0,0,0,0.3)' }}>{r.name}</span>
                <span style={{ ...fontCss('riffic', 42), color: m ?? '#FFD54A', lineHeight: 1.05, textShadow: '0 3px 0 rgba(0,0,0,0.3)' }}>{r.score.toLocaleString('it-IT')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
