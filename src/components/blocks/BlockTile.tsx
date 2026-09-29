'use client';

// BlockTile — renders a single game block.
// 'original' uses the real sprite frames; a custom color recolors the sprite
// texture via CSS background-blend-mode. All other styles are pure CSS.

import type { CSSProperties } from 'react';
import { darken, lighten, withAlpha } from '@/lib/color';
import { ORIGINAL_COLORS, type BlockStyleId } from '@/lib/skin';

export interface BlockTileProps {
  colorIdx: number;
  color: string;
  style: BlockStyleId;
  size: number;        // design px (width)
  sizeH?: number;      // design px height (defaults to size — non-square tiles)
  radius?: number;     // % override
  gap?: number;        // design px inset
  border?: number;     // design px
  ghost?: 'none' | 'original' | 'tint' | 'outline';
  ghostOpacity?: number; // %
  /** tile image (data URL or path) for style 'image' and the ghost */
  imgSrc?: string | null;
  imgTint?: boolean;   // multiply block color over the image
  imgFit?: 'fill' | 'contain';
  imgShadow?: number;  // 0–100 drop-shadow strength
  className?: string;
}

export function blockTileCss(props: BlockTileProps): CSSProperties {
  const {
    colorIdx, color, style, size, sizeH, radius = 8, gap = 4,
    border = 3, ghost = 'none', ghostOpacity = 45,
    imgSrc = null, imgTint = false, imgFit = 'fill', imgShadow = 35,
  } = props;
  const sh = sizeH ?? size;
  const r = (radius / 100) * size;
  const isOriginalColor = ORIGINAL_COLORS[colorIdx]?.toUpperCase() === color.toUpperCase();

  const base: CSSProperties = {
    width: size, height: sh, borderRadius: r, position: 'relative',
    boxSizing: 'border-box',
  };

  if (ghost !== 'none') {
    const a = ghostOpacity / 100;
    // With a custom tile image, ghost = the tile itself at reduced opacity.
    if (imgSrc) {
      return {
        ...base,
        backgroundImage: `url(${imgSrc})`,
        backgroundSize: imgFit === 'contain' ? 'contain' : '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        opacity: a,
      };
    }
    if (ghost === 'original') {
      return {
        ...base,
        backgroundImage: isOriginalColor
          ? `url(/sprites/BlockBelow-f0${colorIdx}.png)`
          : `linear-gradient(0deg, ${withAlpha(color, 0.5)}, ${withAlpha(color, 0.5)}), url(/sprites/BlockBelow-f0${colorIdx}.png)`,
        backgroundBlendMode: 'overlay, normal',
        backgroundSize: '100% 100%',
        opacity: a,
      };
    }
    if (ghost === 'tint') {
      return { ...base, background: withAlpha(color, a * 0.55), borderRadius: r };
    }
    return {
      ...base,
      border: `${Math.max(2, border)}px solid ${withAlpha(color, a)}`,
      background: withAlpha(color, a * 0.15),
      borderRadius: r,
    };
  }

  switch (style) {
    case 'original': {
      if (isOriginalColor) {
        return { ...base, backgroundImage: `url(/sprites/Block-f0${colorIdx}.png)`, backgroundSize: '100% 100%' };
      }
      // Recolor the original texture with the custom color (blend keeps bevel).
      return {
        ...base,
        backgroundImage: `linear-gradient(0deg, ${color}, ${color}), url(/sprites/Block-f0${colorIdx}.png)`,
        backgroundBlendMode: 'overlay, normal',
        backgroundSize: '100% 100%',
        boxShadow: `inset 0 0 0 ${Math.max(1, border)}px ${withAlpha(darken(color, 0.25), 0.9)}`,
      };
    }
    case 'relief':
      return {
        ...base,
        background: color,
        border: `${border}px solid ${darken(color, 0.22)}`,
        boxShadow: `inset 0 ${size * 0.05}px ${size * 0.08}px ${withAlpha(lighten(color, 0.45), 0.55)}, inset 0 -${size * 0.06}px ${size * 0.09}px ${withAlpha(darken(color, 0.4), 0.5)}`,
      };
    case 'flat':
      return { ...base, background: color };
    case 'gradient':
      return {
        ...base,
        background: `linear-gradient(180deg, ${lighten(color, 0.22)} 0%, ${color} 52%, ${darken(color, 0.14)} 100%)`,
        border: `${border}px solid ${darken(color, 0.3)}`,
      };
    case 'glossy':
      return {
        ...base,
        background: `linear-gradient(180deg, ${lighten(color, 0.3)} 0%, ${color} 38%, ${darken(color, 0.16)} 100%)`,
        border: `${border}px solid ${darken(color, 0.28)}`,
        boxShadow: `inset 0 ${size * 0.08}px ${size * 0.14}px ${withAlpha('#FFFFFF', 0.5)}, inset 0 -${size * 0.05}px ${size * 0.1}px ${withAlpha(darken(color, 0.5), 0.45)}`,
      };
    case 'neon':
      return {
        ...base,
        background: `linear-gradient(180deg, ${withAlpha(color, 0.28)}, ${withAlpha(color, 0.12)})`,
        border: `${Math.max(2, border)}px solid ${color}`,
        boxShadow: `0 0 ${size * 0.18}px ${withAlpha(color, 0.75)}, inset 0 0 ${size * 0.12}px ${withAlpha(color, 0.6)}`,
      };
    case 'pixel':
      return {
        ...base,
        background: color,
        border: `${Math.max(2, border)}px solid ${darken(color, 0.35)}`,
        boxShadow: `inset ${Math.max(2, size * 0.05)}px ${Math.max(2, size * 0.05)}px 0 ${withAlpha(lighten(color, 0.35), 0.9)}, inset -${Math.max(2, size * 0.05)}px -${Math.max(2, size * 0.05)}px 0 ${withAlpha(darken(color, 0.4), 0.9)}`,
      };
    case 'glass':
      return {
        ...base,
        background: withAlpha(color, 0.42),
        border: `${Math.max(2, border)}px solid ${withAlpha('#FFFFFF', 0.38)}`,
        boxShadow: `inset 0 ${size * 0.05}px ${size * 0.1}px ${withAlpha('#FFFFFF', 0.3)}, inset 0 -${size * 0.04}px ${size * 0.08}px ${withAlpha('#000000', 0.25)}`,
        backdropFilter: 'blur(3px)',
      };
    case 'outline':
      return {
        ...base,
        background: withAlpha(color, 0.14),
        border: `${Math.max(2, border)}px solid ${color}`,
        boxShadow: `inset 0 0 ${size * 0.08}px ${withAlpha(color, 0.35)}`,
      };
    // Chocolate bar segment: molded texture (multiply) + glossy sheen on top.
    case 'choco':
      return {
        ...base,
        backgroundImage: `linear-gradient(155deg, ${withAlpha('#FFFFFF', 0.42)} 0%, ${withAlpha('#FFFFFF', 0.12)} 24%, transparent 46%), url(/textures/choco-bar.png), linear-gradient(0deg, ${color}, ${color})`,
        backgroundBlendMode: 'normal, multiply, normal',
        backgroundSize: '100% 100%',
        borderRadius: r,
      };
    // Cioccolatino (praline): dome texture + sharp specular highlight.
    case 'praline':
      return {
        ...base,
        backgroundImage: `radial-gradient(circle at 30% 22%, ${withAlpha('#FFFFFF', 0.65)} 0%, ${withAlpha('#FFFFFF', 0.18)} 14%, transparent 30%), url(/textures/choco-bonbon.png), linear-gradient(0deg, ${color}, ${color})`,
        backgroundBlendMode: 'normal, multiply, normal',
        backgroundSize: '100% 100%',
        borderRadius: r,
      };
    // User-uploaded tile: the image IS the block (one tile = one cell).
    case 'image': {
      if (!imgSrc) {
        // No tile yet: dashed placeholder tinted with the block color.
        return {
          ...base,
          backgroundColor: withAlpha(color, 0.30),
          border: `2px dashed ${withAlpha(color, 0.85)}`,
        };
      }
      const layers: string[] = [];
      const blend: string[] = [];
      if (imgTint) {
        layers.push(`linear-gradient(0deg, ${color}, ${color})`);
        blend.push('multiply');
      }
      layers.push(`url(${imgSrc})`);
      blend.push('normal');
      return {
        ...base,
        backgroundImage: layers.join(', '),
        backgroundBlendMode: blend.join(', '),
        backgroundSize: imgFit === 'contain' ? 'contain' : '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        // Drop-shadow follows the rendered shape (border-radius clip + alpha).
        filter: imgShadow > 0
          ? `drop-shadow(0 ${Math.round(size * 0.045)}px ${Math.round(size * 0.07)}px ${withAlpha('#000000', (imgShadow / 100) * 0.42)})`
          : undefined,
      };
    }
    default:
      return { ...base, background: color };
  }
}

export function BlockTile(props: BlockTileProps) {
  const { gap = 0, size, sizeH } = props;
  const sh = sizeH ?? size;
  const css = blockTileCss(props);
  if (gap > 0) {
    const inner = size - gap;
    const innerH = sh - gap;
    const rr = typeof css.borderRadius === 'number' ? css.borderRadius : 0;
    return (
      <div
        className={props.className}
        style={{
          width: size, height: sh,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ ...css, width: inner, height: innerH, borderRadius: rr * (inner / size) }} />
      </div>
    );
  }
  return <div className={props.className} style={css} />;
}
