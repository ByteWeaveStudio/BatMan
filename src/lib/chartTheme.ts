/*
 * Chart colour system.
 *
 * Categorical slots and the sequential ramp were checked with the data-viz
 * validator against both surfaces (#ffffff light, #141416 dark):
 *   categorical  all-pairs — light PASS, dark PASS (one 6–8 CVD warn pair,
 *                covered by the always-present text labels)
 *   sequential   single hue, monotone lightness, >=0.06 step gaps
 * Changing a value here means re-running that validator.
 */

export interface ChartTheme {
  mode: 'light' | 'dark';
  text: string;
  muted: string;
  subtle: string;
  grid: string;
  surface: string;
  border: string;
  /** Fixed slot order — a series keeps its slot regardless of rank. */
  series: [string, string, string, string];
  seriesWash: string;
  reference: string;
  /** Sequential bins, near-zero → high. */
  ramp: [string, string, string, string, string];
  noData: string;
}

const LIGHT: ChartTheme = {
  mode: 'light',
  text: '#14130f',
  muted: '#5f5c54',
  subtle: '#8c887e',
  grid: '#efeeea',
  surface: '#ffffff',
  border: '#e8e6e1',
  series: ['#b8860b', '#0d9488', '#e11d48', '#6366f1'],
  seriesWash: 'rgba(184, 134, 11, 0.12)',
  reference: '#8c887e',
  ramp: ['#fdf3d7', '#f6dc95', '#e5bc4a', '#c69208', '#8a6208'],
  noData: '#f2f1ed',
};

const DARK: ChartTheme = {
  mode: 'dark',
  text: '#ededf0',
  muted: '#a1a1aa',
  subtle: '#71717a',
  grid: '#202024',
  surface: '#141416',
  border: '#26262b',
  series: ['#bf8600', '#12ab9c', '#f4536e', '#7c83f2'],
  seriesWash: 'rgba(191, 134, 0, 0.16)',
  reference: '#71717a',
  ramp: ['#241d07', '#463809', '#78600d', '#b08c11', '#f5c518'],
  noData: '#17171a',
};

export function chartTheme(mode: 'light' | 'dark'): ChartTheme {
  return mode === 'dark' ? DARK : LIGHT;
}

/** Five bins keeps the legend readable; past ~7 classes adjacent bins blur. */
export const RAMP_BINS = [
  { max: 0, label: '0%' },
  { max: 25, label: '1–25%' },
  { max: 50, label: '26–50%' },
  { max: 75, label: '51–75%' },
  { max: 100, label: '76–100%' },
] as const;

export function rampColor(theme: ChartTheme, pct: number): string {
  if (pct <= 0) return theme.ramp[0];
  if (pct <= 25) return theme.ramp[1];
  if (pct <= 50) return theme.ramp[2];
  if (pct <= 75) return theme.ramp[3];
  return theme.ramp[4];
}
