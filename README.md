# BatMan

A year-scoped personal operating system: goals, daily habits, expenses, a yearly
financial sheet, and a four-pillar growth tree — in one workspace, on any screen.

Built with React 19, TypeScript, Vite and Firebase (Auth + Realtime Database).
Installable as a PWA, with light and dark themes.

---

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Yearly / quarterly / monthly goals with automatic period archiving, a "Today" habit checklist, and a month-wide habit grid with a sticky habit column and per-habit consistency scores. |
| **Analytics** | Completion by month, per-habit consistency, a year heatmap on a validated single-hue scale, and a weight tracker with per-month targets. |
| **Expenses** | Add / edit / delete entries, up to 10 colour-coded categories, month or year scope, spend-over-time chart, a ranked category split, and search. |
| **Portfolio** | A 12-month income/expense sheet. Every figure is a list of dated line items. Full table on desktop, expandable month cards on phones. |
| **Growth** | Four pillars → areas → topics → tasks. A column drill-down (**Tree**) and a pan/zoom radial **Mind map** over the same data, with progress rolling up at every level. |

Everything is scoped by the year picked in the header, and every screen is
live — edits sync across open devices without a refresh.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the built bundle
npm run typecheck
```

Node 20+ required.

### Firebase configuration

The app ships pointed at its original Firebase project. To use your own, copy
`.env.example` to `.env` and fill it in — any value you set overrides the default.

In the Firebase console you need:

1. **Authentication → Sign-in method**: enable **Email/Password**, and **Google**
   if you want the "Continue with Google" button to work.
2. **Realtime Database**: create one and note the URL.
3. **Authentication → Settings → Authorised domains**: add the domain you deploy to.

### Security rules

Realtime Database rules are **managed in the Firebase console** and deliberately
not published here. They lock every path to its owner (`users/{uid}`) and
validate the shape of what gets written.

If you fork this, write your own before letting anyone in — a database left in
test mode is readable by any signed-in user. `.gitignore` already excludes
`database.rules.json`, so you can keep a local copy and deploy it with
`firebase deploy --only database` (add a `"database"` block back to
`firebase.json` first).

### Deploying

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` covers hosting only. It maps every route to `index.html` (including the old v1
`*.html` URLs) so deep links and refreshes work. For Netlify or Cloudflare Pages,
`public/_redirects` does the same; `public/404.html` covers hosts like GitHub
Pages that support neither.

---

## Data model

Stored in the Realtime Database under `users/{uid}/years/{year}` — unchanged from
v1, so existing data loads as-is:

```
goals/{yearly|quarterly|monthly}[]     { text, completed, createdAt }
goals/history/{type}[]                 { …goal, period, archivedAt }
goals/_metadata/{lastMonth,lastQuarter}
tasks/{YYYY-MM}/{habitName}/{day}      true
expenses/{id}                          { name, amount, date, categoryId, place, description, createdAt }
expenseCategories/{id}                 { name, color, createdAt }
portfolio/openingBalance               number
portfolio/months/{jan…dec}/{field}/lineItems[]   { date, description, amount }
growthTree/{Pillar}[]                  area → children (topics) → children (tasks)
weight/{YYYY-MM-DD}                    kg
weightTargets/{1…12}                   kg
```

One addition: a habit with no ticks yet stores `_exists: false`. The Realtime
Database deletes a node whose value is an empty object, so v1 silently lost
brand-new habits on reload; the sentinel keeps them.

---

## Project layout

```
src/
  components/    App shell, modal, confirm dialog, chart canvas, UI primitives
  context/       Auth, selected year, theme, toasts
  hooks/         One hook per data slice (goals, tasks, expenses, portfolio, growth, weight)
  lib/           Firebase, DB paths, types, date/format/colour helpers, chart theme
  pages/         One file per route; growth/ holds the tree and mind-map views
  styles/        Design tokens, base, UI primitives, then one file per page
```

### Design system

`src/styles/tokens.css` is the single source of truth. Components reference
semantic tokens (`--surface`, `--text-muted`, `--accent`) and never raw hex, so
the light and dark themes are one file apart.

Chart colours in `src/lib/chartTheme.ts` and the category palette in
`src/lib/color.ts` were checked with a colour-vision validator against both
surfaces — lightness band, chroma floor, adjacent-pair CVD separation,
normal-vision separation and contrast. Re-run that check if you change them.

### Responsive behaviour

| Width | Layout |
|---|---|
| `< 768px` | Bottom tab bar, single column, growth tree becomes a drill-down, portfolio becomes month cards, modals dock to the bottom edge as sheets. |
| `768–1023px` | Two-column grids, portfolio still card-based. |
| `>= 1024px` | Persistent left rail, multi-column grids, full portfolio table, mind map with a side panel. |

Safe-area insets are respected, so the tab bar and sheets clear the home
indicator on iOS.

---

## License

Personal project. All rights reserved.
