export type AdFormat = 'shorts' | 'video-ad';
export type AdMediaType = 'youtube' | 'iframe';

export interface RankedBlockBlastAd {
  id: string;
  rank: number;
  title: string;
  format: AdFormat;
  durationSec: number;
  mediaType: AdMediaType;
  mediaUrl: string;
  sourceUrl: string;
  metric: string;
  metricValue?: number;
  source: string;
  note: string;
}

export const RANKED_BLOCK_BLAST_ADS: RankedBlockBlastAd[] = [
  {
    id: 'dude-dans-sad-block',
    rank: 1,
    title: 'Make Blocks Fun Again (Sad Block Meme)',
    format: 'shorts',
    durationSec: 27,
    mediaType: 'youtube',
    mediaUrl: 'pJ2KThsQrPc',
    sourceUrl: 'https://www.youtube.com/watch?v=pJ2KThsQrPc',
    metric: '78M+ YouTube views',
    metricValue: 78_000_000,
    source: 'YouTube / Tubefilter',
    note: 'Sponsored Block Blast Short. Tubefilter documents the 27-second duration and Block Blast sponsorship.',
  },
  {
    id: 'rennrat-christmas',
    rank: 2,
    title: 'The Block That Changed Christmas',
    format: 'shorts',
    durationSec: 33,
    mediaType: 'youtube',
    mediaUrl: 'eAES6Xsc2h0',
    sourceUrl: 'https://www.youtube.com/watch?v=eAES6Xsc2h0',
    metric: '5.4M+ YouTube views',
    metricValue: 5_400_000,
    source: 'YouTube / Tubefilter',
    note: 'Sponsored Block Blast Short. Tubefilter documents the 33-second duration.',
  },
  {
    id: 'everyone-talking',
    rank: 3,
    title: 'The Game Everyone Is Talking About',
    format: 'video-ad',
    durationSec: 15,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/65Kz',
    sourceUrl: 'https://www.ispot.tv/ad/65Kz/block-blast-the-game-everyone-is-talking-about',
    metric: '15s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published March 2024.',
  },
  {
    id: 'totally-different',
    rank: 4,
    title: 'Totally Different Thing',
    format: 'video-ad',
    durationSec: 15,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/5ty2',
    sourceUrl: 'https://www.ispot.tv/ad/5ty2/block-blast-adventure-master-totally-different-thing',
    metric: '15s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published September 2023.',
  },
  {
    id: 'tetris-sudoku',
    rank: 5,
    title: 'Tetris and Sudoku',
    format: 'video-ad',
    durationSec: 30,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/5QdJ',
    sourceUrl: 'https://www.ispot.tv/ad/5QdJ/hungry-studio-tetris-and-sodoku',
    metric: '30s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published December 2023.',
  },
  {
    id: 'welcome-world',
    rank: 6,
    title: 'Welcome to the World of Block Blast',
    format: 'video-ad',
    durationSec: 30,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/6O9e',
    sourceUrl: 'https://www.ispot.tv/ad/6O9e/block-blast-welcome-to-the-world-of-block-blast',
    metric: '30s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published March 2024.',
  },
  {
    id: 'sharpen-focus',
    rank: 7,
    title: 'Sharpen Your Focus',
    format: 'video-ad',
    durationSec: 30,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/62oW',
    sourceUrl: 'https://www.ispot.tv/ad/62oW/block-blast-sharpen-your-focus',
    metric: '30s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published March 2024.',
  },
  {
    id: 'need-break',
    rank: 8,
    title: 'Need a Break?',
    format: 'video-ad',
    durationSec: 30,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/6bJK',
    sourceUrl: 'https://www.ispot.tv/ad/6bJK/block-blast-need-a-break',
    metric: '30s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published March 2024.',
  },
  {
    id: 'monkey-brain',
    rank: 9,
    title: 'Monkey Brain',
    format: 'video-ad',
    durationSec: 30,
    mediaType: 'iframe',
    mediaUrl: 'https://www.ispot.tv/share/5td2',
    sourceUrl: 'https://www.ispot.tv/ad/5td2/block-blast-monkey-brain',
    metric: '30s official spot',
    source: 'iSpot / Hungry Studio',
    note: 'Official Hungry Studio Block Blast commercial, published September 2023.',
  },
];

export const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins ? `${mins}:${String(secs).padStart(2, '0')}` : `0:${String(secs).padStart(2, '0')}`;
};
