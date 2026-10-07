export type SocialPlatform = 'tiktok' | 'youtube-shorts';

export interface RankedSocialCreative {
  id: string;
  platform: SocialPlatform;
  title: string;
  creator: string;
  views: number;
  likes: number;
  comments?: number;
  shares?: number;
  durationSec?: number;
  sourceUrl: string;
  sourceLabel: string;
  note: string;
}

export const TIKTOK_CREATIVES: RankedSocialCreative[] = [
  {
    id: 'pomkori-skateboard',
    platform: 'tiktok',
    title: 'PomKori skateboarding dog × Block Blast',
    creator: '@pomkori_',
    views: 1_000_000_000,
    likes: 0,
    sourceUrl: 'https://www.themeasure.net/block-blast-video-cruises-to-a-billion-tiktok-views-in-a-month/',
    sourceLabel: 'The Measure',
    note: 'Block Blast partnership reported at 1B TikTok views in roughly one month; source article includes the embedded TikTok.',
  },
  {
    id: 'rigbycat',
    platform: 'tiktok',
    title: 'Rigby Cat × Block Blast',
    creator: '@iamrigbycat',
    views: 347_018_633,
    likes: 17_994_856,
    comments: 38_456,
    shares: 2_786_630,
    sourceUrl: 'https://www.tikwm.com/video/7510266760566803742.html',
    sourceLabel: 'TikWM mirror',
    note: 'Creator-style Block Blast integration; extremely strong organic reach and share count.',
  },
  {
    id: 'gbillz',
    platform: 'tiktok',
    title: 'Why they always do this',
    creator: '@gbillz',
    views: 10_183_345,
    likes: 709_785,
    comments: 583,
    shares: 15_894,
    sourceUrl: 'https://www.tikwm.com/video/7514058657152240942.html',
    sourceLabel: 'TikWM mirror',
    note: 'Meme/skit format with Block Blast reveal; comments explicitly recognize it as an ad.',
  },
  {
    id: 'humor-therapist',
    platform: 'tiktok',
    title: 'When your best friend is also your therapist',
    creator: '@humor_animations',
    views: 4_382_677,
    likes: 173_292,
    comments: 3_370,
    shares: 44_418,
    sourceUrl: 'https://www.tikwm.com/video/7524008598746483990.html',
    sourceLabel: 'TikWM mirror',
    note: 'Relatable animated comedy with Block Blast / Hungry Studio tags.',
  },
  {
    id: 'humor-life-2025',
    platform: 'tiktok',
    title: 'My life in 2025 be like',
    creator: '@humor_animations',
    views: 219_773,
    likes: 11_419,
    comments: 156,
    shares: 1_969,
    sourceUrl: 'https://tikwm.com/video/7538618098128063766.html',
    sourceLabel: 'TikWM mirror',
    note: 'Short animated relatable format tagged #blockblast #hungrystudio.',
  },
  {
    id: 'temych-school',
    platform: 'tiktok',
    title: 'School / Block Blast skit',
    creator: '@temychhh_',
    views: 137_880,
    likes: 14_321,
    comments: 96,
    shares: 3_627,
    sourceUrl: 'https://tikwm.com/video/7539449377467813125.html',
    sourceLabel: 'TikWM mirror',
    note: 'Short creator integration with Block Blast / Hungry Studio tags.',
  },
];

export const YOUTUBE_SHORTS_CREATIVES: RankedSocialCreative[] = [
  {
    id: 'dude-dans-sad-block',
    platform: 'youtube-shorts',
    title: 'Make Blocks Fun Again (Sad Block Meme)',
    creator: 'Dude Dans',
    views: 78_046_622,
    likes: 1_500_000,
    durationSec: 27,
    sourceUrl: 'https://www.youtube.com/watch?v=pJ2KThsQrPc',
    sourceLabel: 'YouTube',
    note: 'Sponsored Block Blast Short. Tubefilter documents the 27-second format and Block Blast partnership.',
  },
  {
    id: 'rennrat-christmas',
    platform: 'youtube-shorts',
    title: 'The Block That Changed Christmas',
    creator: 'Rennrat',
    views: 5_414_542,
    likes: 118_000,
    durationSec: 33,
    sourceUrl: 'https://www.youtube.com/watch?v=eAES6Xsc2h0',
    sourceLabel: 'YouTube',
    note: 'Sponsored Block Blast Short; creator-native animation rather than a conventional app-install spot.',
  },
  {
    id: 'auntie-charli-holiday',
    platform: 'youtube-shorts',
    title: 'Auntie Charli Block Blast sponsored Short',
    creator: 'Auntie Charli',
    views: 3_000_000,
    likes: 0,
    sourceUrl: 'https://www.tubefilter.com/2026/01/21/mrbeast-2-veritasium-dude-perfect-rennrat/',
    sourceLabel: 'Tubefilter report',
    note: 'Tubefilter reports roughly 3M views for the Block Blast-sponsored Auntie Charli Short; source article links/describes the placement.',
  },
];

export const socialPopularityScore = (item: RankedSocialCreative) => {
  const likes = item.likes || 0;
  const comments = item.comments || 0;
  const shares = item.shares || 0;
  return likes + comments * 4 + shares * 6;
};
