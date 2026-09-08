import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { clamp } from '../lib/format';

export function Card({
  title,
  subtitle,
  actions,
  children,
  flush,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`card ${className}`.trim()}>
      {title ? (
        <header className="card__header">
          <div className="truncate">
            <h2 className="card__title truncate">{title}</h2>
            {subtitle ? <p className="card__sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="row row--wrap" style={{ gap: 'var(--s-2)' }}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={`card__body${flush ? ' card__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: 'pos' | 'neg';
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${tone ? ` stat__value--${tone}` : ''}`}>{value}</span>
      {meta ? <span className="stat__meta">{meta}</span> : null}
    </div>
  );
}

export function Progress({ value, color, thin }: { value: number; color?: string; thin?: boolean }) {
  const pct = clamp(value, 0, 100);
  return (
    <div
      className={`progress${thin ? ' progress--thin' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress__bar" style={{ width: `${pct}%`, ...(color ? { '--progress-color': color } as never : {}) }} />
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  sub,
  action,
  inline,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
  action?: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={`empty${inline ? ' empty--inline' : ''}`}>
      <Icon name={icon} className="empty__icon" />
      <p className="empty__title">{title}</p>
      {sub ? <p className="empty__sub">{sub}</p> : null}
      {action ? <div style={{ marginTop: 'var(--s-2)' }}>{action}</div> : null}
    </div>
  );
}

export function Spinner({ large, label }: { large?: boolean; label?: string }) {
  return (
    <div className="center-pad">
      <div className="stack" style={{ alignItems: 'center', gap: 'var(--s-3)' }}>
        <div className={`spinner${large ? ' spinner--lg' : ''}`} role="status" aria-label={label ?? 'Loading'} />
        {label ? <p className="text-sm text-subtle">{label}</p> : null}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  block,
  ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  block?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={`segmented${block ? ' segmented--block' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {sub ? <p className="page-header__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="req" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
