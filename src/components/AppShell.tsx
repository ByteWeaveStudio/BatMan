import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { useTheme } from '../context/ThemeContext';
import { initialsOf } from '../lib/format';
import { Icon, type IconName } from './Icon';
import { BatMark } from './BatMark';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: 'dashboard' },
  { to: '/analytics', label: 'Analytics', short: 'Stats', icon: 'analytics' },
  { to: '/expenses', label: 'Expenses', short: 'Spend', icon: 'expenses' },
  { to: '/portfolio', label: 'Portfolio', short: 'Money', icon: 'portfolio' },
  { to: '/growth', label: 'Growth', short: 'Growth', icon: 'growth' },
];

export function AppShell() {
  const { pathname } = useLocation();

  // Route changes should start at the top, like a page load would.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail__brand">
          <BatMark size={28} />
          <span className="rail__wordmark">BatMan</span>
        </div>
        <nav className="rail__nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `rail__link${isActive ? ' is-active' : ''}`}
            >
              <Icon name={item.icon} className="rail__icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail__foot">
          <YearPicker />
        </div>
      </aside>

      <TopBar />

      <main className="main" id="main">
        <div className="main__inner">
          <Outlet />
        </div>
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `tabbar__link${isActive ? ' is-active' : ''}`}
          >
            <Icon name={item.icon} className="tabbar__icon" />
            <span>{item.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <BatMark size={24} />
        <span className="topbar__wordmark">BatMan</span>
      </div>
      <div className="topbar__year">
        <YearPicker compact />
      </div>
      <div className="spacer" />
      <ThemeToggle />
      <AccountMenu />
    </header>
  );
}

function YearPicker({ compact }: { compact?: boolean }) {
  const { year, setYear, options } = useYear();
  return (
    <div className={`year-picker${compact ? ' year-picker--compact' : ''}`}>
      {!compact ? (
        <label className="year-picker__label" htmlFor="year-select">
          Viewing year
        </label>
      ) : null}
      <select
        id={compact ? 'year-select-compact' : 'year-select'}
        className="select select--sm year-picker__select"
        value={year}
        onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
        aria-label="Select year"
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const email = user?.email ?? 'Signed in';
  const name = user?.displayName ?? email.split('@')[0];

  return (
    <div className="account" ref={wrapRef}>
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="avatar__img" referrerPolicy="no-referrer" />
        ) : (
          initialsOf(name)
        )}
      </button>
      {open ? (
        <div className="popover" role="menu">
          <div className="popover__head">
            <p className="popover__name truncate">{name}</p>
            <p className="popover__mail truncate">{email}</p>
          </div>
          <button
            type="button"
            className="popover__item popover__item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
