export interface OfficialPublisherChannel {
  platform: string;
  label: string;
  url: string;
  metric?: string;
  note: string;
}

export interface OfficialPublisherVideo {
  id: string;
  platform: 'youtube' | 'tiktok' | 'linkedin' | 'publisher-ad';
  title: string;
  url: string;
  metric?: string;
  duration?: string;
  note: string;
}

export const OFFICIAL_PUBLISHER_CHANNELS: OfficialPublisherChannel[] = [
  {
    platform: 'TikTok',
    label: '@blockblastofficial',
    url: 'https://www.tiktok.com/@blockblastofficial',
    note: 'Official Block Blast TikTok handle referenced by the developer in the App Store listing.',
  },
  {
    platform: 'YouTube',
    label: '@blockblastofficial',
    url: 'https://www.youtube.com/@blockblastofficial',
    metric: '~463K subscribers · ~86M channel views',
    note: 'Official Block Blast YouTube channel linked from the Block Blast official site.',
  },
  {
    platform: 'Official site',
    label: 'BlockBlast.com',
    url: 'https://www.blockblast.com/about-us',
    note: 'Official site that links the publisher social channels.',
  },
  {
    platform: 'Hungry Studio',
    label: 'Publisher site',
    url: 'https://www.hungrystudio.com/',
    note: 'Official Hungry Studio publisher site.',
  },
];

export const OFFICIAL_PUBLISHER_VIDEOS: OfficialPublisherVideo[] = [
  {
    id: 'official-gameplay-classic-adventure',
    platform: 'linkedin',
    title: 'Official gameplay video · Classic + Adventure',
    url: 'https://www.linkedin.com/posts/hungrystudio2021_mobilegaming-blockblast-hungrystudio-activity-7364174376352509952-bQ1J',
    note: 'Hungry Studio explicitly describes this as its latest official gameplay video, covering Classic and Adventure modes.',
  },
  {
    id: 'official-youtube-channel',
    platform: 'youtube',
    title: 'Block Blast! Official · YouTube videos / Shorts',
    url: 'https://www.youtube.com/@blockblastofficial',
    metric: '~463K subscribers · ~86M views · 287 videos',
    note: 'Official channel. Open the channel to browse publisher-uploaded videos and Shorts only.',
  },
  {
    id: 'official-tiktok-channel',
    platform: 'tiktok',
    title: 'Block Blast! Official · TikTok videos',
    url: 'https://www.tiktok.com/@blockblastofficial',
    note: 'Official publisher TikTok account identified in the App Store listing.',
  },
  {
    id: 'publisher-ads-ispot',
    platform: 'publisher-ad',
    title: 'Hungry Studio Block Blast commercial library',
    url: 'https://www.ispot.tv/product/R_y',
    note: 'Public library of Hungry Studio Block Blast commercials; useful as a public mirror for publisher-run ad creatives.',
  },
];
