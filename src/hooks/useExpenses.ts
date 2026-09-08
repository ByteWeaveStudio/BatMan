import { useCallback, useMemo } from 'react';
import { remove as dbRemove, set } from 'firebase/database';
import { pathRef, sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { nextCategoryColor } from '../lib/color';
import type { Expense, ExpenseCategory, ExpenseDraft } from '../lib/types';

type RawMap = Record<string, Record<string, unknown>>;
const normalizeMap = (raw: unknown): RawMap => (raw as RawMap) ?? {};

export const MAX_CATEGORIES = 10;

export function useExpenses(uid: string, year: number) {
  const expensesPath = uid ? sectionPath(uid, year, 'expenses') : null;
  const categoriesPath = uid ? sectionPath(uid, year, 'expenseCategories') : null;

  const { data: rawExpenses, loading: loadingExpenses } = useDbValue<RawMap>(expensesPath, normalizeMap);
  const { data: rawCategories, loading: loadingCategories } = useDbValue<RawMap>(categoriesPath, normalizeMap);

  const expenses = useMemo<Expense[]>(
    () =>
      Object.keys(rawExpenses)
        .map((id) => ({ id, ...(rawExpenses[id] as unknown as Omit<Expense, 'id'>) }))
        .filter((e) => typeof e.amount === 'number' && typeof e.date === 'string')
        .sort((a, b) => (a.date === b.date ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : b.date.localeCompare(a.date))),
    [rawExpenses],
  );

  const categories = useMemo<ExpenseCategory[]>(
    () =>
      Object.keys(rawCategories)
        .map((id) => ({ id, ...(rawCategories[id] as unknown as Omit<ExpenseCategory, 'id'>) }))
        .filter((c) => typeof c.name === 'string')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rawCategories],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const saveExpense = useCallback(
    (id: string | null, draft: ExpenseDraft) => {
      if (!uid) return Promise.resolve();
      const key = id ?? String(Date.now());
      const payload: ExpenseDraft = { ...draft };
      if (id) payload.updatedAt = Date.now();
      return set(pathRef(sectionPath(uid, year, 'expenses', key)), payload);
    },
    [uid, year],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      if (!uid) return Promise.resolve();
      return dbRemove(pathRef(sectionPath(uid, year, 'expenses', id)));
    },
    [uid, year],
  );

  const addCategory = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!uid || !clean) return { ok: false as const, reason: 'empty' };
      if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
        return { ok: false as const, reason: 'duplicate' };
      }
      if (categories.length >= MAX_CATEGORIES) return { ok: false as const, reason: 'limit' };
      const id = String(Date.now());
      void set(pathRef(sectionPath(uid, year, 'expenseCategories', id)), {
        name: clean,
        color: nextCategoryColor(categories.map((c) => c.color)),
        createdAt: Date.now(),
      });
      return { ok: true as const, reason: '' };
    },
    [uid, year, categories],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      if (!uid) return Promise.resolve();
      return dbRemove(pathRef(sectionPath(uid, year, 'expenseCategories', id)));
    },
    [uid, year],
  );

  const categoryInUse = useCallback((id: string) => expenses.some((e) => e.categoryId === id), [expenses]);

  return {
    expenses,
    categories,
    categoryById,
    loading: loadingExpenses || loadingCategories,
    saveExpense,
    deleteExpense,
    addCategory,
    deleteCategory,
    categoryInUse,
  };
}
