import { useCallback, useMemo } from 'react';
import { remove as dbRemove, set } from 'firebase/database';
import { pathRef, sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { round1 } from '../lib/format';
import type { WeightLog, WeightTargets } from '../lib/types';

const normalizeLog = (raw: unknown): WeightLog => (raw as WeightLog) ?? {};
const normalizeTargets = (raw: unknown): WeightTargets => (raw as WeightTargets) ?? {};

export function useWeight(uid: string, year: number) {
  const logPath = uid ? sectionPath(uid, year, 'weight') : null;
  const targetsPath = uid ? sectionPath(uid, year, 'weightTargets') : null;

  const { data: entries, loading: loadingLog } = useDbValue<WeightLog>(logPath, normalizeLog);
  const { data: targets, loading: loadingTargets } = useDbValue<WeightTargets>(targetsPath, normalizeTargets);

  const sortedDates = useMemo(() => Object.keys(entries).sort(), [entries]);

  const latest = useMemo(() => {
    if (sortedDates.length === 0) return null;
    const date = sortedDates[sortedDates.length - 1];
    return { date, value: entries[date] };
  }, [sortedDates, entries]);

  const change = useMemo(() => {
    if (sortedDates.length < 2) return null;
    const first = entries[sortedDates[0]];
    const last = entries[sortedDates[sortedDates.length - 1]];
    return round1(last - first);
  }, [sortedDates, entries]);

  const saveEntry = useCallback(
    (date: string, value: number) => {
      if (!uid) return Promise.resolve();
      return set(pathRef(sectionPath(uid, year, 'weight', date)), round1(value));
    },
    [uid, year],
  );

  const deleteEntry = useCallback(
    (date: string) => {
      if (!uid) return Promise.resolve();
      return dbRemove(pathRef(sectionPath(uid, year, 'weight', date)));
    },
    [uid, year],
  );

  const saveTargets = useCallback(
    (next: WeightTargets) => {
      if (!uid) return Promise.resolve();
      return set(pathRef(sectionPath(uid, year, 'weightTargets')), next);
    },
    [uid, year],
  );

  return {
    entries,
    targets,
    sortedDates,
    latest,
    change,
    loading: loadingLog || loadingTargets,
    saveEntry,
    deleteEntry,
    saveTargets,
  };
}
