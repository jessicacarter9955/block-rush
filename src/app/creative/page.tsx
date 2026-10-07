'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, ExternalLink, Gauge, Play, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { applyCreativeMove, type CreativeBotState } from '@/lib/creative-bot';
import {
  CREATIVE_SCENARIOS,
  OBSERVED_ADS,
  getCreativeScenario,
  type CreativeKind,
  type CreativeScenario,
} from '@/lib/creative-scenarios';
import type { Piece } from '@/lib/game';

const COLORS = ['#26d8ff', '#8b5cf6', '#22c55e', '#facc15', '#fb7185', '#f97316', '#ec4899', '#60a5fa'];
const EMPTY = '#142452';

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M` : `${Math.round(n / 1_000)}K`);

function initialState(scenario: CreativeScenario): CreativeBotState {
  return {
    board: [...scenario.board],
    tray: scenario.tray.map((piece) => ({ ...piece, cells: piece.cells.map(([r, c]) => [r, c] as [number, number]) })),
    score: scenario.id === 'high_score' ? 9_840 : 0,
    combo: scenario.id === 'massive_combo' ? 2 : 0,
    clearedLines: 0,
    lastMove: null,
  };
}

function PiecePreview({ piece, label, active }: { piece: Piece | null; label?: string; active?: boolean }) {
  if (!piece) return <div className="h-20 w-24 rounded-2xl border border-white/10 bg-white/[0.03]" />;
  const size = 16;
  return (
    <div className={`relative flex h-20 w-24 items-center justify-center rounded-2xl border bg-white/[0.04] transition ${active ? 'border-amber-300 shadow-[0_0_28px_rgba(251,191,36,.35)]' : 'border-white/10'}`}>
      {label && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-950">{label}</span>}
      <div style={{ width: piece.w * size, height: piece.h * size, position: 'relative' }}>
        {piece.cells.map(([r, c], index) => (
          <span
            key={`${r}-${c}-${index}`}
            style={{
              position: 'absolute', left: c * size, top: r * size, width: size - 2, height: size - 2,
              borderRadius: 4, background: COLORS[piece.color], boxShadow: `inset 0 -2px 0 rgba(0,0,0,.16), 0 0 8px ${COLORS[piece.color]}55`,
            }}
          />
        ))}
      </div>
    </div>
  );
}


function ReferenceComparison({ scenario }: { scenario: CreativeScenario }) {
  const ref = scenario.reference;
  return (
    <section className="mt-8 rounded-[28px] border border-white/10 bg-[#08132e] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-fuchsia-300">Comparison mode</div>
          <h2 className="mt-1 text-2xl font-black">Original reference ↔ Block Rush recreation</h2>
          <p className="mt-1 max-w-3xl text-sm text-white/45">Keep the source visible while tuning composition, board density, timing and payoff. Video is used where the public source exposes one; otherwise the public paid-ad frame is shown.</p>
        </div>
        <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/[0.09]">
          Open original source <ExternalLink size={13} />
        </a>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[24px] border border-fuchsia-300/20 bg-black/30">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wider text-fuchsia-300">Original Block Blast reference</div>
            <div className="mt-1 text-xs text-white/45">{ref.label}</div>
          </div>
          <div className="flex min-h-[420px] items-center justify-center bg-black/50 p-3">
            {ref.mediaType === 'video' ? (
              <video src={ref.mediaUrl} controls playsInline preload="metadata" className="max-h-[640px] w-full rounded-2xl object-contain" />
            ) : (
              <img src={ref.mediaUrl} alt={ref.label} className="max-h-[640px] w-full rounded-2xl object-contain" />
            )}
          </div>
          <p className="px-4 py-3 text-xs leading-relaxed text-white/40">{ref.note}</p>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-cyan-300/20 bg-black/30">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wider text-cyan-300">Our Block Rush target</div>
            <div className="mt-1 text-xs text-white/45">{scenario.title} · Creative Bot scenario</div>
          </div>
          <div className="flex min-h-[420px] items-center justify-center bg-gradient-to-b from-[#17275f] to-[#07122f] p-6 text-center">
            <div>
              <div className="text-4xl font-black text-white">{scenario.hook}</div>
              <div className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/55">Use the live recreation immediately below this comparison while keeping the original reference on screen.</div>
              <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-sm font-bold text-cyan-200">Grid target: 8 × 8 uniform cells · no stretched empty slots</div>
            </div>
          </div>
          <p className="px-4 py-3 text-xs leading-relaxed text-white/40">The gameplay bot remains untouched; only the separate Creative Bot scenario is compared here.</p>
        </div>
      </div>
    </section>
  );
}

function CreativeStage({ scenario }: { scenario: CreativeScenario }) {
  const [state, setState] = useState<CreativeBotState>(() => initialState(scenario));
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);

  const reset = () => {
    setRunning(false);
    setStep(0);
    setState(initialState(scenario));
  };

  useEffect(() => { reset(); }, [scenario.id]);

  useEffect(() => {
    if (!running) return;
    const delay = Math.max(280, 1000 / speed);
    const timer = window.setTimeout(() => {
      if (step >= scenario.script.length) {
        setRunning(false);
        return;
      }
      setState((current) => applyCreativeMove(current, scenario.script[step]));
      setStep((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [running, scenario, speed, step]);

  const activeSlot = running && step < scenario.script.length ? scenario.script[step].slot : -1;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#17275f] to-[#07122f] shadow-2xl">
        <div className="mx-auto flex min-h-[680px] max-w-[540px] flex-col px-5 py-7 sm:px-8">
          <div className="mb-2 text-center text-[12px] font-black uppercase tracking-[0.28em] text-cyan-300">Block Rush creative recreation</div>
          <h2 className="text-center text-3xl font-black leading-tight text-white sm:text-4xl">{scenario.hook}</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-white/55">{scenario.subhook}</p>

          <div className="mt-7 flex items-center justify-center gap-3">
            {state.tray.map((piece, index) => (
              <PiecePreview key={index} piece={piece} label={scenario.labels?.[index]} active={activeSlot === index} />
            ))}
          </div>

          <div className="relative mx-auto mt-7 aspect-square w-full max-w-[430px] rounded-[28px] border border-white/10 bg-[#0d1b45] p-3 shadow-[inset_0_0_40px_rgba(0,0,0,.35)]">
            <div className="grid h-full w-full grid-cols-8 grid-rows-8 gap-[5px]">
              {state.board.map((value, index) => (
                <div
                  key={index}
                  className={`rounded-[8px] transition-all duration-300 ${value === null ? '' : 'shadow-[inset_0_-4px_0_rgba(0,0,0,.16),0_0_14px_rgba(255,255,255,.04)]'}`}
                  style={{ background: value === null ? EMPTY : COLORS[value] }}
                />
              ))}
            </div>
            {state.clearedLines > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse rounded-2xl border border-amber-200/70 bg-black/70 px-5 py-3 text-center shadow-[0_0_50px_rgba(251,191,36,.38)]">
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Payoff</div>
                  <div className="mt-1 text-3xl font-black text-white">{state.clearedLines} LINE CLEAR</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
            <span className="text-white/55">Creative bot</span>
            <span className="font-black text-emerald-300">{running ? 'REPLAYING' : step >= scenario.script.length ? 'DONE' : 'READY'}</span>
            <span className="font-mono font-bold text-white">Score {state.score.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <aside className="rounded-[28px] border border-white/10 bg-[#0b1738] p-5 text-white shadow-xl">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-300"><Bot size={15} /> Separate Creative Bot</div>
        <h3 className="mt-3 text-2xl font-black">{scenario.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">This replay uses its own scripted scenario state. It does not start, stop, configure, or mutate the existing gameplay bot.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.05] p-3"><div className="text-[10px] uppercase tracking-wider text-white/40">Priority</div><div className="mt-1 text-2xl font-black text-emerald-300">{scenario.priorityScore}/100</div></div>
          <div className="rounded-2xl bg-white/[0.05] p-3"><div className="text-[10px] uppercase tracking-wider text-white/40">Bot fit</div><div className="mt-1 text-2xl font-black text-cyan-300">{scenario.botFit}/5</div></div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Evidence</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{scenario.evidence}</p>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-white/55"><Gauge size={14} /> Replay speed</div>
        <input className="mt-2 w-full accent-amber-300" type="range" min="0.5" max="3" step="0.5" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
        <div className="mt-1 flex justify-between text-[10px] text-white/35"><span>0.5×</span><span>{speed.toFixed(1)}×</span><span>3×</span></div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => { if (step >= scenario.script.length) { setState(initialState(scenario)); setStep(0); } setRunning(true); }} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"><Play size={15} /> Replay</button>
          <button onClick={reset} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white transition hover:bg-white/[0.09]"><RotateCcw size={15} /> Reset</button>
        </div>
      </aside>
    </div>
  );
}

export default function CreativePage() {
  const [selected, setSelected] = useState<CreativeKind>('choice_trap');
  const scenario = useMemo(() => getCreativeScenario(selected), [selected]);

  return (
    <main className="min-h-screen bg-[#050b1c] px-4 py-6 text-white sm:px-7 lg:px-10">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="../play/" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-white/45 transition hover:text-white"><ArrowLeft size={14} /> Back to current game / bot</a>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-300"><Sparkles size={15} /> Creative Lab</div>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Block Rush Creative Factory</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55 sm:text-base">A separate research + recreation area for Block Blast-inspired ad structures. Rankings keep estimated reach, longevity, reuse evidence and bot reproducibility separate.</p>
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Current gameplay bot</div>
            <div className="mt-1 text-sm font-bold text-white">Untouched · Creative bot isolated</div>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2"><Trophy size={18} className="text-amber-300" /><h2 className="text-2xl font-black">Top observed Block Blast ads</h2></div>
          <p className="mb-4 max-w-4xl text-sm text-white/45">Public third-party estimates, not advertiser-owned delivery logs. Use them as reach / longevity signals, not proof that a specific visual concept caused the result.</p>
          <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-[#0b1738]">
            <table className="min-w-[940px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
                <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Impressions</th><th className="px-4 py-3">Observed days</th><th className="px-4 py-3">Rough velocity</th><th className="px-4 py-3">Popularity</th><th className="px-4 py-3">Market</th><th className="px-4 py-3">Note</th></tr>
              </thead>
              <tbody>
                {OBSERVED_ADS.map((ad) => (
                  <tr key={`${ad.rank}-${ad.impressions}`} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-4 text-lg font-black text-amber-300">#{ad.rank}</td>
                    <td className="px-4 py-4 text-lg font-black text-white">{fmt(ad.impressions)}</td>
                    <td className="px-4 py-4 text-white/65">{ad.days}</td>
                    <td className="px-4 py-4 font-mono text-cyan-300">~{fmt(ad.impressions / ad.days)}/day</td>
                    <td className="px-4 py-4 text-white/65">{fmt(ad.popularity)}</td>
                    <td className="max-w-[240px] px-4 py-4 text-xs text-white/50">{ad.market}</td>
                    <td className="max-w-[330px] px-4 py-4 text-xs leading-relaxed text-white/50">{ad.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Creative priority ranking</h2><p className="mt-1 text-sm text-white/45">Ranked for what we should recreate first in Block Rush: external evidence + clarity + automation fit.</p></div><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45">6 presets</span></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CREATIVE_SCENARIOS.map((item) => (
              <button key={item.id} onClick={() => setSelected(item.id)} className={`rounded-[24px] border p-5 text-left transition ${selected === item.id ? 'border-cyan-300/60 bg-cyan-300/[0.10] shadow-[0_0_40px_rgba(34,211,238,.10)]' : 'border-white/10 bg-[#0b1738] hover:border-white/20 hover:bg-[#10204a]'}`}>
                <div className="flex items-center justify-between"><span className="text-sm font-black text-amber-300">#{item.rank}</span><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/45">{item.family}</span></div>
                <div className="mt-3 text-xl font-black">{item.title}</div>
                <div className="mt-2 text-xs leading-relaxed text-white/45">{item.subhook}</div>
                <div className="mt-4 flex items-center gap-2"><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-300">{item.priorityScore}/100</span><span className="rounded-full bg-cyan-400/10 px-2 py-1 text-xs font-black text-cyan-300">Bot {item.botFit}/5</span></div>
              </button>
            ))}
          </div>
        </section>

        <ReferenceComparison scenario={scenario} />

        <section className="mt-8 pb-16">
          <CreativeStage scenario={scenario} />
        </section>
      </div>
    </main>
  );
}
