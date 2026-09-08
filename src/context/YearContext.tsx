import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'selectedYear';

function readStoredYear(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 1970 && parsed < 3000) return parsed;
  } catch {
    /* storage unavailable */
  }
  return new Date().getFullYear();
}

interface YearValue {
  year: number;
  setYear: (year: number) => void;
  options: number[];
  isCurrentYear: boolean;
}

const YearContext = createContext<YearValue | null>(null);

export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState(readStoredYear);

  const setYear = useCallback((next: number) => {
    setYearState(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<YearValue>(() => {
    const now = new Date().getFullYear();
    const options: number[] = [];
    for (let y = now - 4; y <= now + 1; y++) options.push(y);
    if (!options.includes(year)) options.push(year);
    options.sort((a, b) => b - a);
    return { year, setYear, options, isCurrentYear: year === now };
  }, [year, setYear]);

  return <YearContext.Provider value={value}>{children}</YearContext.Provider>;
}

export function useYear(): YearValue {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used inside YearProvider');
  return ctx;
}
