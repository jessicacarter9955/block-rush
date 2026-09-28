'use client';

// LayoutManager — popover to manage named layouts: save the current one,
// load / rename / delete saved layouts, export/import JSON, reset to the
// original geometry, and pick the snapping grid.

import { useRef, useState } from 'react';
import {
  BookmarkPlus, Check, Download, Pencil, RotateCcw, Save, Trash2, Upload, X,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { exportLayout, useLayout } from '@/lib/layout';
import { toast } from '@/hooks/use-toast';

export function LayoutManagerButton() {
  return (
    <Popover>
      <PopoverTrigger
        title="Layout salvati"
        className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:text-amber-400"
      >
        <BookmarkPlus size={15} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <LayoutManager />
      </PopoverContent>
    </Popover>
  );
}

function LayoutManager() {
  const saved = useLayout((s) => s.saved);
  const overrides = useLayout((s) => s.overrides);
  const activeSavedId = useLayout((s) => s.activeSavedId);
  const saveAs = useLayout((s) => s.saveAs);
  const saveActive = useLayout((s) => s.saveActive);
  const loadSaved = useLayout((s) => s.loadSaved);
  const deleteSaved = useLayout((s) => s.deleteSaved);
  const renameSaved = useLayout((s) => s.renameSaved);
  const resetAll = useLayout((s) => s.resetAll);
  const importLayout = useLayout((s) => s.importLayout);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = saved.find((s) => s.id === activeSavedId) ?? null;
  const changed = Object.keys(overrides).length;
  const dirty = active ? JSON.stringify(active.overrides) !== JSON.stringify(overrides) : changed > 0;

  const doExport = () => {
    const blob = new Blob([exportLayout(active?.name ?? 'layout', { overrides })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `block-blast-layout-${(active?.name ?? 'corrente').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Layout esportato' });
  };

  const doImport = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importLayout(String(reader.result));
      if (ok) toast({ title: 'Layout importato!' });
      else toast({ title: 'Errore', description: 'File layout non valido' });
    };
    reader.readAsText(f);
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-black tracking-tight text-zinc-100">Layout</div>
        <div className="text-[11px] text-zinc-500">
          {active ? (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {active.name}
              {dirty && <span className="text-zinc-600">· modificato</span>}
            </span>
          ) : (
            `${changed} elementi modificati`
          )}
        </div>
      </div>

      {/* save row */}
      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              saveAs(name);
              setName('');
              toast({ title: 'Layout salvato', description: name.trim() });
            }
          }}
          placeholder="Nome nuovo layout…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/60"
        />
        <button
          onClick={() => {
            if (!name.trim()) return;
            saveAs(name);
            setName('');
            toast({ title: 'Layout salvato', description: name.trim() });
          }}
          className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[12px] font-bold text-zinc-950 hover:brightness-110"
        >
          <Save size={13} /> Salva
        </button>
        {activeSavedId && (
          <button
            onClick={() => {
              saveActive();
              toast({ title: 'Layout aggiornato', description: active?.name });
            }}
            title="Aggiorna il layout attivo con le modifiche correnti"
            className="rounded-lg border border-zinc-700 p-1.5 text-zinc-300 hover:text-amber-400"
          >
            <Check size={13} />
          </button>
        )}
      </div>

      {/* saved list */}
      <div className="bb-scroll max-h-64 space-y-1 overflow-y-auto">
        {saved.length === 0 && (
          <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-[11px] leading-relaxed text-zinc-600">
            Nessun layout salvato.
            <br />
            Sposta gli elementi in modalità LAYOUT e salvali qui.
          </p>
        )}
        {saved.map((s) => {
          const isActive = s.id === activeSavedId;
          return (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 ${
                isActive ? 'border-amber-500/60 bg-amber-500/10' : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {renaming?.id === s.id ? (
                <>
                  <input
                    autoFocus
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: s.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameSaved(s.id, renaming.name);
                        setRenaming(null);
                      }
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[12px] text-zinc-100 outline-none"
                  />
                  <button
                    onClick={() => { renameSaved(s.id, renaming.name); setRenaming(null); }}
                    className="rounded p-1 text-emerald-400 hover:bg-zinc-800"
                  >
                    <Check size={13} />
                  </button>
                  <button onClick={() => setRenaming(null)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      loadSaved(s.id);
                      toast({ title: `Layout "${s.name}" caricato` });
                    }}
                    className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold text-zinc-200"
                    title={`Carica "${s.name}"`}
                  >
                    {isActive && <span className="mr-1 text-amber-400">●</span>}
                    {s.name}
                  </button>
                  <span className="shrink-0 text-[10px] text-zinc-600">
                    {Object.keys(s.overrides).length} mod.
                  </span>
                  <button
                    onClick={() => setRenaming({ id: s.id, name: s.name })}
                    className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:text-amber-400 group-hover:opacity-100"
                    title="Rinomina"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => deleteSaved(s.id)}
                    className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    title="Elimina"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* footer actions */}
      <div className="flex items-center gap-1 border-t border-zinc-800 pt-2">
        <button
          onClick={() => {
            resetAll();
            toast({ title: 'Geometria originale ripristinata' });
          }}
          className="flex items-center gap-1 rounded-lg border border-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-red-400"
          title="Torna alla geometria originale di tutti gli elementi"
        >
          <RotateCcw size={12} /> Originale
        </button>
        <div className="flex-1" />
        <button onClick={doExport} title="Esporta layout (JSON)" className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 hover:text-amber-400">
          <Download size={13} />
        </button>
        <button onClick={() => fileRef.current?.click()} title="Importa layout (JSON)" className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 hover:text-amber-400">
          <Upload size={13} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

/** snap grid picker — shown while LAYOUT mode is active */
export function SnapPicker() {
  const snap = useLayout((s) => s.snap);
  const setSnap = useLayout((s) => s.setSnap);
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1" title="Griglia di aggancio (design unit 1080×1920)">
      <span className="px-1.5 text-[10px] font-bold text-zinc-500">SNAP</span>
      {([0, 5, 10, 20] as const).map((v) => (
        <button
          key={v}
          onClick={() => setSnap(v)}
          className={`rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
            snap === v ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {v === 0 ? 'Libero' : v}
        </button>
      ))}
    </div>
  );
}
