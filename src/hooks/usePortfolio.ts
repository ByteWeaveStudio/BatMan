import { useCallback, useMemo } from 'react';
import { set } from 'firebase/database';
import { pathRef, sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { sanitizeAmount } from '../lib/format';
import {
  PORTFOLIO_MONTHS,
  type LineItem,
  type Portfolio,
  type PortfolioCell,
  type PortfolioFieldKey,
  type PortfolioMonth,
  type PortfolioMonthKey,
} from '../lib/types';

export const EXPENSE_FIELDS: { key: PortfolioFieldKey; label: string; short: string }[] = [
  { key: 'personal', label: 'Personal expense', short: 'Personal' },
  { key: 'family', label: 'Family expense', short: 'Family' },
  { key: 'rent', label: 'Rent', short: 'Rent' },
  { key: 'loan', label: 'Loan', short: 'Loan' },
  { key: 'misc', label: 'Misc', short: 'Misc' },
];

export const INCOME_FIELDS: { key: PortfolioFieldKey; label: string; short: string }[] = [
  { key: 'mainIncome', label: 'Main income', short: 'Main' },
  { key: 'sideIncome', label: 'Side income', short: 'Side' },
];

export const ALL_FIELDS = [...EXPENSE_FIELDS, ...INCOME_FIELDS];

function emptyCell(): PortfolioCell {
  return { lineItems: [] };
}

function emptyMonth(): PortfolioMonth {
  return ALL_FIELDS.reduce((acc, f) => {
    acc[f.key] = emptyCell();
    return acc;
  }, {} as PortfolioMonth);
}

function normalizeCell(raw: unknown): PortfolioCell {
  // v1 stored a bare number before line items existed.
  if (typeof raw === 'number') {
    return raw > 0 ? { lineItems: [{ date: '', description: 'Imported entry', amount: raw }] } : emptyCell();
  }
  if (!raw || typeof raw !== 'object') return emptyCell();
  const list = (raw as { lineItems?: unknown }).lineItems;
  const items = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.values(list) : [];
  return {
    lineItems: (items as Record<string, unknown>[])
      .filter(Boolean)
      .map((item) => ({
        date: typeof item.date === 'string' ? item.date : '',
        description: typeof item.description === 'string' ? item.description : '',
        amount: sanitizeAmount(item.amount),
      }))
      .filter((item) => item.amount > 0 || item.date || item.description),
  };
}

function normalize(raw: unknown): Portfolio {
  const source = (raw ?? {}) as { openingBalance?: number; months?: Record<string, unknown> };
  const months = {} as Record<PortfolioMonthKey, PortfolioMonth>;
  PORTFOLIO_MONTHS.forEach((key) => {
    const rawMonth = (source.months?.[key] ?? null) as Record<string, unknown> | null;
    const month = emptyMonth();
    ALL_FIELDS.forEach((f) => {
      month[f.key] = normalizeCell(rawMonth?.[f.key]);
    });
    months[key] = month;
  });
  return { openingBalance: sanitizeAmount(source.openingBalance), months };
}

export function cellTotal(cell: PortfolioCell | undefined): number {
  if (!cell?.lineItems) return 0;
  return cell.lineItems.reduce((sum, item) => sum + sanitizeAmount(item.amount), 0);
}

export function monthTotals(month: PortfolioMonth) {
  const expense = EXPENSE_FIELDS.reduce((sum, f) => sum + cellTotal(month[f.key]), 0);
  const income = INCOME_FIELDS.reduce((sum, f) => sum + cellTotal(month[f.key]), 0);
  return { expense, income, savings: income - expense };
}

export function usePortfolio(uid: string, year: number) {
  const path = uid ? sectionPath(uid, year, 'portfolio') : null;
  const { data, loading } = useDbValue<Portfolio>(path, normalize);

  const totals = useMemo(() => {
    const perField = ALL_FIELDS.reduce((acc, f) => {
      acc[f.key] = PORTFOLIO_MONTHS.reduce((sum, m) => sum + cellTotal(data.months[m][f.key]), 0);
      return acc;
    }, {} as Record<PortfolioFieldKey, number>);
    const expense = EXPENSE_FIELDS.reduce((sum, f) => sum + perField[f.key], 0);
    const income = INCOME_FIELDS.reduce((sum, f) => sum + perField[f.key], 0);
    const savings = income - expense;
    return { perField, expense, income, savings, closing: data.openingBalance + savings };
  }, [data]);

  const saveOpeningBalance = useCallback(
    (value: number) => {
      if (!uid) return Promise.resolve();
      return set(pathRef(sectionPath(uid, year, 'portfolio', 'openingBalance')), sanitizeAmount(value));
    },
    [uid, year],
  );

  const saveCell = useCallback(
    (month: PortfolioMonthKey, field: PortfolioFieldKey, items: LineItem[]) => {
      if (!uid) return Promise.resolve();
      const clean = items
        .map((item) => ({
          date: (item.date || '').trim(),
          description: (item.description || '').trim(),
          amount: sanitizeAmount(item.amount),
        }))
        .filter((item) => item.date || item.description || item.amount > 0);
      return set(pathRef(sectionPath(uid, year, 'portfolio', 'months', month, field)), { lineItems: clean });
    },
    [uid, year],
  );

  return { portfolio: data, totals, loading, saveOpeningBalance, saveCell };
}
