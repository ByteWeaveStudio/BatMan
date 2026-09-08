import type { ReactNode } from 'react';

export interface BarListItem {
  key: string;
  label: ReactNode;
  /** Plain-text label for the accessible name when `label` is a node. */
  labelText?: string;
  value: number;
  display: string;
  meta?: string;
  color?: string;
}

/**
 * Ranked horizontal bars in HTML. Preferred over a pie or a many-slice donut:
 * every row is directly labelled, so identity never depends on colour alone.
 */
export function BarList({ items, max }: { items: BarListItem[]; max?: number }) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="barlist">
      {items.map((item) => {
        const pct = peak > 0 ? (item.value / peak) * 100 : 0;
        return (
          <li key={item.key} className="barlist__row">
            <div className="barlist__head">
              <span className="barlist__label truncate">{item.label}</span>
              <span className="barlist__value">{item.display}</span>
            </div>
            <div
              className="barlist__track"
              role="img"
              aria-label={`${item.labelText ?? ''} ${item.display}`.trim()}
            >
              <span
                className="barlist__fill"
                style={{ width: `${Math.max(pct, 1.5)}%`, background: item.color ?? 'var(--accent)' }}
              />
            </div>
            {item.meta ? <span className="barlist__meta">{item.meta}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
