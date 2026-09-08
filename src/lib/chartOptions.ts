import type { ChartOptions, ScaleOptions } from 'chart.js';
import type { ChartTheme } from './chartTheme';

export function baseOptions(theme: ChartTheme): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    font: { family: "'Inter Variable', system-ui, sans-serif" },
    layout: { padding: { top: 4, right: 4 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.mode === 'dark' ? '#1b2539' : '#101623',
        titleColor: '#ffffff',
        bodyColor: theme.mode === 'dark' ? '#cbd3e2' : '#e8ecf4',
        borderColor: theme.mode === 'dark' ? '#33405c' : 'transparent',
        borderWidth: theme.mode === 'dark' ? 1 : 0,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { size: 12, weight: 600 },
        bodyFont: { size: 12 },
      },
    },
  } as ChartOptions;
}

export function categoryScale(theme: ChartTheme, extra: Record<string, unknown> = {}): ScaleOptions<'category'> {
  return {
    grid: { display: false },
    border: { color: theme.border },
    ticks: { color: theme.subtle, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 8 },
    ...extra,
  } as ScaleOptions<'category'>;
}

export function valueScale(theme: ChartTheme, extra: Record<string, unknown> = {}): ScaleOptions<'linear'> {
  return {
    beginAtZero: true,
    grid: { color: theme.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: theme.subtle, font: { size: 11 }, padding: 8, maxTicksLimit: 6 },
    ...extra,
  } as ScaleOptions<'linear'>;
}

/** Bars stay thin and capped so the band keeps its air. */
export const BAR_SIZING = { maxBarThickness: 24, borderRadius: 4, borderSkipped: 'bottom' as const };
