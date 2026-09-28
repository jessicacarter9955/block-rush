'use client';

// LayoutBox — positions an element at its (possibly overridden) layout rect
// and, in studio LAYOUT mode, makes it draggable / resizable / text-editable.
//
// - drag anywhere on the box to move (snap grid + center guides at 540/960)
// - 4 corner handles to resize (locks square/ratio where defined)
// - double click on text elements to edit the label inline
// - arrow keys nudge the selected element, Esc deselects
//
// Outside the studio (playing) it is a plain positioned wrapper.

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { effRect, LAYOUT, useLayout } from '@/lib/layout';
import { useStudio } from '@/lib/store';

type Handle = 'nw' | 'ne' | 'sw' | 'se';

const HANDLE_CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize',
};

export function LayoutBox({ el, children }: { el: string; children: ReactNode }) {
  const def = LAYOUT[el];
  const ov = useLayout((s) => s.overrides[el]);
  const editMode = useLayout((s) => s.editMode);
  const snap = useLayout((s) => s.snap);
  const selectedKey = useLayout((s) => s.selectedKey);
  const select = useLayout((s) => s.select);
  const setRect = useLayout((s) => s.setRect);
  const setText = useLayout((s) => s.setText);
  const playing = useStudio((s) => s.playing);
  const studioSelect = useStudio((s) => s.select);
  const skin = useStudio((s) => s.skin);
  const setIn = useStudio((s) => s.setIn);

  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null);
  const [textEdit, setTextEdit] = useState<{ left: number; top: number; width: number } | null>(null);
  const [dynHint, setDynHint] = useState<{ left: number; top: number; width: number } | null>(null);

  const rect = useMemo(() => effRect(el, ov), [el, ov]);
  const editing = Boolean(editMode && !playing && def);
  const isSel = selectedKey === el;
  const hidden = ov?.visible === false;

  const snapv = useCallback(
    (v: number) => (snap > 0 ? Math.round(v / snap) * snap : Math.round(v)),
    [snap],
  );

  /** design units per CSS pixel (the design space is transform-scaled) */
  const unitScale = () => {
    const node = boxRef.current;
    if (!node) return { kx: 1, ky: 1 };
    const b = node.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return { kx: 1, ky: 1 };
    return { kx: rect.w / b.width, ky: rect.h / b.height };
  };

  const onSelect = () => {
    select(el);
    if (def?.elementId) studioSelect(def.elementId, null);
  };

  // ------------------------------------------------------------ dragging ---
  const startDrag = (e: ReactPointerEvent) => {
    if (!editing || def?.movable === false) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const { kx, ky } = unitScale();
    const sx = e.clientX, sy = e.clientY;
    const ox = rect.x, oy = rect.y;
    setLiveSize({ w: rect.w, h: rect.h });
    const move = (ev: PointerEvent) => {
      let nx = ox + (ev.clientX - sx) * kx;
      let ny = oy + (ev.clientY - sy) * ky;
      // center guides (only for screen-positioned elements)
      if (!def?.parent) {
        if (Math.abs(nx - 540) < 9) nx = 540;
        if (Math.abs(ny - 960) < 9) ny = 960;
      }
      setRect(el, { x: snapv(nx), y: snapv(ny) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setLiveSize(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ------------------------------------------------------------ resizing ---
  const startResize = (e: ReactPointerEvent, h: Handle) => {
    if (!editing || def?.resizable === false) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const { kx, ky } = unitScale();
    const sx = e.clientX, sy = e.clientY;
    const L = rect.x - rect.w / 2, T = rect.y - rect.h / 2;
    const R = L + rect.w, B = T + rect.h;
    const minW = def?.minW ?? 48;
    const minH = def?.minH ?? 48;
    setLiveSize({ w: rect.w, h: rect.h });
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) * kx;
      const dy = (ev.clientY - sy) * ky;
      let nL = L, nT = T, nR = R, nB = B;
      if (h.includes('e')) nR = R + dx; else nL = L + dx;
      if (h.includes('s')) nB = B + dy; else nT = T + dy;
      if (nR - nL < minW) { if (h.includes('e')) nR = nL + minW; else nL = nR - minW; }
      if (nB - nT < minH) { if (h.includes('s')) nB = nT + minH; else nT = nB - minH; }
      let w = nR - nL;
      let hh = nB - nT;
      if (def?.lockSquare) {
        const s = Math.max(w, hh);
        w = s; hh = s;
      } else if (def?.lockRatio) {
        const r = def.lockRatio;
        if (Math.abs(w - rect.w) * r >= Math.abs(hh - rect.h)) hh = w / r;
        else w = hh * r;
      }
      // re-anchor to the opposite corner
      if (h.includes('e')) nR = nL + w; else nL = nR - w;
      if (h.includes('s')) nB = nT + hh; else nT = nB - hh;
      // snap edges
      if (snap > 0) {
        nL = Math.round(nL / snap) * snap;
        nT = Math.round(nT / snap) * snap;
        nR = Math.round(nR / snap) * snap;
        nB = Math.round(nB / snap) * snap;
        w = nR - nL; hh = nB - nT;
      }
      setRect(el, { x: (nL + nR) / 2, y: (nT + nB) / 2, w, h: hh });
      setLiveSize({ w, h: hh });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setLiveSize(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // --------------------------------------------------------- text editing ---
  const hasText = Boolean(def?.text || def?.skinTextPath);

  /** dynamic number (score / +N) rendered with the original bitmap sprite font */
  const stylePath = def?.skinStylePath;
  const dynStyle = stylePath ? String(getPathValue(skin, `${stylePath}.style`) ?? '') : '';
  const isBitmapFont = dynStyle === 'bitmap';

  const openHint = () => {
    const node = boxRef.current;
    if (!node) return;
    const b = node.getBoundingClientRect();
    setDynHint({ left: b.left, top: b.top, width: b.width });
  };

  const startTextEdit = () => {
    if (!editing) return;
    if (hasText) {
      const node = boxRef.current;
      if (!node) return;
      const b = node.getBoundingClientRect();
      setTextEdit({ left: b.left, top: b.top, width: b.width });
    } else if (stylePath) {
      // dynamic value — explain why there is no free-text editing
      openHint();
    }
  };

  const switchToCssFont = () => {
    if (!stylePath) return;
    // score: 'bitmap' | 'css' — plus100: 'bitmap' | 'classic' | …
    setIn(`${stylePath}.style`, stylePath === 'score' ? 'css' : 'classic');
    if (def?.elementId) studioSelect(def.elementId, null);
    setDynHint(null);
  };

  const currentText = def?.skinTextPath
    ? String(getPathValue(skin, def.skinTextPath) ?? '')
    : (ov?.text ?? def?.text ?? '');

  const commitText = (v: string) => {
    if (def?.skinTextPath) setIn(def.skinTextPath, v);
    else if (def) setText(el, v);
  };

  // -------------------------------------------------------- keyboard nudge ---
  useEffect(() => {
    if (!editing || !isSel) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const step = e.shiftKey ? (snap > 0 ? snap * 4 : 10) : (snap > 0 ? snap : 1);
      const r = effRect(el, useLayout.getState().overrides[el]);
      if (e.key === 'ArrowLeft') { e.preventDefault(); setRect(el, { x: r.x - step }); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setRect(el, { x: r.x + step }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setRect(el, { y: r.y - step }); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setRect(el, { y: r.y + step }); }
      else if (e.key === 'Escape') { e.preventDefault(); select(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, isSel, el, snap, select, setRect]);

  // ------------------------------------------------------------- rendering ---

  if (!def) {
    return <div style={{ position: 'relative' }}>{children}</div>;
  }

  const boxStyle: CSSProperties = {
    position: 'absolute',
    left: rect.x - rect.w / 2,
    top: rect.y - rect.h / 2,
    width: rect.w,
    height: rect.h,
    cursor: editing ? 'move' : undefined,
    touchAction: editing ? 'none' : undefined,
    zIndex: editing ? (isSel ? 50 : hover ? 45 : undefined) : undefined,
    opacity: hidden ? (editing ? 0.35 : 0) : 1,
    display: hidden && !editing ? 'none' : undefined,
  };

  const showOutline = editing && (hover || isSel);
  const showHandles = editing && isSel;
  const size = liveSize ?? { w: rect.w, h: rect.h };

  return (
    <div
      ref={boxRef}
      data-layoutbox={el}
      style={boxStyle}
      onMouseEnter={() => editing && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={startDrag}
      onDoubleClick={(e) => { e.stopPropagation(); startTextEdit(); }}
    >
      {/* content — non-interactive while editing the layout */}
      <div
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: editing ? 'none' : undefined,
          opacity: hidden && editing ? 0.5 : undefined,
        }}
      >
        {children}
      </div>

      {showOutline && (
        <div
          style={{
            position: 'absolute', inset: -6, borderRadius: 14, pointerEvents: 'none',
            border: isSel ? '6px solid #22D3EE' : '4px dashed rgba(34,211,238,0.85)',
            boxShadow: isSel ? '0 0 24px rgba(34,211,238,0.45)' : undefined,
          }}
        />
      )}

      {editing && (isSel || hover) && (
        <div
          style={{
            position: 'absolute', top: -52, left: 0, pointerEvents: 'none',
            background: isSel ? '#22D3EE' : 'rgba(34,211,238,0.9)',
            color: '#082F38', fontWeight: 700, fontSize: 30,
            fontFamily: 'Carlito, sans-serif',
            padding: '4px 18px', borderRadius: 12, whiteSpace: 'nowrap',
          }}
        >
          {def.label}{hidden ? ' · nascosto' : ''}
        </div>
      )}

      {liveSize && isSel && (
        <div
          style={{
            position: 'absolute', bottom: -56, left: '50%', transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: 'rgba(8,47,56,0.92)', color: '#67E8F9', fontWeight: 700, fontSize: 28,
            fontFamily: 'Carlito, sans-serif', padding: '4px 16px', borderRadius: 12,
            border: '2px solid rgba(34,211,238,0.6)', whiteSpace: 'nowrap',
          }}
        >
          {Math.round(size.w)} × {Math.round(size.h)}
        </div>
      )}

      {showHandles && def.resizable !== false && (['nw', 'ne', 'sw', 'se'] as Handle[]).map((h) => (
        <div
          key={h}
          onPointerDown={(e) => startResize(e, h)}
          style={{
            position: 'absolute',
            width: 44, height: 44,
            left: h.includes('w') ? -22 : undefined,
            right: h.includes('e') ? -22 : undefined,
            top: h.includes('n') ? -22 : undefined,
            bottom: h.includes('s') ? -22 : undefined,
            cursor: HANDLE_CURSOR[h],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: '#22D3EE',
              border: '5px solid #062A33',
              boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
            }}
          />
        </div>
      ))}

      {/* dynamic-number hint card: bitmap sprite font or CSS-styled value (portal) */}
      {dynHint && def && createPortal(
        <div
          style={{
            position: 'fixed',
            left: dynHint.left,
            top: Math.max(8, dynHint.top - 118),
            width: Math.max(340, dynHint.width),
            zIndex: 9999,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              background: '#0B1220', border: '2px solid #22D3EE', borderRadius: 12,
              padding: '12px 14px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <div style={{ color: '#67E8F9', fontWeight: 800, fontSize: 14, letterSpacing: '0.02em' }}>
              {isBitmapFont ? 'Sprite-font originale (immagini)' : 'Valore dinamico'}
            </div>
            <div style={{ color: '#C9D8E4', fontSize: 13, lineHeight: 1.45 }}>
              {isBitmapFont ? (
                <>
                  Questo numero è disegnato con le <b>immagini del font originale</b> (port 1:1) e il suo
                  valore cambia in partita, quindi non si può scrivere testo libero.
                  Passa a un font CSS per personalizzare carattere, colore, gradiente e contorno
                  dal pannello skin.
                </>
              ) : (
                <>
                  Questo numero cambia durante la partita e non è un testo fisso.
                  Personalizza font, colore e dimensioni dal pannello skin dell&apos;elemento
                  collegato (selezionato ora a destra).
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {isBitmapFont && (
                <button
                  onClick={switchToCssFont}
                  style={{
                    background: '#22D3EE', color: '#062A33', border: 'none', borderRadius: 8,
                    padding: '8px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Passa a font CSS
                </button>
              )}
              <button
                onClick={() => setDynHint(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)', color: '#E8F6FA', border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {isBitmapFont ? 'Mantieni originale' : 'OK'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* inline text editor (portal — escapes the scaled design space) */}
      {textEdit && createPortal(
        <div
          style={{
            position: 'fixed',
            left: textEdit.left,
            top: Math.max(8, textEdit.top - 52),
            width: Math.max(280, textEdit.width),
            zIndex: 9999,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#0B1220', border: '2px solid #22D3EE', borderRadius: 12,
              padding: '8px 10px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            <input
              autoFocus
              defaultValue={currentText}
              onChange={(e) => commitText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setTextEdit(null);
              }}
              onBlur={() => setTextEdit(null)}
              placeholder={def.text ?? def.skinTextPath ?? ''}
              className="bb-textedit-input"
              style={{
                flex: 1, minWidth: 0,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '8px 10px',
                color: '#E8F6FA', fontSize: 14, fontWeight: 600, outline: 'none',
              }}
            />
            <button
              onClick={() => setTextEdit(null)}
              style={{
                background: '#22D3EE', color: '#062A33', border: 'none', borderRadius: 8,
                padding: '8px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** tiny dot-path getter for skinTextPath reads */
function getPathValue(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}
