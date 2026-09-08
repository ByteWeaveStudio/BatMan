/*
 * Chart colour system.
 *
 * Categorical slots and the sequential ramp were checked with the data-viz
 * validator against both surfaces (#ffffff light, #121a2b dark):
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
  text: '#101623',
  muted: '#5c6675',
  subtle: '#8b94a3',
  grid: '#eceef2',
  surface: '#ffffff',
  border: '#e6e8ec',
  series: ['#4f46e5', '#d97706', '#0d9488', '#e11d48'],
  seriesWash: 'rgba(79, 70, 229, 0.10)',
  reference: '#8b94a3',
  ramp: ['#eef0fe', '#c7c9fa', '#9a9cf3', '#6b68ea', '#4338ca'],
  noData: '#f1f2f5',
};

const DARK: ChartTheme = {
  mode: 'dark',
  text: '#e8ecf4',
  muted: '#98a3b8',
  subtle: '#6d798f',
  grid: '#1e2942',
  surface: '#121a2b',
  border: '#232e45',
  series: ['#7c83f2', '#c98500', '#12ab9c', '#f4536e'],
  seriesWash: 'rgba(124, 131, 242, 0.14)',
  reference: '#6d798f',
  ramp: ['#1a2340', '#2b3670', '#414ca8', '#5a63d4', '#8f95f5'],
  noData: '#151d30',
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
