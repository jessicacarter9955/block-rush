'use client';

// Sidebar — element library grouped by category, with screen badges.

import {
  Grid3x3, LayoutDashboard, MousePointerClick, Music, Sparkles, Star, Type,
} from 'lucide-react';
import { CATEGORIES, elementsOfCategory, type CategoryId } from '@/lib/elements';
import { useStudio } from '@/lib/store';
import { SPRITES } from '@/lib/assets-data';

const ICONS: Record<CategoryId, React.ComponentType<{ size?: number; className?: string }>> = {
  blocks: Grid3x3,
  scene: LayoutDashboard,
  ui: MousePointerClick,
  testi: Type,
  icone: Star,
  effetti: Sparkles,
  suoni: Music,
};

export function Sidebar() {
  const selected = useStudio((s) => s.selected);
  const select = useStudio((s) => s.select);
  const screen = useStudio((s) => s.screen);

  return (
    <div className="bb-scroll h-full overflow-y-auto px-3 py-4">
      {CATEGORIES.map((cat) => {
        const Icon = ICONS[cat.id];
        const els = elementsOfCategory(cat.id);
        return (
          <div key={cat.id} className="mb-4">
            <div className="mb-1.5 flex items-center gap-2 px-1.5">
              <Icon size={13} className="text-amber-400/80" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {cat.label}
              </span>
            </div>
            <div className="space-y-1">
              {els.map((el) => {
                const isSel = selected === el.id;
                const inScreen = el.screens.includes(screen);
                const spr = el.sprite ? SPRITES[el.sprite.name] : null;
                return (
                  <button
                    key={el.id}
                    onClick={() => select(el.id)}
                    className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      isSel
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-transparent hover:border-zinc-700 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
                      {spr ? (
                         
                        <img
                          src={spr.frames[0]}
                          alt=""
                          className="max-h-full max-w-full object-contain p-0.5"
                          draggable={false}
                        />
                      ) : (
                        <Icon size={14} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[13px] font-semibold ${isSel ? 'text-amber-300' : 'text-zinc-300'}`}>
                        {el.label}
                      </div>
                      <div className="truncate text-[10px] text-zinc-600">
                        {spr ? `${spr.w}×${spr.h}px` : el.screens.length ? 'in gioco' : 'decorativo'}
                      </div>
                    </div>
                    {!inScreen && el.screens.length > 0 && (
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">
                        {el.screens[0] === 'home' ? 'HOME' : el.screens[0] === 'game' ? 'GIOCO' : 'POPUP'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
