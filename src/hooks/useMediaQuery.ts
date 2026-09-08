import { useSyncExternalStore } from 'react';

const cache = new Map<string, MediaQueryList>();

function mql(query: string): MediaQueryList {
  let m = cache.get(query);
  if (!m) {
    m = window.matchMedia(query);
    cache.set(query, m);
  }
  return m;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = mql(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => mql(query).matches,
    () => false,
  );
}

/** Breakpoints match the CSS: rail at 1024px, tablet layout at 768px. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px)');
export const useIsPhone = () => !useMediaQuery('(min-width: 768px)');
