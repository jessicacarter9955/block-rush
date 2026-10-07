'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Sparkles, Trophy } from 'lucide-react';
import { CreativeRushPlayer } from '@/components/creative/CreativeRushPlayer';
import { CREATIVE_SCENARIOS, OBSERVED_ADS } from '@/lib/creative-scenarios';
import { getCreativeVideoReference } from '@/lib/creative-references';

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M` : `${Math.round(n / 1_000)}K`;

function OriginalGameplay({
  mediaType,
  mediaUrl,
  label,
}: {
  mediaType: 'youtube' | 'video';
  mediaUrl: string;
  label: string;
}) {
  if (mediaType === 'youtube') {
    return (
      <iframe
        className="h-full w-full"
        src={`https://www.youtube.com/embed/${mediaUrl}?rel=0&playsinline=1`}
        title={label}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={mediaUrl}
      controls
      playsInline
      preload="metadata"
      className="h-full w-full bg-black object-contain"
    />
  );
}

export default function CreativePage() {
  const initialTokens = useMemo(
    () => Object.fromEntries(CREATIVE_SCENARIOS.map((scenario) => [scenario.id, 0])) as Record<string, number>,
    [],
  );
  const [replayTokens, setReplayTokens] = useState<Record<string, number>>(initialTokens);

  const replay = (id: string) =>
    setReplayTokens((tokens) => ({ ...tokens, [id]: (tokens[id] ?? 0) + 1 }));

  return (
    <main className="min-h-screen bg-[#050b1c] px-4 py-6 text-white sm:px-7 lg:px-10">
      <div className="mx-auto max-w-[1560px]">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <a href="../play/" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-white/45 transition hover:text-white">
              <ArrowLeft size={14} /> Back to Block Rush
            </a>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
              <Sparkles size={15} /> Creative Lab
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Block Blast vs Block Rush</h1>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-white/55 sm:text-base">
              Every ranked creative now uses gameplay on the left and a live Block Rush UI recreation on the right.
              No screenshot comparison cards. Replay the mapped Block Rush scenario directly beside the reference.
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Gameplay bot</div>
            <div className="mt-1 text-sm font-bold text-white">Untouched · Creative player isolated</div>
          </div>
        </header>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-amber-300" />
            <h2 className="text-2xl font-black">Observed Block Blast scale</h2>
          </div>
          <p className="mb-4 max-w-4xl text-sm text-white/45">
            Third-party estimates are kept separate from the creative matching itself. They are useful reach/longevity signals, not proof that one visual element caused performance.
          </p>

          <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-[#0b1738]">
            <table className="min-w-[940px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Impressions</th>
                  <th className="px-4 py-3">Observed days</th>
                  <th className="px-4 py-3">Rough velocity</th>
                  <th className="px-4 py-3">Popularity</th>
                  <th className="px-4 py-3">Market</th>
                </tr>
              </thead>
              <tbody>
                {OBSERVED_ADS.map((ad) => (
                  <tr key={`${ad.rank}-${ad.impressions}`} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-4 text-lg font-black text-amber-300">#{ad.rank}</td>
                    <td className="px-4 py-4 text-lg font-black text-white">{fmt(ad.impressions)}</td>
                    <td className="px-4 py-4 text-white/65">{ad.days}</td>
                    <td className="px-4 py-4 font-mono text-cyan-300">~{fmt(ad.impressions / ad.days)}/day</td>
                    <td className="px-4 py-4 text-white/65">{fmt(ad.popularity)}</td>
                    <td className="max-w-[260px] px-4 py-4 text-xs text-white/50">{ad.market}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 space-y-10 pb-20">
          {CREATIVE_SCENARIOS.map((scenario) => {
            const reference = getCreativeVideoReference(scenario.id);

            return (
              <article key={scenario.id} className="overflow-hidden rounded-[30px] border border-white/10 bg-[#08132e] shadow-2xl">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">#{scenario.rank}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-black uppercase tracking-wider text-white/55">{scenario.family}</span>
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">{scenario.priorityScore}/100</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black sm:text-3xl">{scenario.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/50">{scenario.subhook}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => replay(scenario.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
                    >
                      <Play size={14} /> Replay in Block Rush
                    </button>
                    <a
                      href={reference.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/[0.10]"
                    >
                      Original source <ExternalLink size={13} />
                    </a>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-2">
                  <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Original Block Blast gameplay</div>
                        <div className="mt-1 text-xs text-white/40">{reference.sourceLabel}</div>
                      </div>
                      <span className="rounded-full bg-fuchsia-300/10 px-2.5 py-1 text-[10px] font-black text-fuchsia-200">{reference.metric}</span>
                    </div>
                    <div className="aspect-[9/16] bg-black">
                      <OriginalGameplay mediaType={reference.mediaType} mediaUrl={reference.mediaUrl} label={reference.label} />
                    </div>
                    <div className="px-4 py-3 text-xs leading-relaxed text-white/40">{reference.note}</div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">Block Rush recreation</div>
                        <div className="mt-1 text-xs text-white/40">Real Block Rush components · scenario-mapped replay</div>
                      </div>
                      <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[10px] font-black text-cyan-200">Live UI</span>
                    </div>
                    <CreativeRushPlayer scenario={scenario} replayToken={replayTokens[scenario.id] ?? 0} />
                    <div className="px-4 py-3 text-xs leading-relaxed text-white/40">
                      The player reuses Block Rush background, board frame, empty-cell renderer, glossy block tiles, tray pieces and HUD. The normal gameplay bot is not touched.
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
