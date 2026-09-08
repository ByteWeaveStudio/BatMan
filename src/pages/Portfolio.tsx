import { useEffect, useMemo, useState } from 'react';
import { useUid } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { useToast } from '../context/ToastContext';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { ALL_FIELDS, EXPENSE_FIELDS, INCOME_FIELDS, cellTotal, monthTotals, usePortfolio } from '../hooks/usePortfolio';
import { MONTH_NAMES, MONTH_SHORT, currentMonth, formatDateShort, toDateInput } from '../lib/dates';
import { currency, sanitizeAmount } from '../lib/format';
import { Card, EmptyState, Field, PageHeader, Spinner, Stat } from '../components/primitives';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { PORTFOLIO_MONTHS, type LineItem, type PortfolioFieldKey, type PortfolioMonthKey } from '../lib/types';

interface CellTarget {
  month: PortfolioMonthKey;
  monthIndex: number;
  year: number;
  field: PortfolioFieldKey;
  items: LineItem[];
}

export function Portfolio() {
  const uid = useUid();
  const { year } = useYear();
  const isDesktop = useIsDesktop();
  const api = usePortfolio(uid, year);
  const [target, setTarget] = useState<CellTarget | null>(null);

  function openCell(month: PortfolioMonthKey, monthIndex: number, field: PortfolioFieldKey) {
    setTarget({ month, monthIndex, year, field, items: api.portfolio.months[month][field].lineItems.map((i) => ({ ...i })) });
  }

  return (
    <>
      <PageHeader title="Portfolio" sub={`Money in and out across ${year}`} />

      <div className="stat-row">
        <OpeningBalance value={api.portfolio.openingBalance} onSave={api.saveOpeningBalance} />
        <Stat
          label="Total savings"
          value={currency(api.totals.savings)}
          tone={api.totals.savings < 0 ? 'neg' : api.totals.savings > 0 ? 'pos' : undefined}
          meta={`${currency(api.totals.income)} in · ${currency(api.totals.expense)} out`}
        />
        <Stat
          label="Closing balance"
          value={currency(api.totals.closing)}
          tone={api.totals.closing < 0 ? 'neg' : undefined}
          meta="Opening balance plus savings"
        />
      </div>

      {api.loading ? (
        <Spinner large label="Loading portfolio" />
      ) : isDesktop ? (
        <PortfolioTable api={api} onOpen={openCell} />
      ) : (
        <PortfolioCards api={api} onOpen={openCell} />
      )}

      <LineItemsModal
        target={target}
        onClose={() => setTarget(null)}
        onSave={async (items) => {
          if (!target) return;
          await api.saveCell(target.month, target.field, items);
          setTarget(null);
        }}
      />
    </>
  );
}

function OpeningBalance({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [text, setText] = useState(String(value || ''));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(value ? String(value) : '');
  }, [value, editing]);

  return (
    <div className="stat">
      <label className="stat__label" htmlFor="opening-balance">
        Opening balance
      </label>
      <div className="opening">
        <span className="opening__symbol">₹</span>
        <input
          id="opening-balance"
          className="opening__input"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={text}
          placeholder="0"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false);
            const next = sanitizeAmount(text);
            if (next !== value) void onSave(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
      <span className="stat__meta">What you started the year with</span>
    </div>
  );
}

/* ---------------- Desktop table ---------------- */

function PortfolioTable({
  api,
  onOpen,
}: {
  api: ReturnType<typeof usePortfolio>;
  onOpen: (month: PortfolioMonthKey, monthIndex: number, field: PortfolioFieldKey) => void;
}) {
  return (
    <Card title="Yearly sheet" subtitle="Tap any figure to edit its line items" flush>
      <div className="scroll-x">
        <table className="table portfolio-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {EXPENSE_FIELDS.map((f) => (
                <th key={f.key} scope="col" className="num-cell">
                  {f.short}
                </th>
              ))}
              <th scope="col" className="num-cell is-subtotal">
                Expense
              </th>
              {INCOME_FIELDS.map((f) => (
                <th key={f.key} scope="col" className="num-cell">
                  {f.short}
                </th>
              ))}
              <th scope="col" className="num-cell is-subtotal">
                Income
              </th>
              <th scope="col" className="num-cell is-subtotal">
                Savings
              </th>
            </tr>
          </thead>
          <tbody>
            {PORTFOLIO_MONTHS.map((monthKey, i) => {
              const month = api.portfolio.months[monthKey];
              const totals = monthTotals(month);
              const isCurrent = i + 1 === currentMonth();
              return (
                <tr key={monthKey} className={isCurrent ? 'is-current' : undefined}>
                  <th scope="row" className="portfolio-table__month">
                    {MONTH_NAMES[i]}
                  </th>
                  {ALL_FIELDS.map((f) => {
                    const value = cellTotal(month[f.key]);
                    const count = month[f.key].lineItems.length;
                    const isLastExpense = f.key === 'misc';
                    return (
                      <Cell
                        key={f.key}
                        value={value}
                        count={count}
                        after={isLastExpense ? currency(totals.expense) : undefined}
                        label={`${f.label}, ${MONTH_NAMES[i]}`}
                        onClick={() => onOpen(monthKey, i, f.key)}
                      />
                    );
                  })}
                  <td className="num-cell is-subtotal">{currency(totals.income)}</td>
                  <td className={`num-cell is-subtotal ${totals.savings < 0 ? 'text-neg' : totals.savings > 0 ? 'text-pos' : ''}`}>
                    {currency(totals.savings)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {EXPENSE_FIELDS.map((f) => (
                <td key={f.key} className="num-cell">
                  {currency(api.totals.perField[f.key])}
                </td>
              ))}
              <td className="num-cell is-subtotal">{currency(api.totals.expense)}</td>
              {INCOME_FIELDS.map((f) => (
                <td key={f.key} className="num-cell">
                  {currency(api.totals.perField[f.key])}
                </td>
              ))}
              <td className="num-cell is-subtotal">{currency(api.totals.income)}</td>
              <td className={`num-cell is-subtotal ${api.totals.savings < 0 ? 'text-neg' : 'text-pos'}`}>
                {currency(api.totals.savings)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function Cell({
  value,
  count,
  after,
  label,
  onClick,
}: {
  value: number;
  count: number;
  after?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <>
      <td className="num-cell portfolio-cell">
        <button type="button" className={`cell-btn${value > 0 ? ' has-value' : ''}`} onClick={onClick} aria-label={`Edit ${label}`}>
          {value > 0 ? currency(value) : <span className="cell-btn__empty">—</span>}
          {count > 1 ? <span className="cell-btn__count">{count}</span> : null}
        </button>
      </td>
      {after !== undefined ? <td className="num-cell is-subtotal">{after}</td> : null}
    </>
  );
}

/* ---------------- Mobile cards ---------------- */

function PortfolioCards({
  api,
  onOpen,
}: {
  api: ReturnType<typeof usePortfolio>;
  onOpen: (month: PortfolioMonthKey, monthIndex: number, field: PortfolioFieldKey) => void;
}) {
  const [open, setOpen] = useState<PortfolioMonthKey | null>(() => PORTFOLIO_MONTHS[currentMonth() - 1] ?? null);

  return (
    <div className="stack stack--sm">
      {PORTFOLIO_MONTHS.map((monthKey, i) => {
        const month = api.portfolio.months[monthKey];
        const totals = monthTotals(month);
        const expanded = open === monthKey;
        const empty = totals.expense === 0 && totals.income === 0;
        return (
          <section key={monthKey} className={`month-card${expanded ? ' is-open' : ''}`}>
            <button
              type="button"
              className="month-card__head"
              onClick={() => setOpen(expanded ? null : monthKey)}
              aria-expanded={expanded}
            >
              <span className="month-card__name">{MONTH_NAMES[i]}</span>
              <span className={`month-card__savings ${totals.savings < 0 ? 'text-neg' : totals.savings > 0 ? 'text-pos' : 'text-subtle'}`}>
                {empty ? '—' : currency(totals.savings)}
              </span>
              <Icon name="chevronDown" className="month-card__chevron" />
            </button>

            {expanded ? (
              <div className="month-card__body">
                <div className="month-card__summary">
                  <span>
                    <span className="month-card__summary-label">In</span>
                    <span className="text-pos">{currency(totals.income)}</span>
                  </span>
                  <span>
                    <span className="month-card__summary-label">Out</span>
                    <span className="text-neg">{currency(totals.expense)}</span>
                  </span>
                </div>
                <ul className="month-card__rows">
                  {ALL_FIELDS.map((f) => {
                    const value = cellTotal(month[f.key]);
                    const count = month[f.key].lineItems.length;
                    return (
                      <li key={f.key}>
                        <button type="button" className="field-row" onClick={() => onOpen(monthKey, i, f.key)}>
                          <span className={`field-row__dot${INCOME_FIELDS.some((x) => x.key === f.key) ? ' is-income' : ''}`} aria-hidden="true" />
                          <span className="field-row__label">{f.label}</span>
                          {count > 0 ? <span className="field-row__count">{count}</span> : null}
                          <span className={`field-row__value${value > 0 ? '' : ' is-empty'}`}>{value > 0 ? currency(value) : '—'}</span>
                          <Icon name="chevronRight" className="field-row__chevron" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}

      <Card title={`${MONTH_SHORT[0]}–${MONTH_SHORT[11]} total`} className="year-total-card">
        <ul className="total-list">
          <li>
            <span>Total income</span>
            <span className="text-pos">{currency(api.totals.income)}</span>
          </li>
          <li>
            <span>Total expense</span>
            <span className="text-neg">{currency(api.totals.expense)}</span>
          </li>
          <li className="is-strong">
            <span>Savings</span>
            <span className={api.totals.savings < 0 ? 'text-neg' : 'text-pos'}>{currency(api.totals.savings)}</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

/* ---------------- Line items ---------------- */

function LineItemsModal({
  target,
  onClose,
  onSave,
}: {
  target: CellTarget | null;
  onClose: () => void;
  onSave: (items: LineItem[]) => Promise<void>;
}) {
  const toast = useToast();
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!target) return;
    setItems(target.items.length ? target.items : [blankItem(target.year, target.monthIndex)]);
  }, [target]);

  const total = useMemo(() => items.reduce((sum, i) => sum + sanitizeAmount(i.amount), 0), [items]);
  const fieldLabel = ALL_FIELDS.find((f) => f.key === target?.field)?.label ?? '';

  function update(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function save() {
    const clean = items.filter((i) => i.date || i.description.trim() || sanitizeAmount(i.amount) > 0);
    const invalid = clean.find((i) => !i.date || !i.description.trim() || sanitizeAmount(i.amount) <= 0);
    if (invalid) {
      toast.error('Every line needs a date, a description and an amount above zero.');
      return;
    }
    await onSave(clean);
    toast.success('Line items saved.');
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      size="wide"
      title={fieldLabel}
      subtitle={target ? `${MONTH_NAMES[target.monthIndex]} · total ${currency(total)}` : undefined}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="inbox" title="No line items" sub="Add one to start tracking this figure." inline />
      ) : (
        <ul className="lineitems">
          {items.map((item, index) => (
            <li key={index} className="lineitem">
              <div className="lineitem__grid">
                <Field label="Date" htmlFor={`li-date-${index}`}>
                  <input
                    id={`li-date-${index}`}
                    className="input input--sm"
                    type="date"
                    value={item.date}
                    onChange={(e) => update(index, { date: e.target.value })}
                  />
                </Field>
                <Field label="Amount" htmlFor={`li-amount-${index}`}>
                  <div className="input-group">
                    <span className="addon addon--lead">₹</span>
                    <input
                      id={`li-amount-${index}`}
                      className="input input--sm"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.amount || ''}
                      onChange={(e) => update(index, { amount: sanitizeAmount(e.target.value) })}
                    />
                  </div>
                </Field>
              </div>
              <Field label="Description" htmlFor={`li-desc-${index}`}>
                <input
                  id={`li-desc-${index}`}
                  className="input input--sm"
                  value={item.description}
                  maxLength={80}
                  placeholder="What was this?"
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </Field>
              <button
                type="button"
                className="icon-btn icon-btn--sm icon-btn--danger lineitem__remove"
                aria-label={`Remove line item ${index + 1}`}
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              >
                <Icon name="trash" />
              </button>
              {item.date ? <span className="lineitem__stamp">{formatDateShort(item.date)}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="btn btn--secondary btn--block"
        style={{ marginTop: 'var(--s-3)' }}
        onClick={() => setItems((prev) => [...prev, blankItem(target?.year ?? new Date().getFullYear(), target?.monthIndex ?? 0)])}
      >
        <Icon name="plus" />
        Add line item
      </button>
    </Modal>
  );
}

/** Defaults to today inside the live month, otherwise the 1st of that month. */
function blankItem(year: number, monthIndex: number): LineItem {
  const now = new Date();
  const inThisMonth = now.getFullYear() === year && now.getMonth() === monthIndex;
  const date = inThisMonth ? toDateInput(now) : `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  return { date, description: '', amount: 0 };
}
