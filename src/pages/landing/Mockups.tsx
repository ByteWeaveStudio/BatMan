import { Icon, type IconName } from '../../components/Icon';
import { BatMark } from '../../components/BatMark';

/*
 * Product shots, built from live DOM rather than captured images: they stay
 * crisp at any DPI and are always in step with the real design tokens.
 * All of them are pinned to the dark palette — these are "screenshots of the
 * app in dark mode", so they read the same on a light or dark page.
 */

const NAV: { icon: IconName; label: string }[] = [
  { icon: 'dashboard', label: 'Dashboard' },
  { icon: 'analytics', label: 'Analytics' },
  { icon: 'expenses', label: 'Expenses' },
  { icon: 'portfolio', label: 'Portfolio' },
  { icon: 'growth', label: 'Growth' },
];

/** Fixed patterns, never random — the shot must render identically every time. */
const HABITS = [
  { name: 'Deep work', days: '1110111011110110111011110111011' },
  { name: 'Gym', days: '1010010100101001010010100101001' },
  { name: 'Read 20 pages', days: '1111011110111101111011110111101' },
  { name: 'No sugar', days: '1101110011011100110111001101110' },
  { name: 'Sleep by 11', days: '1011101110111011101110111011101' },
];

export function AppShot() {
  return (
    <div className="shot">
      <div className="shot__chrome">
        <span className="shot__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="shot__url">batman.app / dashboard</span>
      </div>

      <div className="shot__body mock">
        <aside className="mock-rail">
          <span className="mock-rail__brand">
            <BatMark size={18} />
            BatMan
          </span>
          {NAV.map((item, i) => (
            <span key={item.label} className={`mock-rail__item${i === 0 ? ' is-active' : ''}`}>
              <Icon name={item.icon} />
              {item.label}
            </span>
          ))}
        </aside>

        <div className="mock-main">
          <div className="mock-topbar">
            <span className="mock-pill">2026</span>
            <span className="mock-spacer" />
            <span className="mock-moon">
              <Icon name="moon" />
            </span>
            <span className="mock-avatar">SB</span>
          </div>

          <div className="mock-content">
            <div className="mock-stats">
              {[
                { label: 'Today', value: '4/5', tone: 'gold' },
                { label: 'This month', value: '82%', tone: '' },
                { label: 'Streak', value: '17d', tone: '' },
              ].map((s) => (
                <div key={s.label} className="mock-stat">
                  <span className="mock-stat__label">{s.label}</span>
                  <span className={`mock-stat__value${s.tone ? ' is-gold' : ''}`}>{s.value}</span>
                </div>
              ))}
            </div>

            <div className="mock-card">
              <div className="mock-card__head">
                <span className="mock-card__title">Yearly goals</span>
                <span className="mock-card__meta">3 of 5 done</span>
              </div>
              {[
                { text: 'Ship v2 of the product', done: true },
                { text: 'Run a half marathon', done: true },
                { text: 'Read 24 books', done: false },
              ].map((g) => (
                <div key={g.text} className={`mock-goal${g.done ? ' is-done' : ''}`}>
                  <span className="mock-check">{g.done ? <Icon name="check" /> : null}</span>
                  {g.text}
                </div>
              ))}
            </div>

            <div className="mock-card">
              <div className="mock-card__head">
                <span className="mock-card__title">Habit tracker</span>
                <span className="mock-card__meta">March</span>
              </div>
              <div className="mock-habits">
                {HABITS.map((h) => (
                  <div key={h.name} className="mock-habit">
                    <span className="mock-habit__name">{h.name}</span>
                    <span className="mock-habit__row">
                      {h.days.split('').map((d, i) => (
                        <i key={i} className={d === '1' ? 'is-on' : undefined} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneShot() {
  const today = [
    { name: 'Deep work', done: true },
    { name: 'Gym', done: true },
    { name: 'Read 20 pages', done: true },
    { name: 'No sugar', done: false },
    { name: 'Sleep by 11', done: false },
  ];
  return (
    <div className="phone mock">
      <div className="phone__notch" />
      <div className="phone__screen">
        <div className="phone__bar">
          <BatMark size={15} />
          <span className="mock-pill mock-pill--sm">2026</span>
          <span className="mock-spacer" />
          <span className="mock-avatar mock-avatar--sm">SB</span>
        </div>
        <div className="phone__body">
          <p className="phone__eyebrow">Today</p>
          <p className="phone__count">
            3<span>/5</span>
          </p>
          {today.map((t) => (
            <div key={t.name} className={`phone__item${t.done ? ' is-done' : ''}`}>
              <span className="mock-check">{t.done ? <Icon name="check" /> : null}</span>
              {t.name}
            </div>
          ))}
        </div>
        <div className="phone__tabs">
          {NAV.map((item, i) => (
            <span key={item.label} className={i === 0 ? 'is-active' : undefined}>
              <Icon name={item.icon} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Dark-mode steps of the validated single-hue gold ramp. */
const RAMP = ['#241d07', '#463809', '#78600d', '#b08c11', '#f5c518'];

export function HeatmapShot() {
  // 26 weeks x 7 days, deterministic pseudo-noise so the shape reads organically.
  const cells: number[] = [];
  for (let i = 0; i < 26 * 7; i++) {
    const wave = Math.sin(i * 0.37) + Math.cos(i * 0.11) + Math.sin(i * 0.83);
    cells.push(Math.min(4, Math.max(0, Math.round(((wave + 3) / 6) * 4.6))));
  }
  return (
    <div className="mock heat-shot">
      <div className="heat-shot__grid">
        {cells.map((level, i) => (
          <span key={i} style={{ background: RAMP[level] }} />
        ))}
      </div>
      <div className="heat-shot__legend">
        <span>Less</span>
        {RAMP.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export function SpendShot() {
  const rows = [
    { name: 'Rent', amount: '₹32,000', pct: 100, color: '#f5c518' },
    { name: 'Groceries', amount: '₹11,400', pct: 36, color: '#12ab9c' },
    { name: 'Transport', amount: '₹6,250', pct: 20, color: '#7c83f2' },
    { name: 'Eating out', amount: '₹4,900', pct: 15, color: '#f4536e' },
    { name: 'Subscriptions', amount: '₹1,780', pct: 6, color: '#bf8600' },
  ];
  return (
    <div className="mock spend-shot">
      <div className="mock-stats">
        <div className="mock-stat">
          <span className="mock-stat__label">Total spend</span>
          <span className="mock-stat__value">₹56,330</span>
        </div>
        <div className="mock-stat">
          <span className="mock-stat__label">Per day</span>
          <span className="mock-stat__value">₹1,817</span>
        </div>
      </div>
      <div className="spend-shot__rows">
        {rows.map((r) => (
          <div key={r.name} className="spend-row">
            <span className="spend-row__top">
              <span>{r.name}</span>
              <span className="spend-row__amt">{r.amount}</span>
            </span>
            <span className="spend-row__track">
              <i style={{ width: `${r.pct}%`, background: r.color }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PILLARS = [
  { name: 'Health', angle: 135, color: '#12ab9c', pct: 72, children: 3 },
  { name: 'Finance', angle: 45, color: '#c98500', pct: 54, children: 2 },
  { name: 'Career', angle: 315, color: '#7c83f2', pct: 88, children: 4 },
  { name: 'People', angle: 225, color: '#f4536e', pct: 41, children: 2 },
];

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: -r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, pct: number, color: string, width: number) {
  if (pct <= 0) return null;
  const angle = (pct / 100) * 360;
  const end = ((-90 + angle) * Math.PI) / 180;
  const large = angle > 180 ? 1 : 0;
  return (
    <path
      d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${(cx + r * Math.cos(end)).toFixed(2)} ${(cy + r * Math.sin(end)).toFixed(2)}`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );
}

export function MindMapShot() {
  return (
    <div className="mock map-shot">
      <svg viewBox="-260 -190 520 380" role="img" aria-label="Radial growth map with four life pillars">
        {PILLARS.map((p) => {
          const pos = polar(112, p.angle);
          const kids = Array.from({ length: p.children }, (_, i) => {
            const spread = p.children === 1 ? 0 : (i / (p.children - 1) - 0.5) * 46;
            return polar(178, p.angle + spread);
          });
          return (
            <g key={p.name}>
              <line x1={0} y1={0} x2={pos.x} y2={pos.y} stroke={p.color} strokeWidth={2.4} opacity={0.55} />
              {kids.map((k, i) => (
                <g key={i}>
                  <line x1={pos.x} y1={pos.y} x2={k.x} y2={k.y} stroke={p.color} strokeWidth={1.3} opacity={0.36} />
                  <circle cx={k.x} cy={k.y} r={7} fill={p.color} fillOpacity={0.22} stroke={p.color} strokeWidth={1.4} />
                </g>
              ))}
              <circle cx={pos.x} cy={pos.y} r={26} fill={p.color} />
              {arc(pos.x, pos.y, 32, p.pct, p.color, 3)}
              <text className="map-shot__pct" x={pos.x} y={pos.y + 4} textAnchor="middle">
                {p.pct}%
              </text>
              {/* Perpendicular to the fan, so a label can never sit on a child node. */}
              <text
                className="map-shot__label"
                x={pos.x}
                y={pos.y + (p.angle > 0 && p.angle < 180 ? -42 : 46)}
                textAnchor="middle"
              >
                {p.name}
              </text>
            </g>
          );
        })}
        <circle cx={0} cy={0} r={38} fill="#0a0a0b" stroke="#26262b" strokeWidth={2} />
        <text className="map-shot__centre" x={0} y={5} textAnchor="middle">
          2026
        </text>
      </svg>
    </div>
  );
}
