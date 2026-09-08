import { Link } from 'react-router-dom';
import { BatMark } from '../components/BatMark';
import { Icon, type IconName } from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { AppShot, HeatmapShot, MindMapShot, PhoneShot, SpendShot } from './landing/Mockups';

export function Landing() {
  const { theme, toggle } = useTheme();

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav__inner">
          <span className="lp-nav__brand">
            <BatMark size={26} />
            BatMan
          </span>
          <div className="lp-nav__actions">
            <button
              type="button"
              className="lp-icon-btn"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <Link className="lp-nav__link" to="/login">
              Sign in
            </Link>
            <Link className="btn btn--accent btn--sm" to="/register">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero__inner">
          <span className="lp-badge">
            <span className="lp-badge__dot" />
            Your personal operating system
          </span>
          <h1 className="lp-hero__title">
            Run your year like
            <br />
            <span className="lp-hero__accent">you run a product.</span>
          </h1>
          <p className="lp-hero__sub">
            Goals, habits, spending, savings and long-term growth — one workspace, scoped to a single
            year, syncing the instant you change anything.
          </p>
          <div className="lp-hero__cta">
            <Link className="btn btn--accent btn--lg" to="/register">
              Start this year
              <Icon name="chevronRight" />
            </Link>
            <Link className="btn btn--lg lp-btn-ghost" to="/login">
              Sign in
            </Link>
          </div>
          <p className="lp-hero__note">Free · phone and desktop · installs to your home screen</p>
        </div>

        <div className="lp-shot">
          <div className="lp-shot__glow" aria-hidden="true" />
          <div className="lp-shot__stage">
            <AppShot />
            <div className="lp-shot__phone">
              <PhoneShot />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-strip">
        {[
          { k: '5', v: 'connected areas' },
          { k: '365', v: 'days on one screen' },
          { k: '4', v: 'growth pillars' },
          { k: '0', v: 'trackers or ads' },
        ].map((s) => (
          <div key={s.v} className="lp-strip__item">
            <span className="lp-strip__k">{s.k}</span>
            <span className="lp-strip__v">{s.v}</span>
          </div>
        ))}
      </section>

      <main>
        <section className="lp-row">
          <div className="lp-row__text">
            <span className="lp-kicker">Habits</span>
            <h2 className="lp-row__title">A year you can see at a glance</h2>
            <p className="lp-prose">
              Tick habits on a month-wide grid, then watch the year fill in behind you. The heatmap
              shades each day by how much of that day's list you actually finished — so a bad week
              is obvious, and so is a good run.
            </p>
            <ul className="lp-mini">
              <li>
                <Icon name="check" /> Sticky habit column, every day of the month
              </li>
              <li>
                <Icon name="check" /> Per-habit consistency scores
              </li>
              <li>
                <Icon name="check" /> Distinguishes “nothing tracked” from “nothing done”
              </li>
            </ul>
          </div>
          <div className="lp-row__visual">
            <HeatmapShot />
          </div>
        </section>

        <section className="lp-row lp-row--flip">
          <div className="lp-row__text">
            <span className="lp-kicker">Money</span>
            <h2 className="lp-row__title">Numbers with receipts attached</h2>
            <p className="lp-prose">
              Log a spend in seconds and see where the month went, ranked rather than buried in a pie
              chart. The yearly sheet goes further: every figure opens into its own list of dated
              line items, so a total is never a number you just have to trust.
            </p>
            <ul className="lp-mini">
              <li>
                <Icon name="check" /> Your own categories, month or year scope
              </li>
              <li>
                <Icon name="check" /> Twelve months of income and expense
              </li>
              <li>
                <Icon name="check" /> Opening balance through to closing
              </li>
            </ul>
          </div>
          <div className="lp-row__visual">
            <SpendShot />
          </div>
        </section>

        <section className="lp-row">
          <div className="lp-row__text">
            <span className="lp-kicker">Growth</span>
            <h2 className="lp-row__title">The long game, mapped</h2>
            <p className="lp-prose">
              Health, relationships, finance and career, each broken into areas, topics and tasks.
              Progress rolls up at every level, so finishing one small task moves the pillar it
              belongs to. Read it as a tree, or as a radial map you can pan and zoom.
            </p>
            <ul className="lp-mini">
              <li>
                <Icon name="check" /> Four pillars, four levels deep
              </li>
              <li>
                <Icon name="check" /> Notes on any task
              </li>
              <li>
                <Icon name="check" /> Same data, two views
              </li>
            </ul>
          </div>
          <div className="lp-row__visual">
            <MindMapShot />
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-section__head">
            <h2 className="lp-section__title">And the rest of it</h2>
            <p className="lp-section__sub">The details that make it survive daily use.</p>
          </div>
          <div className="lp-grid">
            {(
              [
                {
                  icon: 'history',
                  title: 'Goals that archive themselves',
                  body: 'Monthly and quarterly goals roll over on their own when the period ends. Nothing is lost, nothing lingers.',
                },
                {
                  icon: 'calendar',
                  title: 'Scoped to one year',
                  body: 'Pick a year in the header and everything follows it. Last year stays exactly as you left it.',
                },
                {
                  icon: 'scale',
                  title: 'Weight against a target',
                  body: 'Log a weight, set a goal for each month, and see the line against it across the whole year.',
                },
                {
                  icon: 'spark',
                  title: 'Live on every device',
                  body: 'Tick something on your phone and the laptop updates without a refresh.',
                },
                {
                  icon: 'moon',
                  title: 'Light and dark',
                  body: 'Follows your system until you pick a side. Both themes are designed, not auto-inverted.',
                },
                {
                  icon: 'eye',
                  title: 'Private by default',
                  body: 'Every path in the database is locked to your account. No tracking, no ads, no third-party analytics.',
                },
              ] as { icon: IconName; title: string; body: string }[]
            ).map((f) => (
              <article key={f.title} className="lp-feature">
                <span className="lp-feature__icon">
                  <Icon name={f.icon} />
                </span>
                <h3 className="lp-feature__title">{f.title}</h3>
                <p className="lp-feature__body">{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <section className="lp-cta">
        <div className="lp-cta__inner">
          <span className="lp-cta__mark">
            <BatMark size={34} />
          </span>
          <h2 className="lp-cta__title">Start with this year.</h2>
          <p className="lp-cta__sub">
            About a minute to set up. Add one goal and one habit and you're already running.
          </p>
          <Link className="btn btn--accent btn--lg" to="/register">
            Create your account
            <Icon name="chevronRight" />
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <span className="lp-nav__brand">
          <BatMark size={20} />
          BatMan
        </span>
        <nav className="lp-footer__links">
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create account</Link>
        </nav>
      </footer>
    </div>
  );
}
