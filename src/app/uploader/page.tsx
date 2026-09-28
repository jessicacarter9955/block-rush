'use client';

// /uploader — Carica gli screenshot di riferimento del Block Blast 1:1.
// Gli ORIGINALI a piena risoluzione finiscono in uploads-inbox/ sul server
// (niente compressioni: da qui si estraggono gli elementi pixel perfect
// editabili dallo Skin Studio).

import {
  useCallback, useEffect, useRef, useState,
  type ChangeEvent, type DragEvent,
} from 'react';
import { CheckCircle2, ImagePlus, Loader2, Send, Trash2, UploadCloud, X } from 'lucide-react';

interface Slot {
  key: number;
  label: string;
  file: File | null;
  preview: string | null;
  w: number;
  h: number;
}

interface SavedEntry {
  id: string;
  slot: string;
  note: string;
  originalName: string;
  savedAs: string;
  bytes: number;
  width?: number;
  height?: number;
  receivedAt: string;
}

let slotKeySeq = 0;
const newSlot = (label: string): Slot => ({
  key: ++slotKeySeq, label, file: null, preview: null, w: 0, h: 0,
});

const fmtMB = (b: number) => `${(b / 1048576).toFixed(2)} MB`;

export default function UploaderPage() {
  const [slots, setSlots] = useState<Slot[]>([newSlot('Screen 1'), newSlot('Screen 2')]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedEntry[] | null>(null);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);
  const [received, setReceived] = useState<{ total: number; recent: SavedEntry[] } | null>(null);
  const [dragOver, setDragOver] = useState<number | 'any' | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const refreshReceived = useCallback(() => {
    fetch('/api/upload-screenshot')
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setReceived({ total: d.total, recent: d.recent ?? [] }); })
      .catch(() => {});
  }, []);

  useEffect(() => { refreshReceived(); }, [refreshReceived]);

  const setSlot = (key: number, patch: Partial<Slot>) => {
    setSlots((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  // misura le dimensioni reali dell'immagine (servono per l'estrazione)
  const measure = (url: string, key: number) => {
    const img = new Image();
    img.onload = () => setSlot(key, { w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  };

  const takeFile = (file: File | null | undefined, key: number) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError(`"${file.name}" non è un PNG/JPG/WebP`);
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError(`"${file.name}" è più grande di 40 MB`);
      return;
    }
    setError(null);
    const preview = URL.createObjectURL(file);
    setSlot(key, { file, preview, w: 0, h: 0 });
    measure(preview, key);
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>, key: number) => {
    takeFile(e.target.files?.[0], key);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>, key: number) => {
    e.preventDefault();
    setDragOver(null);
    takeFile(e.dataTransfer.files?.[0], key);
  };

  // incolla (Ctrl+V) → primo slot libero
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return;
      const empty = slots.find((s) => !s.file);
      if (empty) {
        takeFile(file, empty.key);
      } else {
        const ns = newSlot(`Screen ${slots.length + 1}`);
        setSlots((ss) => [...ss, ns]);
        setTimeout(() => takeFile(file, ns.key), 0);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }); // ridisegna il listener a ogni cambio stato: prende sempre l'ultimo slots

  const ready = slots.filter((s) => s.file);

  const submit = async () => {
    if (!ready.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      const order = slots.filter((s) => s.file);
      order.forEach((s) => fd.append('files', s.file!));
      fd.append('meta', JSON.stringify(order.map((s) => ({ slot: s.label, w: s.w || undefined, h: s.h || undefined }))));
      const res = await fetch('/api/upload-screenshot', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || 'errore del server');
      setSaved(data.saved ?? []);
      setSkipped(data.skipped ?? []);
      setSlots([newSlot('Screen 1'), newSlot('Screen 2')]);
      refreshReceived();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fallito, riprova');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:px-6">

        {/* header */}
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <UploadCloud className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Uploader riferimenti <span className="text-amber-400">1:1</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            Carica qui i tuoi screenshot di Block Blast. Salvo gli{' '}
            <b className="text-zinc-200">originali a piena risoluzione</b> (mai compressi) e da
            lì copio <b className="text-zinc-200">ogni elemento pixel perfect</b>: blocchi, board,
            sfondo, vassoi e UI — tutti editabili dallo Skin Studio.
          </p>
        </header>

        {/* conferma upload */}
        {saved && (
          <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-5">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <CheckCircle2 size={20} />
              Ricevuto! {saved.length} screen {saved.length === 1 ? 'salvato' : 'salvati'}
            </div>
            <ul className="mt-3 space-y-1.5 text-[13px] text-emerald-200/90">
              {saved.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-emerald-300">{s.savedAs}</span>
                  <span className="text-emerald-200/60">
                    {s.width && s.height ? `${s.width}×${s.height} · ` : ''}{fmtMB(s.bytes)}
                  </span>
                </li>
              ))}
            </ul>
            {skipped.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12px] text-amber-300/80">
                {skipped.map((s, i) => <li key={i}>Saltato {s.name}: {s.reason}</li>)}
              </ul>
            )}
            <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-[13px] leading-relaxed text-emerald-100">
              Perfetto! Ora scrivimi in chat <b>«fatto»</b> e procedo subito: estraggo blocchi,
              celle, sfondo e UI dai tuoi screen e preparo la versione <b>1:1 pixel perfect</b>{' '}
              editabile dall&apos;editor.
            </p>
          </div>
        )}

        {/* slot */}
        <div className="space-y-4">
          {slots.map((s, i) => (
            <div key={s.key} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  value={s.label}
                  onChange={(e) => setSlot(s.key, { label: e.target.value.slice(0, 40) })}
                  className="w-40 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold text-amber-400 outline-none transition-colors focus:border-zinc-700 focus:bg-zinc-900"
                  aria-label={`Etichetta ${i + 1}`}
                />
                {slots.length > 2 && (
                  <button
                    onClick={() => setSlots((ss) => ss.filter((x) => x.key !== s.key))}
                    className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-red-400"
                    title="Rimuovi slot"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {!s.file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRefs.current[i]?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRefs.current[i]?.click(); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(s.key); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => onDrop(e, s.key)}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                    dragOver === s.key
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-zinc-700 bg-zinc-950/50 hover:border-zinc-500 hover:bg-zinc-900'
                  }`}
                >
                  <ImagePlus className="text-zinc-500" size={30} />
                  <p className="text-sm font-semibold text-zinc-300">Trascina qui lo screen</p>
                  <p className="text-xs text-zinc-500">oppure clicca / incolla con Ctrl+V</p>
                  <p className="text-[11px] text-zinc-600">PNG · JPG · WebP — originale a piena risoluzione</p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* anteprima */}
                  <div className="relative h-28 w-[63px] shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 sm:h-32 sm:w-[72px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.preview ?? ''} alt={s.label} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-200" title={s.file.name}>
                      {s.file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {s.w && s.h ? (
                        <span className="text-emerald-400">{s.w}×{s.h}px</span>
                      ) : (
                        <span className="text-zinc-500">lettura dimensioni…</span>
                      )}
                      {' · '}{fmtMB(s.file.size)}
                    </p>
                    <button
                      onClick={() => {
                        if (s.preview) URL.revokeObjectURL(s.preview);
                        setSlot(s.key, { file: null, preview: null, w: 0, h: 0 });
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-400"
                    >
                      <X size={13} /> Rimuovi
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onPick(e, s.key)}
              />
            </div>
          ))}
        </div>

        {/* add + invia */}
        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={() => setSlots((ss) => [...ss, newSlot(`Screen ${ss.length + 1}`)])}
            className="mx-auto rounded-xl border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            + Aggiungi un altro screen
          </button>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm font-semibold text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={!ready.length || busy}
            className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-extrabold tracking-wide transition-all ${
              ready.length && !busy
                ? 'bg-amber-500 text-zinc-950 shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:bg-amber-400 active:scale-[0.99]'
                : 'cursor-not-allowed bg-zinc-800 text-zinc-500'
            }`}
          >
            {busy ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />}
            {busy ? 'Invio in corso…' : `Invia a Super Z${ready.length ? ` (${ready.length})` : ''}`}
          </button>
        </div>

        {/* come funziona */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ['1', 'Carichi gli screen', 'I due screenshot di riferimento, originali e a piena risoluzione.'],
            ['2', 'Estraggo ogni elemento', 'Blocchi, celle della board, sfondo, vassoi, bottoni e logo — 1:1 dai tuoi pixel.'],
            ['3', 'Diventa preset editabile', 'Tutto nello Skin Studio: ogni elemento regolabile e la versione diventa la principale.'],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-sm font-extrabold text-amber-400">{n}</div>
              <h3 className="text-sm font-bold text-zinc-200">{t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{d}</p>
            </div>
          ))}
        </section>

        {/* già ricevuti */}
        {received && received.recent.length > 0 && (
          <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Ultimi file ricevuti ({received.total} totali)
            </h3>
            <ul className="mt-2 space-y-1 text-[12px] text-zinc-500">
              {received.recent.slice(0, 6).map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-zinc-400">{r.savedAs}</span>
                  {r.width && r.height ? <span>{r.width}×{r.height}</span> : null}
                  <span>{fmtMB(r.bytes)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
