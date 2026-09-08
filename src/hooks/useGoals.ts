import { useCallback, useEffect, useMemo, useRef } from 'react';
import { get, set } from 'firebase/database';
import { pathRef, sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { currentMonth, currentQuarter } from '../lib/dates';
import type { ArchivedGoal, Goal, GoalType, GoalsNode } from '../lib/types';

const EMPTY: GoalsNode = {};

function normalize(raw: unknown): GoalsNode {
  return (raw as GoalsNode) ?? EMPTY;
}

function listOf(node: GoalsNode, type: GoalType): Goal[] {
  const value = node[type];
  if (Array.isArray(value)) return value.filter(Boolean);
  // RTDB hands sparse arrays back as objects.
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (value as unknown as Record<string, Goal>)[k])
      .filter(Boolean);
  }
  return [];
}

export function useGoals(uid: string, year: number) {
  const path = uid ? sectionPath(uid, year, 'goals') : null;
  const { data, loading } = useDbValue<GoalsNode>(path, normalize);

  const goals = useMemo(
    () => ({
      yearly: listOf(data, 'yearly'),
      quarterly: listOf(data, 'quarterly'),
      monthly: listOf(data, 'monthly'),
    }),
    [data],
  );

  const write = useCallback(
    (type: GoalType, next: Goal[]) => {
      if (!uid) return Promise.resolve();
      return set(pathRef(sectionPath(uid, year, 'goals', type)), next);
    },
    [uid, year],
  );

  const add = useCallback(
    (type: GoalType, text: string) => {
      const clean = text.trim();
      if (!clean) return Promise.resolve();
      return write(type, [...goals[type], { text: clean, completed: false, createdAt: Date.now() }]);
    },
    [goals, write],
  );

  const update = useCallback(
    (type: GoalType, index: number, text: string) => {
      const clean = text.trim();
      const next = [...goals[type]];
      if (!next[index]) return Promise.resolve();
      if (!clean) next.splice(index, 1);
      else next[index] = { ...next[index], text: clean };
      return write(type, next);
    },
    [goals, write],
  );

  const toggle = useCallback(
    (type: GoalType, index: number) => {
      const next = [...goals[type]];
      if (!next[index]) return Promise.resolve();
      next[index] = { ...next[index], completed: !next[index].completed };
      return write(type, next);
    },
    [goals, write],
  );

  const remove = useCallback(
    (type: GoalType, index: number) => {
      const next = [...goals[type]];
      if (!next[index]) return Promise.resolve();
      next.splice(index, 1);
      return write(type, next);
    },
    [goals, write],
  );

  const loadHistory = useCallback(
    async (type: GoalType): Promise<ArchivedGoal[]> => {
      if (!uid) return [];
      const snap = await get(pathRef(sectionPath(uid, year, 'goals', 'history', type)));
      const value = snap.val();
      if (Array.isArray(value)) return value.filter(Boolean);
      if (value && typeof value === 'object') return Object.values(value as Record<string, ArchivedGoal>).filter(Boolean);
      return [];
    },
    [uid, year],
  );

  useRollover(uid, year, data, loading);

  return { goals, loading, add, update, toggle, remove, loadHistory };
}

/**
 * Monthly and quarterly goals archive themselves when the period rolls over.
 * Guarded per uid+year so React's double-invoked effects can't archive twice.
 */
function useRollover(uid: string, year: number, node: GoalsNode, loading: boolean) {
  const done = useRef<string>('');

  const run = useCallback(async () => {
    const month = currentMonth();
    const quarter = currentQuarter();
    const meta = node._metadata ?? {};

    const jobs: { type: GoalType; last: number | undefined; now: number; period: string }[] = [
      { type: 'monthly', last: meta.lastMonth, now: month, period: `Month ${meta.lastMonth}/${year}` },
      { type: 'quarterly', last: meta.lastQuarter, now: quarter, period: `Q${meta.lastQuarter} ${year}` },
    ];

    for (const job of jobs) {
      const metaKey = job.type === 'monthly' ? 'lastMonth' : 'lastQuarter';
      const metaPath = sectionPath(uid, year, 'goals', '_metadata', metaKey);

      if (job.last === undefined || job.last === null) {
        await set(pathRef(metaPath), job.now);
        continue;
      }
      if (job.last === job.now) continue;

      const current = listOf(node, job.type);
      if (current.length > 0) {
        const historyPath = sectionPath(uid, year, 'goals', 'history', job.type);
        const snap = await get(pathRef(historyPath));
        const existing: ArchivedGoal[] = Array.isArray(snap.val()) ? snap.val().filter(Boolean) : [];
        const archived = current.map((g) => ({ ...g, period: job.period, archivedAt: Date.now() }));
        await set(pathRef(historyPath), [...existing, ...archived]);
        await set(pathRef(sectionPath(uid, year, 'goals', job.type)), []);
      }
      await set(pathRef(metaPath), job.now);
    }
  }, [uid, year, node]);

  useEffect(() => {
    // Only the live year rolls over; browsing an old year must not mutate it.
    if (!uid || loading || year !== new Date().getFullYear()) return;
    const key = `${uid}:${year}`;
    if (done.current === key) return;
    done.current = key;
    void run();
  }, [uid, year, loading, run]);
}
