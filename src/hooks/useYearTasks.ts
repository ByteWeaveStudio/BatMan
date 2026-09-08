import { useMemo } from 'react';
import { sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { dateKey, daysInMonth, yearMonthKey } from '../lib/dates';
import type { MonthTasks } from '../lib/types';

type YearTasks = Record<string, MonthTasks>;

function normalize(raw: unknown): YearTasks {
  return (raw as YearTasks) ?? {};
}

export interface DayCell {
  date: string;
  /** null when no habits were tracked that month, so "no data" ≠ "0% done". */
  pct: number | null;
  done: number;
  total: number;
}

export function useYearTasks(uid: string, year: number) {
  const path = uid ? sectionPath(uid, year, 'tasks') : null;
  const { data, loading } = useDbValue<YearTasks>(path, normalize);

  const monthly = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const tasks = data[yearMonthKey(year, month)] ?? {};
        const names = Object.keys(tasks);
        const total = daysInMonth(year, month);
        if (names.length === 0) return { month, pct: 0, tracked: false, habits: 0 };
        let ticks = 0;
        names.forEach((name) => {
          const days = tasks[name] ?? {};
          for (let d = 1; d <= total; d++) if (days[String(d)] === true) ticks += 1;
        });
        const possible = names.length * total;
        return { month, pct: possible ? (ticks / possible) * 100 : 0, tracked: true, habits: names.length };
      }),
    [data, year],
  );

  const byDate = useMemo(() => {
    const out = new Map<string, DayCell>();
    for (let month = 1; month <= 12; month++) {
      const tasks = data[yearMonthKey(year, month)] ?? {};
      const names = Object.keys(tasks);
      const total = daysInMonth(year, month);
      for (let day = 1; day <= total; day++) {
        const key = dateKey(year, month, day);
        if (names.length === 0) {
          out.set(key, { date: key, pct: null, done: 0, total: 0 });
          continue;
        }
        const done = names.filter((n) => tasks[n]?.[String(day)] === true).length;
        out.set(key, { date: key, pct: (done / names.length) * 100, done, total: names.length });
      }
    }
    return out;
  }, [data, year]);

  return { monthTasks: data, monthly, byDate, loading };
}

export function taskBreakdown(monthTasks: MonthTasks, year: number, month: number) {
  const total = daysInMonth(year, month);
  return Object.keys(monthTasks)
    .map((name) => {
      const days = monthTasks[name] ?? {};
      let done = 0;
      for (let d = 1; d <= total; d++) if (days[String(d)] === true) done += 1;
      return { name, done, total, pct: total ? (done / total) * 100 : 0 };
    })
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
}
