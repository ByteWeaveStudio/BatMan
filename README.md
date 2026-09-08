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

`/` serves a public landing page to signed-out visitors and the dashboard to
signed-in ones, so the marketing page and the app share a root URL and the PWA
`start_url` stays `/`. Every other route redirects to sign-in when signed out.

The landing page's product shots (`src/pages/landing/Mockups.tsx`) are built from
live DOM against the real design tokens rather than captured as images — crisp at
any DPI, no bytes to ship, and they can't drift out of date. Swap in real captures
if you'd rather.

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

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Firebase console → Authentication → Settings → Authorised domains**: add
   `<your-user>.github.io`, or Google sign-in fails with
   `auth/unauthorized-domain`.
3. Push to `main`. The site lands at `https://<your-user>.github.io/<repo>/`.

The base path is the part that usually breaks. A project site is served from
`/<repo>/`, so the workflow passes `VITE_BASE` and that single value drives the
asset URLs, the router `basename`, the web-manifest `scope`/`start_url` and the
service-worker registration scope. It resolves itself:

| Situation | Base |
|---|---|
| Project site (`user.github.io/repo`) | `/<repo>/` |
| User site (repo named `user.github.io`) | `/` |
| Custom domain (a `public/CNAME` file exists) | `/` |

Local `npm run build` uses `/`, so dev and preview are unaffected.

Pages has no rewrite rules, so the build writes `dist/404.html` as a byte copy of
`index.html` — a deep link or refresh serves the app and React Router reads the
real URL. It also writes `.nojekyll`, without which Pages runs Jekyll and drops
files beginning with `_`.

**Using a custom domain:** add `public/CNAME` containing the bare hostname, set
it under Settings → Pages, and add that host to Firebase's authorised domains.
The workflow switches the base to `/` automatically.

**Pointing at your own Firebase project:** add the `VITE_FIREBASE_*` values as
repository secrets and pass them through in the workflow's `Build` step under
`env:`. Blank values fall back to the bundled defaults, so a half-configured set
won't break the build.

### SEO and AI crawlers

The build emits three files alongside the app, all generated from the resolved
site URL so they can never point at the wrong host:

| File | What it is |
|---|---|
| `robots.txt` | Allows general crawlers, disallows the signed-in routes (they render an empty shell), and names the AI crawlers explicitly. |
| `sitemap.xml` | The three public URLs, with `lastmod` stamped at build time. |
| `llms.txt` | An [llmstxt.org](https://llmstxt.org) summary — plain markdown describing the product, how it's built and where the public pages are. |

`index.html` carries a canonical link, Open Graph and Twitter card tags, a
1200×630 share image (`public/og.jpg`), and JSON-LD for `WebSite` and
`SoftwareApplication`.

**AI crawlers are allowed by default** so the product is discoverable and
citable. To opt out, flip `ALLOW_AI` to `false` in `vite.config.ts` — every
named agent switches to `Disallow: /`. Note that `Google-Extended` and
`Applebot-Extended` don't crawl at all; they only govern whether already-crawled
content may be used for AI training.

> **Caveat on a GitHub project site.** Crawlers only read `robots.txt` from the
> domain root — `https://<user>.github.io/robots.txt` — which belongs to your
> root user repo, not this one. The generated file lands at
> `/<repo>/robots.txt` and will be ignored until you either move to a custom
> domain or copy its rules into the root repo. The `<meta name="robots">` tag,
> the sitemap and `llms.txt` all work regardless; submit the sitemap directly in
> Search Console.

> **Caveat on client rendering.** This is a client-rendered SPA, so a crawler
> that doesn't execute JavaScript sees an empty root. Googlebot renders JS; most
> AI crawlers currently do not. The `<noscript>` block in `index.html` mirrors
> the landing copy in plain markup (~290 words) so those crawlers get the real
> content. Prerendering the landing route to static HTML would be the stronger
> fix if organic search matters.

### Deploying to Firebase Hosting instead

```bash
npm run build
firebase deploy --only hosting
```

`firebase.json` covers hosting only, and maps every route to `index.html`
(including the old v1 `*.html` URLs). For Netlify or Cloudflare Pages,
`public/_redirects` does the same.

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

The brand is black and bat-signal gold. One constraint is easy to break by
accident: **bright gold only clears 1.6:1 on white**, so light mode splits the
hue into two steps — `--accent` (`#b8860b`, 3.25:1) for fills, focus rings and
active states, and `--accent-text` (`#a16207`, 4.92:1) for anything that is
actually text. Dark mode runs on a near-black surface where the full gold clears
11:1, so one step does both. Anything sitting *on* a gold fill uses
`--on-accent`, never white.

Chart colours in `src/lib/chartTheme.ts`, the pillar tokens and the category
palette in `src/lib/color.ts` were checked with a colour-vision validator against
both surfaces (`#ffffff` / `#141416`) — lightness band, chroma floor, CVD
separation, normal-vision separation and contrast. Re-run that check if you
change them.

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
