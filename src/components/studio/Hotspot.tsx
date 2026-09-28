'use client';

// Hotspot — makes any element of the preview selectable.
// Renders at design-space coordinates; shows a dashed outline + label chip
// on hover and a solid outline when selected.

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useStudio } from '@/lib/store';

export function Hotspot({
  id, label, colorIdx, style, children, disabled, grow,
}: {
  id: string;
  label: string;
  colorIdx?: number;
  style: CSSProperties;
  children: ReactNode;
  disabled?: boolean;
  grow?: boolean;
}) {
  const selected = useStudio((s) => s.selected);
  const hotspots = useStudio((s) => s.hotspots);
  const select = useStudio((s) => s.select);
  const [hover, setHover] = useState(false);
  const isSel = selected === id;
  const off = disabled || !hotspots;

  return (
    <div
      data-hotspot={id}
      data-coloridx={colorIdx ?? undefined}
      style={{ ...style, cursor: off ? undefined : 'pointer' }}
      onMouseEnter={() => !off && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => {
        if (off) return;
        e.stopPropagation();
        select(id, colorIdx ?? null);
      }}
    >
      {children}
      {!off && (hover || isSel) && (
        <div
          style={{
            position: 'absolute', inset: -8, borderRadius: 16, pointerEvents: 'none', zIndex: 40,
            border: isSel ? '6px solid #F59E0B' : '5px dashed rgba(245,158,11,0.9)',
            boxShadow: isSel ? '0 0 26px rgba(245,158,11,0.5)' : undefined,
            background: isSel ? 'rgba(245,158,11,0.08)' : undefined,
          }}
        >
          <div
            style={{
              position: 'absolute', top: -46, left: 0,
              background: isSel ? '#F59E0B' : 'rgba(245,158,11,0.92)',
              color: '#18181B', fontWeight: 700, fontSize: 30,
              fontFamily: 'Carlito, sans-serif',
              padding: '4px 18px', borderRadius: 12, whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            }}
          >
            {label}
            {grow ? ' ◆' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
