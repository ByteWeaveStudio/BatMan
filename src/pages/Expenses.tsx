import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { useUid } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/Confirm';
import { MAX_CATEGORIES, useExpenses } from '../hooks/useExpenses';
import {
  MONTH_NAMES,
  MONTH_SHORT,
  currentMonth,
  daysElapsedInMonth,
  daysElapsedInYear,
  daysInMonth,
  formatDateLabel,
  formatDateShort,
  monthsElapsedInYear,
  toDateInput,
  yearMonthKey,
  yearMonthOf,
} from '../lib/dates';
import { currency, currencyCompact } from '../lib/format';
import { readableColor } from '../lib/color';
import { chartTheme } from '../lib/chartTheme';
import { BAR_SIZING, baseOptions, categoryScale, valueScale } from '../lib/chartOptions';
import { Card, EmptyState, Field, PageHeader, Segmented, Spinner, Stat } from '../components/primitives';
import { BarList } from '../components/BarList';
import { ChartCanvas } from '../components/ChartCanvas';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import type { Expense, ExpenseCategory, ExpenseDraft } from '../lib/types';

type Scope = 'month' | 'year';

const EMPTY_DRAFT = (): ExpenseDraft => ({
  name: '',
  amount: 0,
  date: toDateInput(new Date()),
  categoryId: '',
  place: '',
  description: '',
  createdAt: Date.now(),
});

export function Expenses() {
  const uid = useUid();
  const { year, isCurrentYear } = useYear();
  const toast = useToast();
  const confirm = useConfirm();
  const { theme } = useTheme();
  const t = chartTheme(theme);
  const api = useExpenses(uid, year);

  const [scope, setScope] = useState<Scope>('month');
  const [month, setMonth] = useState(() => (isCurrentYear ? currentMonth() : 12));
  const [editing, setEditing] = useState<{ id: string | null; draft: ExpenseDraft } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [listCategory, setListCategory] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setMonth(isCurrentYear ? currentMonth() : 12);
  }, [year, isCurrentYear]);

  const monthKey = yearMonthKey(year, month);

  /** Everything on the page reads this one slice. */
  const scoped = useMemo(
    () =>
      scope === 'month'
        ? api.expenses.filter((e) => yearMonthOf(e.date) === monthKey)
        : api.expenses.filter((e) => e.date.startsWith(`${year}-`)),
    [api.expenses, scope, monthKey, year],
  );

  const total = useMemo(() => scoped.reduce((s, e) => s + e.amount, 0), [scoped]);

  const summary = useMemo(() => {
    if (scope === 'month') {
      const days = Math.max(1, daysElapsedInMonth(year, month));
      return { perDay: total / days, perMonth: total, daysLabel: `over ${days} day${days === 1 ? '' : 's'}` };
    }
    const days = Math.max(1, daysElapsedInYear(year));
    const months = Math.max(1, monthsElapsedInYear(year));
    return { perDay: total / days, perMonth: total / months, daysLabel: `over ${months} month${months === 1 ? '' : 's'}` };
  }, [scope, total, year, month]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    scoped.forEach((e) => {
      const key = e.categoryId || 'uncategorized';
      map.set(key, (map.get(key) ?? 0) + e.amount);
    });
    return [...map.entries()]
      .map(([id, amount]) => {
        const category = api.categoryById.get(id);
        return {
          id,
          name: category?.name ?? 'Uncategorised',
          color: readableColor(category?.color ?? '#94a3b8', theme),
          amount,
          share: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [scoped, api.categoryById, total, theme]);

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((e) => {
      if (listCategory !== 'all' && (e.categoryId || 'uncategorized') !== listCategory) return false;
      if (!q) return true;
      const haystack = [
        e.name,
        e.place ?? '',
        e.description ?? '',
        api.categoryById.get(e.categoryId)?.name ?? '',
        String(e.amount),
        e.date,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [scoped, listCategory, query, api.categoryById]);

  const listedTotal = useMemo(() => listed.reduce((s, e) => s + e.amount, 0), [listed]);

  const chartConfig = useMemo<ChartConfiguration>(() => {
    const base = baseOptions(t);
    if (scope === 'month') {
      const days = daysInMonth(year, month);
      const data = new Array(days).fill(0) as number[];
      scoped.forEach((e) => {
        const day = Number.parseInt(e.date.slice(8, 10), 10);
        if (day >= 1 && day <= days) data[day - 1] += e.amount;
      });
      return {
        type: 'line',
        data: {
          labels: Array.from({ length: days }, (_, i) => String(i + 1)),
          datasets: [
            {
              label: 'Spend',
              data,
              borderColor: t.series[0],
              backgroundColor: t.seriesWash,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointBackgroundColor: t.series[0],
              pointBorderColor: t.surface,
              pointBorderWidth: 2,
              fill: true,
              tension: 0.28,
            },
          ],
        },
        options: {
          ...base,
          scales: {
            x: categoryScale(t, { ticks: { color: t.subtle, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 14 } }),
            y: valueScale(t, {
              ticks: { color: t.subtle, font: { size: 11 }, padding: 8, maxTicksLimit: 5, callback: (v: unknown) => currencyCompact(Number(v)) },
            }),
          },
          plugins: {
            ...base.plugins,
            tooltip: {
              ...base.plugins?.tooltip,
              callbacks: {
                title: (items: { label: string }[]) => `${MONTH_NAMES[month - 1]} ${items[0]?.label ?? ''}`,
                label: (item: { parsed: { y: number } }) => currency(item.parsed.y),
              },
            },
          },
        },
      } as ChartConfiguration;
    }

    const data = new Array(12).fill(0) as number[];
    scoped.forEach((e) => {
      const m = Number.parseInt(e.date.slice(5, 7), 10);
      if (m >= 1 && m <= 12) data[m - 1] += e.amount;
    });
    return {
      type: 'bar',
      data: {
        labels: MONTH_SHORT,
        datasets: [{ label: 'Spend', data, backgroundColor: t.series[0], hoverBackgroundColor: t.series[0], ...BAR_SIZING }],
      },
      options: {
        ...base,
        scales: {
          x: categoryScale(t),
          y: valueScale(t, {
            ticks: { color: t.subtle, font: { size: 11 }, padding: 8, maxTicksLimit: 5, callback: (v: unknown) => currencyCompact(Number(v)) },
          }),
        },
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: { label: (item: { parsed: { y: number } }) => currency(item.parsed.y) },
          },
        },
      },
    } as ChartConfiguration;
  }, [scope, scoped, t, year, month]);

  async function removeExpense(expense: Expense) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: `${expense.name} — ${currency(expense.amount)} on ${formatDateLabel(expense.date)}.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await api.deleteExpense(expense.id);
    toast.success('Expense deleted.');
  }

  const scopeLabel = scope === 'month' ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`;

  return (
    <>
      <PageHeader
        title="Expenses"
        sub={scopeLabel}
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setEditing({ id: null, draft: { ...EMPTY_DRAFT(), date: defaultDateFor(year, month) } })}
          >
            <Icon name="plus" />
            Add expense
          </button>
        }
      />

      <div className="filter-bar">
        <Segmented
          value={scope}
          onChange={setScope}
          ariaLabel="Time scope"
          options={[
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
        <select
          className="select select--sm select--auto"
          value={month}
          onChange={(e) => setMonth(Number.parseInt(e.target.value, 10))}
          disabled={scope === 'year'}
          aria-label="Select month"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setCategoriesOpen(true)}>
          <Icon name="filter" />
          Categories
        </button>
      </div>

      <div className="stat-row">
        <Stat label="Total spend" value={currency(total)} meta={`${scoped.length} entr${scoped.length === 1 ? 'y' : 'ies'}`} />
        <Stat label="Average per day" value={currency(summary.perDay)} meta={summary.daysLabel} />
        <Stat label="Average per month" value={currency(summary.perMonth)} meta={scope === 'month' ? 'This month' : 'Year to date'} />
      </div>

      {api.loading ? (
        <Spinner large label="Loading expenses" />
      ) : (
        <>
          <Card
            title={scope === 'month' ? 'Daily spend' : 'Monthly spend'}
            subtitle={scopeLabel}
            className="expense-chart-card"
          >
            {scoped.length === 0 ? (
              <EmptyState icon="expenses" title="Nothing logged yet" sub={`No expenses recorded for ${scopeLabel}.`} />
            ) : (
              <ChartCanvas
                config={chartConfig}
                height={240}
                ariaLabel={scope === 'month' ? 'Line chart of daily spend for the selected month' : 'Column chart of spend per month'}
              />
            )}
          </Card>

          <div className="expense-grid">
            <Card title="Where it went" subtitle={scopeLabel} className="split-card">
              {byCategory.length === 0 ? (
                <EmptyState icon="filter" title="No spend to split" inline />
              ) : (
                <BarList
                  items={byCategory.map((c) => ({
                    key: c.id,
                    label: c.name,
                    labelText: c.name,
                    value: c.amount,
                    display: currency(c.amount),
                    meta: `${c.share.toFixed(1)}% of ${scope === 'month' ? 'the month' : 'the year'}`,
                    color: c.color,
                  }))}
                />
              )}
            </Card>

            <Card
              title="Entries"
              subtitle={`${listed.length} shown · ${currency(listedTotal)}`}
              flush
              className="expense-list-card"
            >
              <div className="expense-filters">
                <label className="search">
                  <Icon name="search" />
                  <input
                    className="search__input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, place, note…"
                    aria-label="Search expenses"
                    type="search"
                  />
                </label>
                <select
                  className="select select--sm"
                  value={listCategory}
                  onChange={(e) => setListCategory(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {api.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="uncategorized">Uncategorised</option>
                </select>
              </div>

              {listed.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="No matching expenses"
                  sub={query ? 'Try a different search term.' : `Nothing recorded for ${scopeLabel}.`}
                />
              ) : (
                <ul className="expense-list">
                  {listed.map((expense) => {
                    const category = api.categoryById.get(expense.categoryId);
                    return (
                      <li key={expense.id} className="expense-item">
                        <span
                          className="expense-item__dot"
                          style={{ background: readableColor(category?.color ?? '#94a3b8', theme) }}
                          aria-hidden="true"
                        />
                        <div className="expense-item__main">
                          <div className="expense-item__top">
                            <span className="expense-item__name truncate">{expense.name}</span>
                            <span className="expense-item__amount">{currency(expense.amount)}</span>
                          </div>
                          <div className="expense-item__meta">
                            <span>{formatDateShort(expense.date)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{category?.name ?? 'Uncategorised'}</span>
                            {expense.place ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{expense.place}</span>
                              </>
                            ) : null}
                          </div>
                          {expense.description ? <p className="expense-item__note">{expense.description}</p> : null}
                        </div>
                        <div className="expense-item__actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn--sm"
                            aria-label={`Edit ${expense.name}`}
                            onClick={() => setEditing({ id: expense.id, draft: toDraft(expense) })}
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--sm icon-btn--danger"
                            aria-label={`Delete ${expense.name}`}
                            onClick={() => void removeExpense(expense)}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <ExpenseModal
        state={editing}
        categories={api.categories}
        onClose={() => setEditing(null)}
        onSave={api.saveExpense}
        onManageCategories={() => {
          setEditing(null);
          setCategoriesOpen(true);
        }}
      />

      <CategoriesModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={api.categories}
        onAdd={api.addCategory}
        onDelete={api.deleteCategory}
        inUse={api.categoryInUse}
      />
    </>
  );
}

function toDraft(expense: Expense): ExpenseDraft {
  const { id: _id, ...draft } = expense;
  return draft;
}

function defaultDateFor(year: number, month: number): string {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) return toDateInput(now);
  return `${yearMonthKey(year, month)}-01`;
}

/* ---------------- Add / edit ---------------- */

function ExpenseModal({
  state,
  categories,
  onClose,
  onSave,
  onManageCategories,
}: {
  state: { id: string | null; draft: ExpenseDraft } | null;
  categories: ExpenseCategory[];
  onClose: () => void;
  onSave: (id: string | null, draft: ExpenseDraft) => Promise<void>;
  onManageCategories: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_DRAFT);
  const [amountText, setAmountText] = useState('');
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    if (!state) return;
    setDraft(state.draft);
    setAmountText(state.draft.amount ? String(state.draft.amount) : '');
    setKeepOpen(false);
  }, [state]);

  const isEdit = !!state?.id;

  async function submit() {
    const amount = Number.parseFloat(amountText);
    if (!draft.name.trim()) return toast.error('Give the expense a name.');
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter an amount above zero.');
    if (!draft.date) return toast.error('Pick a date.');
    if (!draft.categoryId) return toast.error('Choose a category.');

    await onSave(state?.id ?? null, {
      ...draft,
      name: draft.name.trim(),
      amount,
      place: (draft.place ?? '').trim(),
      description: (draft.description ?? '').trim(),
    });
    toast.success(isEdit ? 'Expense updated.' : 'Expense added.');

    if (!isEdit && keepOpen) {
      setDraft((prev) => ({ ...EMPTY_DRAFT(), date: prev.date, categoryId: prev.categoryId }));
      setAmountText('');
      return;
    }
    onClose();
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={isEdit ? 'Edit expense' : 'Add expense'}
      formId="expense-form"
      onSubmit={submit}
      footer={
        <>
          {!isEdit ? (
            <label className="keep-open">
              <input type="checkbox" className="check" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} />
              Add another
            </label>
          ) : null}
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="expense-form" className="btn btn--primary">
            {isEdit ? 'Save changes' : 'Add expense'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" htmlFor="exp-name" required>
          <input
            id="exp-name"
            className="input"
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            autoComplete="off"
            required
          />
        </Field>

        <div className="form-row">
          <Field label="Amount" htmlFor="exp-amount" required>
            <div className="input-group">
              <span className="addon addon--lead">₹</span>
              <input
                id="exp-amount"
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                required
              />
            </div>
          </Field>
          <Field label="Date" htmlFor="exp-date" required>
            <input
              id="exp-date"
              className="input"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              required
            />
          </Field>
        </div>

        <Field label="Category" htmlFor="exp-category" required>
          {categories.length === 0 ? (
            <button type="button" className="btn btn--secondary" onClick={onManageCategories}>
              <Icon name="plus" />
              Create your first category
            </button>
          ) : (
            <select
              id="exp-category"
              className="select"
              value={draft.categoryId}
              onChange={(e) => setDraft((p) => ({ ...p, categoryId: e.target.value }))}
              required
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Place" htmlFor="exp-place">
          <input
            id="exp-place"
            className="input"
            value={draft.place ?? ''}
            onChange={(e) => setDraft((p) => ({ ...p, place: e.target.value }))}
            autoComplete="off"
          />
        </Field>

        <Field label="Note" htmlFor="exp-note">
          <textarea
            id="exp-note"
            className="textarea"
            rows={2}
            value={draft.description ?? ''}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- Categories ---------------- */

function CategoriesModal({
  open,
  onClose,
  categories,
  onAdd,
  onDelete,
  inUse,
}: {
  open: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  onAdd: (name: string) => { ok: boolean; reason: string };
  onDelete: (id: string) => Promise<void>;
  inUse: (id: string) => boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { theme } = useTheme();
  const [name, setName] = useState('');

  function add(e: FormEvent) {
    e.preventDefault();
    const res = onAdd(name);
    if (!res.ok) {
      if (res.reason === 'duplicate') toast.error('That category already exists.');
      if (res.reason === 'limit') toast.error(`You can have up to ${MAX_CATEGORIES} categories.`);
      return;
    }
    setName('');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Categories"
      subtitle={`${categories.length} of ${MAX_CATEGORIES} used · a category in use can’t be deleted`}
      footer={
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <form className="row" onSubmit={add} style={{ marginBottom: 'var(--s-4)' }}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          maxLength={30}
          aria-label="New category name"
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim() || categories.length >= MAX_CATEGORIES}>
          Add
        </button>
      </form>

      {categories.length === 0 ? (
        <EmptyState icon="filter" title="No categories yet" sub="Every expense belongs to a category — add a few to get started." inline />
      ) : (
        <ul className="category-list">
          {categories.map((c) => {
            const used = inUse(c.id);
            return (
              <li key={c.id} className="category-row">
                <span className="chip" style={{ ['--chip' as string]: readableColor(c.color, theme) }}>
                  <span className="chip__dot" />
                  <span className="chip__name">{c.name}</span>
                </span>
                <div className="spacer" />
                {used ? (
                  <span className="text-xs text-subtle">In use</span>
                ) : (
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm icon-btn--danger"
                    aria-label={`Delete category ${c.name}`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete “${c.name}”?`,
                        message: 'No expenses use this category, so nothing else changes.',
                        confirmLabel: 'Delete',
                        destructive: true,
                      });
                      if (ok) void onDelete(c.id);
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
