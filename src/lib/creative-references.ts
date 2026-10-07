import type { CreativeKind } from './creative-scenarios';

export type CreativeVideoReference = {
  id: CreativeKind;
  rank: number;
  label: string;
  sourceLabel: string;
  mediaType: 'youtube' | 'video';
  mediaUrl: string;
  sourceUrl: string;
  metric: string;
  note: string;
};

export const CREATIVE_VIDEO_REFERENCES: CreativeVideoReference[] = [
  {
    id: 'choice_trap',
    rank: 1,
    label: 'Choice / placement gameplay reference',
    sourceLabel: 'Real Block Blast gameplay',
    mediaType: 'youtube',
    mediaUrl: 'qFYLDNCUPuA',
    sourceUrl: 'https://www.youtube.com/watch?v=qFYLDNCUPuA',
    metric: 'Recent public gameplay short',
    note: 'Use the real piece-drag cadence and board readability as the motion target; the Block Rush player on the right replays the mapped choice scenario.',
  },
  {
    id: 'near_death',
    rank: 2,
    label: 'Dense-board / save gameplay reference',
    sourceLabel: 'Real Block Blast gameplay',
    mediaType: 'youtube',
    mediaUrl: 'QiCfN0eIK4k',
    sourceUrl: 'https://www.youtube.com/watch?v=QiCfN0eIK4k',
    metric: 'Recent public gameplay short',
    note: 'Reference for authentic drag speed, score movement and line-clear pacing on a constrained board.',
  },
  {
    id: 'massive_combo',
    rank: 3,
    label: 'Block Blast ad / combo gameplay reference',
    sourceLabel: 'Published Block Blast #ad video',
    mediaType: 'youtube',
    mediaUrl: 'AGb19GDpAQs',
    sourceUrl: 'https://www.youtube.com/watch?v=AGb19GDpAQs',
    metric: '1.1M+ public views',
    note: 'A public Block Blast ad video. The right player maps the concept to a 4-line combo with the Block Rush runtime UI.',
  },
  {
    id: 'satisfying_clear',
    rank: 4,
    label: 'Satisfying gameplay reference',
    sourceLabel: 'Real Block Blast gameplay mirror',
    mediaType: 'video',
    mediaUrl: 'https://www.tikwm.com/video/media/play/7454980028539899169.mp4',
    sourceUrl: 'https://tikwm.com/video/7454980028539899169.html',
    metric: 'Public gameplay clip',
    note: 'Direct gameplay clip used to match clear timing and the visual rhythm of the drag → drop → clear sequence.',
  },
  {
    id: 'high_score',
    rank: 5,
    label: 'Score-run gameplay reference',
    sourceLabel: 'Real Block Blast gameplay mirror',
    mediaType: 'video',
    mediaUrl: 'https://www.tikwm.com/video/media/play/7480357402060180782.mp4',
    sourceUrl: 'https://tikwm.com/video/7480357402060180782.html',
    metric: 'Public score gameplay clip',
    note: 'Reference for continuous-play cadence and score pressure.',
  },
  {
    id: 'ugc_tutorial',
    rank: 6,
    label: 'UGC / sponsored-style gameplay reference',
    sourceLabel: 'Real Block Blast social video',
    mediaType: 'video',
    mediaUrl: 'https://www.tikwm.com/video/media/play/7514058657152240942.mp4',
    sourceUrl: 'https://www.tikwm.com/video/7514058657152240942.html',
    metric: 'Public social gameplay video',
    note: 'Reference for creator-style opening and the transition into visible Block Blast gameplay.',
  },
];

export const getCreativeVideoReference = (id: CreativeKind) =>
  CREATIVE_VIDEO_REFERENCES.find((reference) => reference.id === id) ?? CREATIVE_VIDEO_REFERENCES[0];
