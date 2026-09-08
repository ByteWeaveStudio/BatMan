import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useUid } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/Confirm';
import { useGoals } from '../hooks/useGoals';
import { dayCompletion, useTasks } from '../hooks/useTasks';
import { MONTH_NAMES, WEEKDAY_INITIALS, currentMonth, daysInMonth, isToday, isWeekend, weekdayIndex } from '../lib/dates';
import { percent } from '../lib/format';
import { Card, EmptyState, PageHeader, Progress, Segmented, Spinner } from '../components/primitives';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import type { ArchivedGoal, GoalType, Task } from '../lib/types';

const GOAL_TYPES: { type: GoalType; label: string; hint: string }[] = [
  { type: 'yearly', label: 'Yearly', hint: 'The big rocks for the whole year' },
  { type: 'quarterly', label: 'Quarterly', hint: 'Archived automatically each quarter' },
  { type: 'monthly', label: 'Monthly', hint: 'Archived automatically each month' },
];

export function Dashboard() {
  const uid = useUid();
  const { year, isCurrentYear } = useYear();
  const [month, setMonth] = useState(() => currentMonth());

  // Switching to a past year should land on December, not "today's month".
  useEffect(() => {
    setMonth(isCurrentYear ? currentMonth() : 12);
  }, [year, isCurrentYear]);

  const goalsApi = useGoals(uid, year);
  const tasksApi = useTasks(uid, year, month);

  const todayPct = useMemo(() => {
    if (!isCurrentYear || month !== currentMonth()) return null;
    return dayCompletion(tasksApi.tasks, new Date().getDate());
  }, [tasksApi.tasks, isCurrentYear, month]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub={
          todayPct === null
            ? `${MONTH_NAMES[month - 1]} ${year}`
            : tasksApi.tasks.length === 0
              ? `${MONTH_NAMES[month - 1]} ${year} · no habits tracked yet`
              : `Today you're at ${percent(todayPct)} across ${tasksApi.tasks.length} habit${tasksApi.tasks.length === 1 ? '' : 's'}`
        }
      />

      <div className="goal-grid">
        {GOAL_TYPES.map((cfg) => (
          <GoalCard key={cfg.type} cfg={cfg} api={goalsApi} />
        ))}
      </div>

      {todayPct !== null ? <TodayCard tasks={tasksApi.tasks} onToggle={tasksApi.toggleDay} /> : null}

      <HabitGrid month={month} setMonth={setMonth} year={year} api={tasksApi} />
    </>
  );
}

/* ---------------- Goals ---------------- */

function GoalCard({
  cfg,
  api,
}: {
  cfg: { type: GoalType; label: string; hint: string };
  api: ReturnType<typeof useGoals>;
}) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const list = api.goals[cfg.type];
  const done = list.filter((g) => g.completed).length;
  const pct = list.length ? (done / list.length) * 100 : 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    void api.add(cfg.type, draft);
    setDraft('');
  }

  return (
    <>
      <section className="card goal-card">
        <header className="card__header goal-card__header">
          <div className="truncate">
            <h2 className="card__title">{cfg.label} goals</h2>
            <p className="card__sub">{list.length ? `${done} of ${list.length} done` : cfg.hint}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            title={`${cfg.label} goal history`}
            aria-label={`${cfg.label} goal history`}
            onClick={() => setHistoryOpen(true)}
          >
            <Icon name="history" />
          </button>
        </header>

        <Progress value={pct} />

        <div className="card__body goal-card__body">
          {api.loading ? (
            <div className="stack stack--sm">
              <span className="skeleton" style={{ height: 18 }} />
              <span className="skeleton" style={{ height: 18, width: '70%' }} />
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-subtle">No {cfg.label.toLowerCase()} goals yet.</p>
          ) : (
            <ul className="goal-list">
              {list.map((goal, index) => (
                <GoalRow
                  key={`${index}-${goal.createdAt}`}
                  text={goal.text}
                  completed={goal.completed}
                  onToggle={() => void api.toggle(cfg.type, index)}
                  onCommit={(text) => void api.update(cfg.type, index, text)}
                  onDelete={async () => {
                    const ok = await confirm({
                      title: 'Delete goal?',
                      message: `“${goal.text}” will be removed. This can’t be undone.`,
                      confirmLabel: 'Delete',
                      destructive: true,
                    });
                    if (ok) void api.remove(cfg.type, index);
                  }}
                />
              ))}
            </ul>
          )}

          <form className="goal-add" onSubmit={submit}>
            <input
              className="input input--sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Add a ${cfg.label.toLowerCase()} goal…`}
              aria-label={`Add a ${cfg.label.toLowerCase()} goal`}
            />
            <button type="submit" className="btn btn--secondary btn--sm btn--icon" disabled={!draft.trim()} aria-label="Add goal">
              <Icon name="plus" />
            </button>
          </form>
        </div>
      </section>

      <GoalHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        label={cfg.label}
        load={() => api.loadHistory(cfg.type)}
      />
    </>
  );
}

function GoalRow({
  text,
  completed,
  onToggle,
  onCommit,
  onDelete,
}: {
  text: string;
  completed: boolean;
  onToggle: () => void;
  onCommit: (text: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(text);
  const [editing, setEditing] = useState(false);

  // Adopt remote edits, but never while the field is being typed in.
  useEffect(() => {
    if (!editing) setValue(text);
  }, [text, editing]);

  return (
    <li className={`goal-row${completed ? ' is-done' : ''}`}>
      <input
        type="checkbox"
        className="check"
        checked={completed}
        onChange={onToggle}
        aria-label={completed ? `Mark “${text}” as not done` : `Mark “${text}” as done`}
      />
      <input
        className="goal-row__text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          if (value.trim() !== text) onCommit(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setValue(text);
            e.currentTarget.blur();
          }
        }}
        aria-label="Goal text"
      />
      <button type="button" className="icon-btn icon-btn--sm icon-btn--danger goal-row__delete" onClick={onDelete} aria-label={`Delete goal “${text}”`}>
        <Icon name="close" />
      </button>
    </li>
  );
}

function GoalHistoryModal({
  open,
  onClose,
  label,
  load,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  load: () => Promise<ArchivedGoal[]>;
}) {
  const [items, setItems] = useState<ArchivedGoal[] | null>(null);

  useEffect(() => {
    if (!open) {
      setItems(null);
      return;
    }
    let alive = true;
    void load().then((res) => {
      if (alive) setItems(res);
    });
    return () => {
      alive = false;
    };
  }, [open, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ArchivedGoal[]>();
    (items ?? []).forEach((item) => {
      const period = item.period || 'Unknown period';
      const bucket = map.get(period);
      if (bucket) bucket.push(item);
      else map.set(period, [item]);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  return (
    <Modal open={open} onClose={onClose} title={`${label} goal history`} subtitle="Archived when each period rolled over">
      {items === null ? (
        <Spinner />
      ) : grouped.length === 0 ? (
        <EmptyState icon="history" title="Nothing archived yet" sub={`${label} goals move here automatically when the period ends.`} inline />
      ) : (
        <div className="stack stack--lg">
          {grouped.map(([period, goals]) => {
            const done = goals.filter((g) => g.completed).length;
            return (
              <div key={period} className="stack stack--sm">
                <div className="row row--between">
                  <h3 className="card__title">{period}</h3>
                  <span className="badge badge--neutral">
                    {done}/{goals.length}
                  </span>
                </div>
                <Progress value={goals.length ? (done / goals.length) * 100 : 0} />
                <ul className="stack stack--sm" style={{ marginTop: 'var(--s-1)' }}>
                  {goals.map((g, i) => (
                    <li key={`${period}-${i}`} className={`history-item${g.completed ? ' is-done' : ''}`}>
                      <Icon name={g.completed ? 'check' : 'close'} />
                      <span>{g.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Today ---------------- */

function TodayCard({ tasks, onToggle }: { tasks: Task[]; onToggle: (name: string, day: number) => void }) {
  const day = new Date().getDate();
  if (tasks.length === 0) return null;
  const done = tasks.filter((t) => t.days[String(day)] === true).length;

  return (
    <Card
      title="Today"
      subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      actions={
        <span className="badge badge--accent">
          {done}/{tasks.length}
        </span>
      }
      className="today-card"
    >
      <ul className="today-list">
        {tasks.map((task) => {
          const checked = task.days[String(day)] === true;
          return (
            <li key={task.name}>
              <label className={`today-item${checked ? ' is-done' : ''}`}>
                <input
                  type="checkbox"
                  className="check check--accent check--lg"
                  checked={checked}
                  onChange={() => onToggle(task.name, day)}
                />
                <span className="truncate">{task.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------- Habit grid ---------------- */

function HabitGrid({
  month,
  setMonth,
  year,
  api,
}: {
  month: number;
  setMonth: (m: number) => void;
  year: number;
  api: ReturnType<typeof useTasks>;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState('');
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const total = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  function add(e: FormEvent) {
    e.preventDefault();
    const res = api.addTask(draft);
    if (!res.ok) {
      if (res.reason === 'duplicate') toast.error('A habit with that name already exists.');
      if (res.reason === 'invalid') toast.error('Habit names can’t contain . # $ / [ or ]');
      return;
    }
    setDraft('');
  }

  async function copy() {
    const ok = await confirm({
      title: 'Copy habits from last month?',
      message: 'Habit names are copied across. Existing habits and all tick marks are left untouched.',
      confirmLabel: 'Copy habits',
    });
    if (!ok) return;
    const added = await api.copyFromPreviousMonth();
    if (added === 0) toast.toast('Nothing new to copy from last month.');
    else toast.success(`Copied ${added} habit${added === 1 ? '' : 's'}.`);
  }

  return (
    <Card
      title="Habit tracker"
      subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
      flush
      className="habit-card"
      actions={
        <>
          <select
            className="select select--sm select--auto"
            value={month}
            onChange={(e) => setMonth(Number.parseInt(e.target.value, 10))}
            aria-label="Select month"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <div className="habit-density">
            <Segmented
              value={density}
              onChange={setDensity}
              ariaLabel="Grid density"
              options={[
                { value: 'comfortable', label: 'Roomy' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>
          <button type="button" className="btn btn--secondary btn--sm" onClick={copy}>
            <Icon name="copy" />
            <span className="habit-copy-label">Copy last month</span>
          </button>
        </>
      }
    >
      {api.loading ? (
        <Spinner label="Loading habits" />
      ) : api.tasks.length === 0 ? (
        <EmptyState
          icon="target"
          title="No habits for this month"
          sub="Add one below, or copy last month’s set to get going in one tap."
        />
      ) : (
        <div className={`scroll-x habit-scroll habit-scroll--${density}`}>
          <table className="habit-table">
            <thead>
              <tr>
                <th className="habit-table__name-head" scope="col">
                  Habit
                </th>
                {days.map((day) => {
                  const dow = weekdayIndex(year, month, day);
                  return (
                    <th
                      key={day}
                      scope="col"
                      className={`habit-table__day-head${isWeekend(year, month, day) ? ' is-weekend' : ''}${
                        isToday(year, month, day) ? ' is-today' : ''
                      }`}
                    >
                      <span className="habit-table__dow">{WEEKDAY_INITIALS[dow]}</span>
                      <span className="habit-table__dom">{day}</span>
                    </th>
                  );
                })}
                <th className="habit-table__score-head" scope="col">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {api.tasks.map((task) => {
                const stat = api.stats.perTask.find((s) => s.name === task.name);
                return (
                  <tr key={task.name}>
                    <th scope="row" className="habit-table__name">
                      <TaskName
                        name={task.name}
                        onRename={async (next) => {
                          const res = await api.renameTask(task.name, next);
                          if (!res.ok && res.reason === 'duplicate') toast.error('A habit with that name already exists.');
                          if (!res.ok && res.reason === 'invalid') toast.error('Habit names can’t contain . # $ / [ or ]');
                          return res.ok;
                        }}
                        onDelete={async () => {
                          const ok = await confirm({
                            title: `Delete “${task.name}”?`,
                            message: 'Its tick marks for this month will be removed too.',
                            confirmLabel: 'Delete habit',
                            destructive: true,
                          });
                          if (ok) void api.deleteTask(task.name);
                        }}
                      />
                    </th>
                    {days.map((day) => {
                      const checked = task.days[String(day)] === true;
                      return (
                        <td
                          key={day}
                          className={`habit-table__cell${isWeekend(year, month, day) ? ' is-weekend' : ''}${
                            isToday(year, month, day) ? ' is-today' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="check check--accent habit-check"
                            checked={checked}
                            onChange={() => api.toggleDay(task.name, day)}
                            aria-label={`${task.name}, day ${day}`}
                          />
                        </td>
                      );
                    })}
                    <td className="habit-table__score">{Math.round(stat?.pct ?? 0)}%</td>
                  </tr>
                );
              })}
              <tr className="habit-table__totals">
                <th scope="row" className="habit-table__name">
                  Day score
                </th>
                {days.map((day) => {
                  const pct = dayCompletion(api.tasks, day);
                  return (
                    <td
                      key={day}
                      className={`habit-table__cell${isWeekend(year, month, day) ? ' is-weekend' : ''}${
                        isToday(year, month, day) ? ' is-today' : ''
                      }`}
                    >
                      <span className="habit-dot" style={{ opacity: pct === 0 ? 0.18 : 0.25 + (pct / 100) * 0.75 }} />
                    </td>
                  );
                })}
                <td className="habit-table__score" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <form className="habit-add" onSubmit={add}>
        <input
          className="input input--sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a habit…"
          aria-label="Add a habit"
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={!draft.trim()}>
          <Icon name="plus" />
          Add
        </button>
      </form>
    </Card>
  );
}

function TaskName({
  name,
  onRename,
  onDelete,
}: {
  name: string;
  onRename: (next: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(name);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setValue(name);
  }, [name, editing]);

  return (
    <div className="habit-name">
      <input
        className="habit-name__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={async () => {
          setEditing(false);
          const next = value.trim();
          if (!next || next === name) {
            setValue(name);
            return;
          }
          const ok = await onRename(next);
          if (!ok) setValue(name);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setValue(name);
            e.currentTarget.blur();
          }
        }}
        aria-label={`Rename habit ${name}`}
      />
      <button type="button" className="icon-btn icon-btn--sm icon-btn--danger habit-name__delete" onClick={onDelete} aria-label={`Delete habit ${name}`}>
        <Icon name="trash" />
      </button>
    </div>
  );
}
