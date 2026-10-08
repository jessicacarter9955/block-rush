export interface SensorTowerMetric {
  label: string;
  value: string;
  context: string;
  sourceUrl: string;
}

export interface SensorTowerReport {
  title: string;
  period: string;
  metric: string;
  detail: string;
  sourceUrl: string;
}

export const SENSOR_TOWER_OVERVIEW_URL =
  'https://app.sensortower.com/overview/com.block.juggle?country=US';

export const SENSOR_TOWER_METRICS: SensorTowerMetric[] = [
  {
    label: 'Install range',
    value: '1B–5B',
    context: 'Google Play install range shown on Sensor Tower public overview.',
    sourceUrl: SENSOR_TOWER_OVERVIEW_URL,
  },
  {
    label: 'Worldwide downloads',
    value: '14M',
    context: 'Sensor Tower worldwide downloads · last month.',
    sourceUrl: SENSOR_TOWER_OVERVIEW_URL,
  },
  {
    label: 'Advertising status',
    value: 'Active',
    context: 'Sensor Tower marks Block Blast as “Advertised on Any Network: Active”.',
    sourceUrl: SENSOR_TOWER_OVERVIEW_URL,
  },
  {
    label: 'Top countries / regions',
    value: 'Indonesia · India · Brazil',
    context: 'Top countries / regions shown in the current public overview.',
    sourceUrl: SENSOR_TOWER_OVERVIEW_URL,
  },
  {
    label: 'US game rank',
    value: '#3',
    context: 'Game downloads ranking on the public US overview when crawled.',
    sourceUrl: SENSOR_TOWER_OVERVIEW_URL,
  },
  {
    label: 'India puzzle rank',
    value: '#2',
    context: 'Game / Puzzle downloads ranking on the public India overview when crawled.',
    sourceUrl: 'https://app.sensortower.com/overview/com.block.juggle?country=IN',
  },
  {
    label: 'Brazil puzzle rank',
    value: '#1',
    context: 'Game / Puzzle downloads ranking on the public Brazil overview when crawled.',
    sourceUrl: 'https://app.sensortower.com/overview/com.block.juggle?country=BR',
  },
];

export const SENSOR_TOWER_REPORTS: SensorTowerReport[] = [
  {
    title: 'Europe · Top Down Games',
    period: 'Q2 2025',
    metric: 'Weekly downloads peaked around 1.1M',
    detail: 'Weekly active users moved from roughly 32.4M to 25.1M through the quarter.',
    sourceUrl: 'https://sensortower.com/blog/2025-q2-unified-top-5-top%20down%20games-units-europe-60114aab241bc16eb834a499',
  },
  {
    title: 'Italy · Hypercasual Games',
    period: 'Q4 2025',
    metric: 'Weekly downloads rose from ~14.7K to ~46K',
    detail: 'Active users increased from roughly 762K to more than 902K.',
    sourceUrl: 'https://sensortower.com/blog/2025-q4-ios-top-5-hypercasual-games-units-it-643acc7de1714cfff1e77c54',
  },
  {
    title: 'Hungry Studio × Sensor Tower',
    period: '2026',
    metric: '10,000+ A/B tests during 2025',
    detail: 'Hungry Studio says more than 300 experiments ran simultaneously each day, using Sensor Tower across product, strategy, marketing and sales.',
    sourceUrl: 'https://sensortower.com/blog/hungry-studio-use-case',
  },
];

export const SENSOR_TOWER_LIMITATION =
  'Public Sensor Tower pages expose app-level performance and advertising status. Per-creative ad intelligence / Creative Gallery data generally requires Sensor Tower account access, so this tab does not fabricate creative-level impression or popularity rankings.';
