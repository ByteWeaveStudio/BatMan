/**
 * Category colours.
 *
 * Fixed slot order, validated with the data-viz validator on the light surface
 * (#ffffff): lightness band PASS, chroma floor PASS, adjacent CVD ΔE 10.2 PASS,
 * normal-vision ΔE 21.1 PASS, contrast PASS. Assign by slot, never by rank.
 */
export const CATEGORY_COLORS = [
  '#4f46e5',
  '#d97706',
  '#0d9488',
  '#e11d48',
  '#0891b2',
  '#65a30d',
  '#db2777',
  '#6d28d9',
] as const;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? '');
  if (!m) return null;
  return [Number.parseInt(m[1], 16), Number.parseInt(m[2], 16), Number.parseInt(m[3], 16)];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const SURFACE: Record<'light' | 'dark', [number, number, number]> = {
  light: [255, 255, 255],
  dark: [20, 20, 22],
};

/**
 * v1 stored near-white pastels for categories. They vanish against the light
 * surface, so darken (or lighten, in dark mode) until the mark clears 3:1.
 * The stored value is never mutated — only what we paint with.
 */
export function readableColor(hex: string, mode: 'light' | 'dark'): string {
  const rgb = parseHex(hex);
  if (!rgb) return mode === 'dark' ? '#f5c518' : '#b8860b';
  const surface = SURFACE[mode];
  let current = rgb;
  for (let i = 0; i < 24 && contrast(current, surface) < 3; i++) {
    current = mode === 'light'
      ? [current[0] * 0.88, current[1] * 0.88, current[2] * 0.88]
      : [current[0] + (255 - current[0]) * 0.12, current[1] + (255 - current[1]) * 0.12, current[2] + (255 - current[2]) * 0.12];
  }
  return toHex(current);
}

/** Picks the least-used slot so new categories spread across the palette. */
export function nextCategoryColor(used: string[]): string {
  const counts = CATEGORY_COLORS.map((c) => used.filter((u) => u?.toLowerCase() === c).length);
  const min = Math.min(...counts);
  return CATEGORY_COLORS[counts.indexOf(min)];
}
