import type { CreativeKind } from './creative-scenarios';
import { RANKED_BLOCK_BLAST_ADS, type RankedBlockBlastAd } from './creative-ad-ranking';

const MAP: Record<CreativeKind, string> = {
  choice_trap: 'sharpen-focus',
  near_death: 'monkey-brain',
  massive_combo: 'tetris-sudoku',
  satisfying_clear: 'welcome-world',
  high_score: 'everyone-talking',
  ugc_tutorial: 'dude-dans-sad-block',
};

export type CreativeVideoReference = RankedBlockBlastAd;

export const getCreativeVideoReference = (id: CreativeKind): CreativeVideoReference => {
  const target = MAP[id];
  return RANKED_BLOCK_BLAST_ADS.find((ad) => ad.id === target) ?? RANKED_BLOCK_BLAST_ADS[0];
};
