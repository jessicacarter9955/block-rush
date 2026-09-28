'use client';

// Block Blast Skin Studio — main page.
// Desktop: element library | live phone preview | element editor.
// Mobile: preview on top + tabbed panel (Elementi / Editor).

import { useState } from 'react';
import { Box, MousePointerClick, Smartphone } from 'lucide-react';
import { TopBar } from '@/components/studio/TopBar';
import { Sidebar } from '@/components/studio/Sidebar';
import { PhonePreview } from '@/components/studio/PhonePreview';
import { EditorPanel } from '@/components/studio/EditorPanel';

export default function Home() {
  const [mobileTab, setMobileTab] = useState<'preview' | 'editor'>('preview');

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <TopBar />

      {/* desktop layout */}
      <main className="hidden min-h-0 flex-1 lg:flex">
        <aside className="bb-scroll w-64 shrink-0 overflow-y-auto border-r border-zinc-800/80 bg-zinc-925 bg-zinc-900/30">
          <Sidebar />
        </aside>
        <section className="min-w-0 flex-1 bg-[radial-gradient(60%_50%_at_50%_38%,rgba(245,158,11,0.05),transparent)]">
          <PhonePreview />
        </section>
        <aside className="w-[400px] shrink-0 border-l border-zinc-800/80 bg-zinc-900/30">
          <EditorPanel />
        </aside>
      </main>

      {/* mobile layout */}
      <main className="flex min-h-0 flex-1 flex-col lg:hidden">
        {mobileTab === 'preview' ? (
          <section className="flex min-h-0 flex-1 flex-col">
            <PhonePreview />
          </section>
        ) : (
          <section className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden sm:grid-cols-2">
            <div className="hidden min-h-0 overflow-y-auto border-r border-zinc-800/80 bg-zinc-900/30 sm:block bb-scroll">
              <Sidebar />
            </div>
            <div className="min-h-0 bg-zinc-900/30">
              <EditorPanel />
            </div>
          </section>
        )}
        <nav className="flex shrink-0 border-t border-zinc-800 bg-zinc-950">
          {([
            ['preview', 'Anteprima', Smartphone],
            ['editor', 'Elementi & Editor', MousePointerClick],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 py-3 text-[13px] font-bold transition-colors ${
                mobileTab === id ? 'bg-zinc-900 text-amber-400' : 'text-zinc-500'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </main>

      {/* footer strip (desktop) */}
      <footer className="hidden shrink-0 items-center gap-4 border-t border-zinc-800/80 bg-zinc-950 px-4 py-1.5 text-[11px] text-zinc-600 lg:flex">
        <span className="flex items-center gap-1.5">
          <Box size={11} className="text-amber-500/70" />
          77 sprite originali · 28 suoni · geometria 1080×1920 1:1
        </span>
        <span>·</span>
        <span>RGB esatti, dimensioni reali in px, varianti create dall&apos;AI</span>
        <span className="flex-1" />
        <span>le skin si salvano automaticamente nel browser</span>
      </footer>
    </div>
  );
}
