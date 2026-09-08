import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { useUid } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/Confirm';
import { useIsPhone } from '../hooks/useMediaQuery';
import { taskBreakdown, useYearTasks, type DayCell } from '../hooks/useYearTasks';
import { useWeight } from '../hooks/useWeight';
import {
  MONTH_NAMES,
  MONTH_SHORT,
  allDatesInYear,
  currentMonth,
  formatDateLabel,
  toDateInput,
  yearMonthKey,
} from '../lib/dates';
import { percent, round1 } from '../lib/format';
import { RAMP_BINS, chartTheme, rampColor } from '../lib/chartTheme';
import { BAR_SIZING, baseOptions, categoryScale, valueScale } from '../lib/chartOptions';
import { Card, EmptyState, Field, PageHeader, Spinner, Stat } from '../components/primitives';
import { BarList } from '../components/BarList';
import { ChartCanvas } from '../components/ChartCanvas';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import type { WeightTargets } from '../lib/types';

export function Analytics() {
  const uid = useUid();
  const { year, isCurrentYear } = useYear();
  const [month, setMonth] = useState(() => currentMonth());

  useEffect(() => {
    setMonth(isCurrentYear ? currentMonth() : 12);
  }, [year, isCurrentYear]);

  const { monthTasks, monthly, byDate, loading } = useYearTasks(uid, year);

  const yearStats = useMemo(() => {
    const tracked = monthly.filter((m) => m.tracked);
    const avg = tracked.length ? tracked.reduce((s, m) => s + m.pct, 0) / tracked.length : 0;
    const best = tracked.reduce<{ month: number; pct: number } | null>(
      (acc, m) => (!acc || m.pct > acc.pct ? { month: m.month, pct: m.pct } : acc),
      null,
    );
    let perfectDays = 0;
    byDate.forEach((cell) => {
      if (cell.pct !== null && cell.total > 0 && cell.pct >= 100) perfectDays += 1;
    });
    return { avg, best, trackedMonths: tracked.length, perfectDays };
  }, [monthly, byDate]);

  const breakdown = useMemo(
    () => taskBreakdown(monthTasks[yearMonthKey(year, month)] ?? {}, year, month),
    [monthTasks, year, month],
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        sub={`How ${year} is actually going`}
        actions={
          <select
            className="select select--sm select--auto"
            value={month}
            onChange={(e) => setMonth(Number.parseInt(e.target.value, 10))}
            aria-label="Month for the month-scoped panels"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        }
      />

      <div className="stat-row">
        <Stat label="Year average" value={percent(yearStats.avg)} meta={`${yearStats.trackedMonths} of 12 months tracked`} />
        <Stat
          label="Best month"
          value={yearStats.best ? MONTH_SHORT[yearStats.best.month - 1] : '—'}
          meta={yearStats.best ? percent(yearStats.best.pct) : 'No data yet'}
        />
        <Stat label="Perfect days" value={String(yearStats.perfectDays)} meta="Every habit ticked" />
      </div>

      {loading ? (
        <Spinner large label="Crunching your year" />
      ) : (
        <div className="analytics-grid">
          <MonthlyAverageChart monthly={monthly} />
          <TaskBreakdown breakdown={breakdown} month={month} />
          <YearHeatmap year={year} byDate={byDate} />
        </div>
      )}

      <WeightPanel uid={uid} year={year} />
    </>
  );
}

/* ---------------- Monthly average ---------------- */

function MonthlyAverageChart({ monthly }: { monthly: { month: number; pct: number; tracked: boolean }[] }) {
  const { theme } = useTheme();
  const t = chartTheme(theme);
  const hasData = monthly.some((m) => m.tracked);

  const config = useMemo<ChartConfiguration>(() => {
    const base = baseOptions(t);
    return {
      type: 'bar',
      data: {
        labels: MONTH_SHORT,
        datasets: [
          {
            label: 'Average completion',
            data: monthly.map((m) => Math.round(m.pct)),
            backgroundColor: t.series[0],
            hoverBackgroundColor: t.series[0],
            ...BAR_SIZING,
          },
        ],
      },
      options: {
        ...base,
        scales: {
          x: categoryScale(t),
          y: valueScale(t, {
            max: 100,
            ticks: { color: t.subtle, font: { size: 11 }, padding: 8, stepSize: 25, callback: (v: unknown) => `${v}%` },
          }),
        },
        plugins: {
          ...base.plugins,
          tooltip: {
            ...base.plugins?.tooltip,
            callbacks: {
              label: (ctx: { parsed: { y: number } }) => `${ctx.parsed.y}% average completion`,
            },
          },
        },
      },
    } as ChartConfiguration;
  }, [monthly, t]);

  return (
    <Card title="Habit completion by month" subtitle="Average across every habit and every day of the month">
      {hasData ? (
        <ChartCanvas config={config} height={230} ariaLabel="Column chart of average habit completion percentage for each month" />
      ) : (
        <EmptyState icon="analytics" title="No habits tracked yet" sub="Add habits on the dashboard and this fills in as you tick them off." />
      )}
    </Card>
  );
}

/* ---------------- Task breakdown ---------------- */

function TaskBreakdown({
  breakdown,
  month,
}: {
  breakdown: { name: string; done: number; total: number; pct: number }[];
  month: number;
}) {
  const { theme } = useTheme();
  const t = chartTheme(theme);

  return (
    <Card title="Habit consistency" subtitle={`${MONTH_NAMES[month - 1]} — share of days ticked`}>
      {breakdown.length === 0 ? (
        <EmptyState icon="target" title="No habits this month" sub="Nothing was tracked in this month." inline />
      ) : (
        <BarList
          max={100}
          items={breakdown.map((item) => ({
            key: item.name,
            label: item.name,
            labelText: item.name,
            value: item.pct,
            display: `${Math.round(item.pct)}%`,
            meta: `${item.done} of ${item.total} days`,
            color: t.series[0],
          }))}
        />
      )}
    </Card>
  );
}

/* ---------------- Heatmap ---------------- */

function YearHeatmap({ year, byDate }: { year: number; byDate: Map<string, DayCell> }) {
  const { theme } = useTheme();
  const t = chartTheme(theme);
  const dates = useMemo(() => allDatesInYear(year), [year]);
  const todayKey = toDateInput(new Date());

  // Monday-first columns, one column per ISO-ish week.
  const startOffset = useMemo(() => (new Date(year, 0, 1).getDay() + 6) % 7, [year]);
  const weeks = Math.ceil((startOffset + dates.length) / 7);

  const monthLabels = useMemo(
    () =>
      MONTH_SHORT.map((label, i) => {
        const firstOfMonth = new Date(year, i, 1);
        const dayOfYear = Math.round((firstOfMonth.getTime() - new Date(year, 0, 1).getTime()) / 86_400_000);
        return { label, column: Math.floor((startOffset + dayOfYear) / 7) + 1 };
      }),
    [year, startOffset],
  );

  return (
    <Card
      title="Year at a glance"
      subtitle="One square per day, shaded by how much of that day’s habit list you completed"
      className="heatmap-card"
    >
      <div className="scroll-x">
        <div className="heatmap" style={{ ['--weeks' as string]: weeks }}>
          <div className="heatmap__months">
            {monthLabels.map((m) => (
              <span key={m.label} className="heatmap__month" style={{ gridColumn: m.column }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="heatmap__grid">
            {Array.from({ length: startOffset }, (_, i) => (
              <span key={`pad-${i}`} className="heatmap__cell is-pad" aria-hidden="true" />
            ))}
            {dates.map((date) => {
              const cell = byDate.get(date);
              const future = date > todayKey;
              const noData = !cell || cell.pct === null;
              const title = future
                ? `${formatDateLabel(date)} — upcoming`
                : noData
                  ? `${formatDateLabel(date)} — no habits tracked`
                  : `${formatDateLabel(date)} — ${Math.round(cell.pct ?? 0)}% (${cell.done}/${cell.total})`;
              return (
                <span
                  key={date}
                  className={`heatmap__cell${future ? ' is-future' : ''}${noData && !future ? ' is-nodata' : ''}`}
                  style={!future && !noData ? { background: rampColor(t, cell.pct ?? 0) } : undefined}
                  title={title}
                  aria-label={title}
                  role="img"
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="heatmap__legend">
        <span className="heatmap__legend-title">Completion</span>
        {RAMP_BINS.map((bin, i) => (
          <span key={bin.label} className="heatmap__legend-item">
            <span className="heatmap__legend-swatch" style={{ background: t.ramp[i] }} />
            {bin.label}
          </span>
        ))}
        <span className="heatmap__legend-item">
          <span className="heatmap__legend-swatch is-nodata" />
          Not tracked
        </span>
      </div>
    </Card>
  );
}

/* ---------------- Weight ---------------- */

function WeightPanel({ uid, year }: { uid: string; year: number }) {
  const { theme } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const isPhone = useIsPhone();
  const t = chartTheme(theme);
  const api = useWeight(uid, year);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const defaultDate = useMemo(() => {
    const now = new Date();
    return now.getFullYear() === year ? toDateInput(now) : `${year}-01-01`;
  }, [year]);

  const [date, setDate] = useState(defaultDate);
  const [value, setValue] = useState('');

  useEffect(() => setDate(defaultDate), [defaultDate]);

  const dates = useMemo(() => allDatesInYear(year), [year]);
  const hasEntries = api.sortedDates.length > 0;
  const hasTargets = Object.keys(api.targets).length > 0;

  const config = useMemo<ChartConfiguration>(() => {
    const base = baseOptions(t);
    const weightSeries = dates.map((d) => (d in api.entries ? api.entries[d] : null));
    const targetSeries = dates.map((d) => {
      const m = Number.parseInt(d.slice(5, 7), 10);
      const raw = api.targets[String(m)];
      return raw === undefined || raw === null ? null : Number(raw);
    });

    return {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Weight',
            data: weightSeries,
            borderColor: t.series[0],
            backgroundColor: t.seriesWash,
            borderWidth: 2,
            pointRadius: (ctx: { parsed?: { y: number | null } }) => (ctx.parsed?.y == null ? 0 : 4),
            pointHoverRadius: (ctx: { parsed?: { y: number | null } }) => (ctx.parsed?.y == null ? 0 : 6),
            pointBackgroundColor: t.series[0],
            pointBorderColor: t.surface,
            pointBorderWidth: 2,
            tension: 0.25,
            fill: true,
            spanGaps: true,
          },
          {
            label: 'Monthly target',
            data: targetSeries,
            borderColor: t.reference,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            spanGaps: false,
            tension: 0,
          },
        ],
      },
      options: {
        ...base,
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: {
          ...base.plugins,
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: t.muted,
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 11 },
              padding: 14,
            },
          },
          tooltip: {
            ...base.plugins?.tooltip,
            filter: (item: { parsed: { y: number | null } }) => item.parsed.y != null,
            callbacks: {
              title: (items: { label: string }[]) => formatDateLabel(items[0]?.label ?? ''),
              label: (item: { datasetIndex: number; parsed: { y: number } }) =>
                item.datasetIndex === 0 ? `Weight ${item.parsed.y} kg` : `Target ${item.parsed.y} kg`,
            },
          },
        },
        scales: {
          x: categoryScale(t, {
            ticks: {
              color: t.subtle,
              font: { size: 11 },
              autoSkip: false,
              maxRotation: 0,
              callback: (_v: unknown, index: number) => {
                const d = dates[index];
                if (!d || !d.endsWith('-01')) return '';
                const m = Number.parseInt(d.slice(5, 7), 10);
                if (isPhone && m % 2 === 0) return '';
                return MONTH_SHORT[m - 1];
              },
            },
          }),
          y: valueScale(t, {
            beginAtZero: false,
            ticks: { color: t.subtle, font: { size: 11 }, padding: 8, maxTicksLimit: 6, callback: (v: unknown) => `${v} kg` },
          }),
        },
      },
    } as ChartConfiguration;
  }, [dates, api.entries, api.targets, t, isPhone]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(value);
    if (!date) return toast.error('Pick a date first.');
    if (!date.startsWith(`${year}-`)) return toast.error(`Pick a date inside ${year}, or switch year in the header.`);
    if (!Number.isFinite(parsed) || parsed <= 0) return toast.error('Enter a weight above zero.');
    await api.saveEntry(date, parsed);
    setValue('');
    toast.success(`Logged ${round1(parsed)} kg for ${formatDateLabel(date)}.`);
  }

  const recent = useMemo(() => [...api.sortedDates].reverse().slice(0, 8), [api.sortedDates]);

  return (
    <Card
      title="Weight"
      subtitle={api.latest ? `Latest ${api.latest.value} kg on ${formatDateLabel(api.latest.date)}` : `No entries for ${year} yet`}
      className="weight-card"
      actions={
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setTargetsOpen(true)}>
          <Icon name="target" />
          Targets
        </button>
      }
    >
      <form className="weight-add" onSubmit={add}>
        <Field label="Date" htmlFor="weight-date">
          <input
            id="weight-date"
            type="date"
            className="input input--sm"
            value={date}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Weight" htmlFor="weight-value">
          <div className="input-group">
            <input
              id="weight-value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              className="input input--sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="72.5"
            />
            <span className="addon">kg</span>
          </div>
        </Field>
        <button type="submit" className="btn btn--primary btn--sm weight-add__submit" disabled={!value.trim()}>
          <Icon name="plus" />
          Log
        </button>
      </form>

      {api.loading ? (
        <Spinner />
      ) : hasEntries || hasTargets ? (
        <>
          {api.change !== null ? (
            <p className={`weight-change ${api.change <= 0 ? 'text-pos' : 'text-neg'}`}>
              {api.change > 0 ? '+' : ''}
              {api.change} kg since your first entry this year
            </p>
          ) : null}
          <ChartCanvas config={config} height={250} ariaLabel={`Line chart of weight through ${year} against the monthly target`} />
          {recent.length > 0 ? (
            <div className="weight-recent">
              <span className="weight-recent__label">Recent</span>
              {recent.map((d) => (
                <span key={d} className="chip weight-chip">
                  <span className="chip__name">
                    {formatDateLabel(d)} · {api.entries[d]} kg
                  </span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm icon-btn--danger"
                    aria-label={`Delete entry for ${formatDateLabel(d)}`}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete this weight entry?',
                        message: `${api.entries[d]} kg on ${formatDateLabel(d)}.`,
                        confirmLabel: 'Delete',
                        destructive: true,
                      });
                      if (ok) void api.deleteEntry(d);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState icon="scale" title={`Nothing logged for ${year}`} sub="Add today's weight above — the chart spans the whole year." />
      )}

      <TargetsModal open={targetsOpen} onClose={() => setTargetsOpen(false)} targets={api.targets} onSave={api.saveTargets} />
    </Card>
  );
}

function TargetsModal({
  open,
  onClose,
  targets,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  targets: WeightTargets;
  onSave: (next: WeightTargets) => Promise<void>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (let m = 1; m <= 12; m++) {
      const v = targets[String(m)];
      next[String(m)] = v === undefined || v === null ? '' : String(v);
    }
    setDraft(next);
  }, [open, targets]);

  async function save() {
    const next: WeightTargets = {};
    for (let m = 1; m <= 12; m++) {
      const raw = (draft[String(m)] ?? '').trim();
      if (!raw) continue;
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error(`${MONTH_NAMES[m - 1]} needs a weight above zero, or leave it blank.`);
        return;
      }
      next[String(m)] = round1(parsed);
    }
    await onSave(next);
    toast.success('Targets saved.');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Monthly weight targets"
      subtitle="Blank months draw no target line."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Save targets
          </button>
        </>
      }
    >
      <div className="targets-grid">
        {MONTH_NAMES.map((name, i) => {
          const key = String(i + 1);
          return (
            <Field key={name} label={name} htmlFor={`target-${key}`}>
              <div className="input-group">
                <input
                  id={`target-${key}`}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  className="input input--sm"
                  value={draft[key] ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="—"
                />
                <span className="addon">kg</span>
              </div>
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}
