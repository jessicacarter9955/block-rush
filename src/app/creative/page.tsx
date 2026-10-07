'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Sparkles, Trophy } from 'lucide-react';
import { CreativeRushPlayer } from '@/components/creative/CreativeRushPlayer';
import { CREATIVE_SCENARIOS } from '@/lib/creative-scenarios';
import { getCreativeVideoReference } from '@/lib/creative-references';
import {
  RANKED_BLOCK_BLAST_ADS,
  formatDuration,
  type AdMediaType,
} from '@/lib/creative-ad-ranking';
import {
  TIKTOK_CREATIVES,
  YOUTUBE_SHORTS_CREATIVES,
  socialPopularityScore,
  type RankedSocialCreative,
} from '@/lib/creative-social-ranking';

type DurationFilter = 'under60' | '1to3' | 'over3' | 'all';
type CreativeTab = 'ads' | 'tiktok' | 'youtube';
type SocialSort = 'views' | 'popularity';

function AdPlayer({
  mediaType,
  mediaUrl,
  label,
}: {
  mediaType: AdMediaType;
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
    <iframe
      className="h-full w-full"
      src={mediaUrl}
      title={label}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}

function matchesDuration(seconds: number, filter: DurationFilter) {
  if (filter === 'under60') return seconds < 60;
  if (filter === '1to3') return seconds >= 60 && seconds < 180;
  if (filter === 'over3') return seconds >= 180;
  return true;
}

function fmtMetric(value: number) {
  if (!value) return '—';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(value);
}

function SocialRankingTable({
  items,
  sort,
  onSort,
}: {
  items: RankedSocialCreative[];
  sort: SocialSort;
  onSort: (sort: SocialSort) => void;
}) {
  const ranked = [...items].sort((a, b) =>
    sort === 'views'
      ? b.views - a.views
      : socialPopularityScore(b) - socialPopularityScore(a)
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => onSort('views')}
          className={`rounded-full border px-3 py-2 text-xs font-black transition ${sort === 'views' ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-white/50'}`}
        >
          Sort by views
        </button>
        <button
          onClick={() => onSort('popularity')}
          className={`rounded-full border px-3 py-2 text-xs font-black transition ${sort === 'popularity' ? 'border-fuchsia-300/60 bg-fuchsia-300/15 text-fuchsia-100' : 'border-white/10 bg-white/[0.04] text-white/50'}`}
        >
          Sort by popularity
        </button>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-[#0b1738]">
        <table className="min-w-[1080px] w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Creative</th>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3">Likes</th>
              <th className="px-4 py-3">Shares</th>
              <th className="px-4 py-3">Popularity</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Video</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((item, index) => (
              <tr key={item.id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-4 py-4 text-lg font-black text-amber-300">#{index + 1}</td>
                <td className="max-w-[340px] px-4 py-4">
                  <div className="font-black text-white">{item.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-white/40">{item.note}</div>
                </td>
                <td className="px-4 py-4 font-bold text-white/75">{item.creator}</td>
                <td className="px-4 py-4 text-lg font-black text-cyan-200">{fmtMetric(item.views)}</td>
                <td className="px-4 py-4 text-white/65">{fmtMetric(item.likes)}</td>
                <td className="px-4 py-4 text-white/65">{fmtMetric(item.shares ?? 0)}</td>
                <td className="px-4 py-4 font-mono text-fuchsia-200">{fmtMetric(socialPopularityScore(item))}</td>
                <td className="px-4 py-4 font-mono text-white/65">{item.durationSec ? formatDuration(item.durationSec) : '—'}</td>
                <td className="px-4 py-4">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:bg-white/[0.12]"
                  >
                    Open video <ExternalLink size={13} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}se client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Sparkles, Trophy } from 'lucide-react';
import { CreativeRushPlayer } from '@/components/creative/CreativeRushPlayer';
import { CREATIVE_SCENARIOS } from '@/lib/creative-scenarios';
import { getCreativeVideoReference } from '@/lib/creative-references';
import {
  RANKED_BLOCK_BLAST_ADS,
  formatDuration,
  type AdMediaType,
} from '@/lib/creative-ad-ranking';

type DurationFilter = 'under60' | '1to3' | 'over3' | 'all';\ntype CreativeTab = 'ads' | 'tiktok' | 'youtube';\ntype SocialSort = 'views' | 'popularity';

function AdPlayer({
  mediaType,
  mediaUrl,
  label,
}: {
  mediaType: AdMediaType;
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
    <iframe
      className="h-full w-full"
      src={mediaUrl}
      title={label}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}

function matchesDuration(seconds: number, filter: DurationFilter) {
  if (filter === 'under60') return seconds < 60;
  if (filter === '1to3') return seconds >= 60 && seconds < 180;
  if (filter === 'over3') return seconds >= 180;
  return true;
}

export default function CreativePage() {
  const initialTokens = useMemo(
    () => Object.fromEntries(CREATIVE_SCENARIOS.map((scenario) => [scenario.id, 0])) as Record<string, number>,
    [],
  );
  const [replayTokens, setReplayTokens] = useState<Record<string, number>>(initialTokens);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('under60');
  const [shortsOnly, setShortsOnly] = useState(false);

  const rankedAds = useMemo(
    () => RANKED_BLOCK_BLAST_ADS.filter((ad) =>
      matchesDuration(ad.durationSec, durationFilter) &&
      (!shortsOnly || ad.format === 'shorts')
    ),
    [durationFilter, shortsOnly],
  );

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
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Block Blast Ads vs Block Rush</h1>
            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-white/55 sm:text-base">
              Ranked references are now advertising creatives only. The default view keeps sub-1-minute ads visible and hides long-form content.
              Use Shorts only when you want creator-style short-form references.
            </p>
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Default filter</div>
            <div className="mt-1 text-sm font-bold text-white">Ads · under 1 minute</div>
          </div>
        </header>

        <section className="mt-10">
          <div className="mb-6 flex flex-wrap gap-2 rounded-[24px] border border-white/10 bg-[#08132e] p-2">
            {([
              ['ads', 'Ads Creative'],
              ['tiktok', 'TikTok'],
              ['youtube', 'YouTube Shorts'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`rounded-2xl px-5 py-3 text-sm font-black transition ${activeTab === value ? 'bg-white text-slate-950 shadow-lg' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'ads' && (
          <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-300" />
                <h2 className="text-2xl font-black">Ranked Block Blast ad creatives</h2>
              </div>
              <p className="mt-2 max-w-4xl text-sm text-white/45">
                Direct ad / sponsored-short references only. Every row includes its duration and a link to the video or the page that hosts the ad.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                ['under60', '< 1 min'],
                ['1to3', '1–3 min'],
                ['over3', '> 3 min'],
                ['all', 'All durations'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setDurationFilter(value)}
                  className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                    durationFilter === value
                      ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setShortsOnly((value) => !value)}
                className={`rounded-full border px-3 py-2 text-xs font-black transition ${
                  shortsOnly
                    ? 'border-fuchsia-300/60 bg-fuchsia-300/15 text-fuchsia-100'
                    : 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/[0.08]'
                }`}
              >
                Shorts only {shortsOnly ? '✓' : ''}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-[#0b1738]">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Creative</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Metric</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Video</th>
                </tr>
              </thead>
              <tbody>
                {rankedAds.map((ad) => (
                  <tr key={ad.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-4 py-4 text-lg font-black text-amber-300">#{ad.rank}</td>
                    <td className="max-w-[360px] px-4 py-4">
                      <div className="font-black text-white">{ad.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-white/40">{ad.note}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        ad.format === 'shorts'
                          ? 'bg-fuchsia-300/10 text-fuchsia-200'
                          : 'bg-cyan-300/10 text-cyan-200'
                      }`}>
                        {ad.format === 'shorts' ? 'Shorts' : 'Video ad'}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-base font-black text-white">{formatDuration(ad.durationSec)}</td>
                    <td className="px-4 py-4 text-white/70">{ad.metric}</td>
                    <td className="px-4 py-4 text-xs text-white/45">{ad.source}</td>
                    <td className="px-4 py-4">
                      <a
                        href={ad.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-2 text-xs font-black text-white transition hover:bg-white/[0.12]"
                      >
                        Open video <ExternalLink size={13} />
                      </a>
                    </td>
                  </tr>
                ))}
                {rankedAds.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-white/40">
                      No ranked ad references currently match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
          )}

          {activeTab === 'tiktok' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-black">TikTok Block Blast creative ranking</h2>
                <p className="mt-2 max-w-4xl text-sm text-white/45">
                  Creator / sponsored Block Blast videos ranked by public views or engagement-weighted popularity.
                </p>
              </div>
              <SocialRankingTable items={TIKTOK_CREATIVES} sort={socialSort} onSort={setSocialSort} />
            </div>
          )}

          {activeTab === 'youtube' && (
            <div>
              <div className="mb-4">
                <h2 className="text-2xl font-black">YouTube Shorts Block Blast ranking</h2>
                <p className="mt-2 max-w-4xl text-sm text-white/45">
                  Sponsored / creator-native Block Blast Shorts ranked by views or popularity.
                </p>
              </div>
              <SocialRankingTable items={YOUTUBE_SHORTS_CREATIVES} sort={socialSort} onSort={setSocialSort} />
            </div>
          )}
        </section>

        {activeTab === 'ads' && (
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
                      <span className="rounded-full bg-fuchsia-300/10 px-3 py-1 text-xs font-black text-fuchsia-200">
                        {reference.format === 'shorts' ? 'SHORTS' : 'AD'} · {formatDuration(reference.durationSec)}
                      </span>
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
                      Open ad video <ExternalLink size={13} />
                    </a>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-2">
                  <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Original Block Blast ad</div>
                        <div className="mt-1 text-xs text-white/40">{reference.title}</div>
                      </div>
                      <span className="rounded-full bg-fuchsia-300/10 px-2.5 py-1 text-[10px] font-black text-fuchsia-200">{reference.metric}</span>
                    </div>
                    <div className="aspect-[9/16] bg-black">
                      <AdPlayer mediaType={reference.mediaType} mediaUrl={reference.mediaUrl} label={reference.title} />
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
                      The normal gameplay bot remains untouched. This player exists only for creative replication and comparison.
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
        )}
      </div>
    </main>
  );
}
