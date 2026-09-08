import { useCallback, useMemo } from 'react';
import { get, remove as dbRemove, set } from 'firebase/database';
import { pathRef, sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { daysInMonth, yearMonthKey } from '../lib/dates';
import type { MonthTasks, Task } from '../lib/types';

function normalize(raw: unknown): MonthTasks {
  return (raw as MonthTasks) ?? {};
}

export function useTasks(uid: string, year: number, month: number) {
  const key = yearMonthKey(year, month);
  const path = uid ? sectionPath(uid, year, 'tasks', key) : null;
  const { data, loading } = useDbValue<MonthTasks>(path, normalize);

  const tasks = useMemo<Task[]>(
    () => Object.keys(data).map((name) => ({ name, days: data[name] ?? {} })),
    [data],
  );

  const taskPath = useCallback(
    (name: string, ...rest: string[]) => sectionPath(uid, year, 'tasks', key, name, ...rest),
    [uid, year, key],
  );

  const addTask = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!uid || !clean) return { ok: false as const, reason: 'empty' };
      if (Object.hasOwn(data, clean)) return { ok: false as const, reason: 'duplicate' };
      // RTDB rejects these in keys; without the guard the write throws.
      if (/[.#$/[\]]/.test(clean)) return { ok: false as const, reason: 'invalid' };
      void set(pathRef(taskPath(clean)), { _exists: false });
      return { ok: true as const, reason: '' };
    },
    [uid, data, taskPath],
  );

  const renameTask = useCallback(
    async (oldName: string, nextName: string) => {
      const clean = nextName.trim();
      if (!uid || clean === oldName) return { ok: true as const, reason: '' };
      if (!clean) return { ok: false as const, reason: 'empty' };
      if (Object.hasOwn(data, clean)) return { ok: false as const, reason: 'duplicate' };
      if (/[.#$/[\]]/.test(clean)) return { ok: false as const, reason: 'invalid' };
      const days = data[oldName] ?? {};
      await set(pathRef(taskPath(clean)), Object.keys(days).length ? days : { _exists: false });
      await dbRemove(pathRef(taskPath(oldName)));
      return { ok: true as const, reason: '' };
    },
    [uid, data, taskPath],
  );

  const deleteTask = useCallback(
    (name: string) => {
      if (!uid) return Promise.resolve();
      return dbRemove(pathRef(taskPath(name)));
    },
    [uid, taskPath],
  );

  const toggleDay = useCallback(
    (name: string, day: number) => {
      if (!uid) return Promise.resolve();
      const done = data[name]?.[String(day)] === true;
      return done
        ? dbRemove(pathRef(taskPath(name, String(day))))
        : set(pathRef(taskPath(name, String(day))), true);
    },
    [uid, data, taskPath],
  );

  const copyFromPreviousMonth = useCallback(async () => {
    if (!uid) return 0;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const snap = await get(pathRef(sectionPath(uid, prevYear, 'tasks', yearMonthKey(prevYear, prevMonth))));
    const prev = (snap.val() ?? {}) as MonthTasks;
    const names = Object.keys(prev);
    if (names.length === 0) return 0;

    // Merge rather than replace, so a half-filled month isn't wiped.
    const merged: MonthTasks = { ...data };
    let added = 0;
    names.forEach((name) => {
      if (!Object.hasOwn(merged, name)) {
        merged[name] = { _exists: false };
        added += 1;
      }
    });
    if (added > 0) await set(pathRef(sectionPath(uid, year, 'tasks', key)), merged);
    return added;
  }, [uid, year, month, key, data]);

  const stats = useMemo(() => {
    const total = daysInMonth(year, month);
    const perTask = tasks.map((t) => {
      const done = Object.keys(t.days).filter((d) => t.days[d] === true).length;
      return { name: t.name, done, total, pct: total ? (done / total) * 100 : 0 };
    });
    return { perTask, daysInMonth: total };
  }, [tasks, year, month]);

  return { tasks, loading, addTask, renameTask, deleteTask, toggleDay, copyFromPreviousMonth, stats };
}

/** Fraction of tasks ticked on one day, 0–100. */
export function dayCompletion(tasks: Task[], day: number): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.days[String(day)] === true).length;
  return (done / tasks.length) * 100;
}
