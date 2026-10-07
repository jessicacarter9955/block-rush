import { makePiece, type Board, type Piece } from './game';

export type CreativeKind =
  | 'choice_trap'
  | 'near_death'
  | 'massive_combo'
  | 'satisfying_clear'
  | 'high_score'
  | 'ugc_tutorial';

export interface CreativeMove {
  slot: number;
  r: number;
  c: number;
}

export interface CreativeScenario {
  id: CreativeKind;
  rank: number;
  title: string;
  family: string;
  hook: string;
  subhook: string;
  evidence: string;
  botFit: number;
  priorityScore: number;
  board: Board;
  tray: Piece[];
  script: CreativeMove[];
  labels?: string[];
}

export interface ObservedAdRow {
  rank: number;
  impressions: number;
  days: number;
  popularity: number;
  market: string;
  platform: string;
  source: string;
  note: string;
}

const boardFromRows = (rows: string[]): Board => {
  if (rows.length !== 8 || rows.some((row) => row.length !== 8)) {
    throw new Error('Creative boards must be 8×8.');
  }
  return rows.flatMap((row) =>
    [...row].map((cell) => (cell === '.' ? null : Number.parseInt(cell, 10) % 8)),
  );
};

export const OBSERVED_ADS: ObservedAdRow[] = [
  {
    rank: 1,
    impressions: 81_200_000,
    days: 356,
    popularity: 42_600,
    market: 'ID / MY / TW / US / KR / CA / AU / FR / TH / AE',
    platform: 'iOS',
    source: 'Pipiads public snapshot',
    note: 'Highest single-ad impression estimate found in the public Block Blast snapshot.',
  },
  {
    rank: 2,
    impressions: 79_600_000,
    days: 89,
    popularity: 113_900,
    market: 'US',
    platform: 'iOS',
    source: 'Pipiads public snapshot',
    note: 'Much higher rough impression velocity than the longer-running 81.2M creative.',
  },
  {
    rank: 3,
    impressions: 52_700_000,
    days: 361,
    popularity: 25_400,
    market: 'MY / ID / TH / TW / AU / US',
    platform: 'iOS',
    source: 'Pipiads public snapshot',
    note: 'Long-lived creative: nearly a year in the observed window.',
  },
  {
    rank: 4,
    impressions: 15_600_000,
    days: 363,
    popularity: 7_300,
    market: 'ID / MY / TH / TW / AE / KR / US / FR',
    platform: 'iOS',
    source: 'Pipiads public snapshot',
    note: 'Another long-running creative in the same public group.',
  },
  {
    rank: 5,
    impressions: 5_100_000,
    days: 149,
    popularity: 8_900,
    market: 'TH',
    platform: 'Android',
    source: 'Pipiads public snapshot',
    note: 'Strong regional creative with a shorter observed lifespan.',
  },
];

export const CREATIVE_SCENARIOS: CreativeScenario[] = [
  {
    id: 'choice_trap',
    rank: 1,
    title: 'A OR B · Choice Trap',
    family: 'Placement problem',
    hook: 'WHICH ONE SAVES THE BOARD?',
    subhook: 'A simple visual decision in the first second.',
    evidence: 'Recent AdMapix sample: the crowded-board placement video was reused across 8 records with 8 different playable fingerprints.',
    botFit: 5,
    priorityScore: 98,
    board: boardFromRows([
      '........',
      '12....34',
      '012..345',
      '123..456',
      '234..567',
      '345..670',
      '45....01',
      '56....12',
    ]),
    tray: [makePiece(25, 6), makePiece(1, 2), makePiece(19, 4)],
    script: [{ slot: 0, r: 2, c: 3 }],
    labels: ['A', 'B', 'C'],
  },
  {
    id: 'near_death',
    rank: 2,
    title: 'Near Death Save',
    family: 'Problem → payoff',
    hook: 'ONLY 1% CAN SAVE THIS',
    subhook: 'Dense board, one obvious crisis, instant relief.',
    evidence: 'Block Blast creative analyses repeatedly surface congested boards and save/solve framing as a direct gameplay hook.',
    botFit: 5,
    priorityScore: 96,
    board: boardFromRows([
      '........',
      '12.34567',
      '0123.567',
      '1234.670',
      '2345.701',
      '34.56701',
      '45.67012',
      '56.70123',
    ]),
    tray: [makePiece(20, 7), makePiece(17, 3), makePiece(1, 5)],
    script: [{ slot: 0, r: 2, c: 4 }],
  },
  {
    id: 'massive_combo',
    rank: 3,
    title: 'Massive Combo',
    family: 'Spectacle / payoff',
    hook: 'WAIT FOR THE 4-LINE CLEAR',
    subhook: 'Cross-shaped setup designed for a single explosive move.',
    evidence: 'The 2026 crowded-board sample visibly uses a strong particle punctuation after the placement sequence.',
    botFit: 5,
    priorityScore: 94,
    board: boardFromRows([
      '...12...',
      '...23...',
      '...34...',
      '012..567',
      '123..670',
      '...45...',
      '...56...',
      '...67...',
    ]),
    tray: [makePiece(25, 6), makePiece(19, 2), makePiece(20, 4)],
    script: [{ slot: 0, r: 3, c: 3 }],
  },
  {
    id: 'satisfying_clear',
    rank: 4,
    title: 'Satisfying Clear',
    family: 'Direct gameplay',
    hook: 'THIS CLEAR IS TOO SATISFYING',
    subhook: 'Long straight piece → multiple rows disappear at once.',
    evidence: 'Direct board-state progression is a recurring Block Blast creative format and is the easiest format to generate authentically from the real game.',
    botFit: 5,
    priorityScore: 91,
    board: boardFromRows([
      '........',
      '..12....',
      '.2345...',
      '345670..',
      '0123456.',
      '1234567.',
      '2345670.',
      '3456701.',
    ]),
    tray: [makePiece(22, 5), makePiece(17, 1), makePiece(1, 7)],
    script: [{ slot: 0, r: 4, c: 7 }],
  },
  {
    id: 'high_score',
    rank: 5,
    title: 'High Score Challenge',
    family: 'Challenge / social proof',
    hook: 'BEAT THIS SCORE',
    subhook: 'Simple skill challenge that can branch into dozens of score variants.',
    evidence: 'Challenge-style framing is common in puzzle UA because the CTA naturally becomes a gameplay task rather than a generic download prompt.',
    botFit: 5,
    priorityScore: 88,
    board: boardFromRows([
      '........',
      '........',
      '...1....',
      '..221...',
      '.33211..',
      '4433221.',
      '5544332.',
      '66.55443',
    ]),
    tray: [makePiece(0, 7), makePiece(1, 5), makePiece(25, 2)],
    script: [{ slot: 0, r: 7, c: 2 }],
  },
  {
    id: 'ugc_tutorial',
    rank: 6,
    title: 'UGC / Tutorial Hook',
    family: 'Creator-style / feature',
    hook: 'I WAS PLAYING BLOCK RUSH WRONG',
    subhook: 'Creator-style text wrapped around authentic gameplay.',
    evidence: 'Recent Block Blast references include customization/tutorial sequences and physical/creator-style hooks that lead into gameplay.',
    botFit: 4,
    priorityScore: 84,
    board: boardFromRows([
      '........',
      '........',
      '........',
      '...11...',
      '..221...',
      '.33211..',
      '443322..',
      '554433..',
    ]),
    tray: [makePiece(25, 6), makePiece(19, 3), makePiece(1, 7)],
    script: [{ slot: 0, r: 0, c: 0 }],
  },
];

export const getCreativeScenario = (id: CreativeKind): CreativeScenario =>
  CREATIVE_SCENARIOS.find((scenario) => scenario.id === id) ?? CREATIVE_SCENARIOS[0];
