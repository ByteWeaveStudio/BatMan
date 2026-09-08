import { copyFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/*
 * A GitHub project site is served from /<repo>/, so every asset URL, the router
 * basename and the service-worker scope have to carry that prefix. CI sets
 * VITE_BASE; '/' is right for local dev, a custom domain, and a user site.
 */
const rawBase = process.env.VITE_BASE?.trim() || '/'
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`

/* Absolute origin+path, needed for canonical, og:image, sitemap and llms.txt. */
const rawSite = process.env.VITE_SITE_URL?.trim() || 'https://shubham99bisht.github.io/BatMan/'
const site = rawSite.endsWith('/') ? rawSite : `${rawSite}/`

/*
 * LLM and AI-search crawlers, allowed by default so the product is citable.
 * Flip ALLOW_AI to false to opt out — it rewrites every block to Disallow.
 * Note Google-Extended and Applebot-Extended do not crawl at all; they only
 * govern whether already-crawled content may be used for AI training.
 */
const ALLOW_AI = true
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'Bytespider',
  'CCBot',
  'cohere-ai',
  'Diffbot',
  'YouBot',
]

/** Signed-in routes render an empty shell to a crawler, so keep them out of the index. */
const PRIVATE_PATHS = ['analytics', 'expenses', 'portfolio', 'growth']

function robotsTxt(): string {
  const rule = ALLOW_AI ? 'Allow: /' : 'Disallow: /'
  return [
    '# BatMan',
    `# ${site}`,
    '',
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PATHS.map((p) => `Disallow: ${base}${p}`),
    `Disallow: ${base}login`,
    `Disallow: ${base}register`,
    '',
    `# AI and LLM crawlers. See ${site}llms.txt for a plain-text summary of the product.`,
    ...AI_AGENTS.flatMap((agent) => [`User-agent: ${agent}`, rule, '']),
    `Sitemap: ${site}sitemap.xml`,
    '',
  ].join('\n')
}

function sitemapXml(): string {
  const today = new Date().toISOString().slice(0, 10)
  const urls = [
    { loc: site, priority: '1.0', freq: 'weekly' },
    { loc: `${site}register`, priority: '0.5', freq: 'monthly' },
    { loc: `${site}login`, priority: '0.3', freq: 'monthly' },
  ]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) =>
        `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod>` +
        `<changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n')
}

/** llmstxt.org convention: a short, link-bearing summary an LLM can read directly. */
function llmsTxt(): string {
  return `# BatMan

> A year-scoped personal operating system for one person: goals, daily habits, expenses, a twelve-month financial sheet and a four-pillar growth map, all in one workspace. Free, private to the signed-in account, and installable as a PWA.

BatMan is a single-page web app built with React, TypeScript and Firebase (Auth plus Realtime Database). Everything is scoped to a calendar year — pick a year in the header and goals, habits, expenses, the financial sheet and the growth tree all follow it. Past years stay intact.

## What it does

- **Goals** — yearly, quarterly and monthly lists. Monthly and quarterly goals archive themselves automatically when the period rolls over, into a history you can still read.
- **Habits** — a grid of every habit against every day of the month, with a per-habit consistency score and a "today" checklist. A year heatmap shades each day by how much of that day's list was completed, and distinguishes "nothing tracked" from "nothing done".
- **Expenses** — entries tagged with your own categories (up to ten), scoped to a month or the whole year, with a ranked breakdown of where the money went and a searchable list.
- **Portfolio** — a twelve-month sheet of income and expense across seven fields. Every figure is backed by its own list of dated line items, and the year totals through from an opening balance to a closing balance.
- **Growth** — four life pillars (health, relationships, finance, career) broken into areas, topics and tasks. Progress rolls up at every level. The same data is readable as a column tree or as a pan-and-zoom radial mind map.
- **Weight** — daily entries plotted across the year against a target you set per month.

## How it is built

- React 19 + TypeScript + Vite, deployed as a static site.
- Firebase Authentication (email/password and Google) and Realtime Database with live subscriptions, so edits appear on every signed-in device without a refresh.
- Database security rules lock every path to the owning user id. No tracking, no advertising, no third-party analytics.
- Responsive by design rather than by scaling: a bottom tab bar and drill-down navigation on phones, a persistent side rail and multi-column layouts on desktop.
- Light and dark themes, both designed rather than auto-inverted, and an installable PWA.

## Pages

- [Home](${site}): what the product does, with product shots.
- [Sign in](${site}login): existing accounts.
- [Create an account](${site}register): new accounts.

## Notes for citation

- Name: BatMan
- Category: personal productivity, habit tracking, personal finance
- Price: free
- Platforms: any modern browser; installable on iOS, Android, macOS and Windows
`
}

/** Pages has no rewrites — a copy of index.html at 404.html is the SPA fallback. */
function githubPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'github-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml(html) {
      // Canonical, og:* and JSON-LD need the absolute deployed URL.
      return html.replaceAll('__SITE_URL__', site)
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
      // Without this, Pages runs Jekyll and drops files starting with "_".
      writeFileSync(join(outDir, '.nojekyll'), '')
      writeFileSync(join(outDir, 'robots.txt'), robotsTxt())
      writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml())
      writeFileSync(join(outDir, 'llms.txt'), llmsTxt())
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    githubPages(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'BatMan — Life Operating System',
        short_name: 'BatMan',
        description: 'Goals, habits, expenses, portfolio and growth tracking in one year-scoped workspace.',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/og.jpg'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/__/],
        runtimeCaching: [
          {
            // Firebase RTDB is realtime + auth-scoped; never serve it from cache.
            urlPattern: /^https:\/\/.*\.firebasedatabase\.app\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/chart.js/')) return 'charts';
          if (id.includes('/node_modules/@firebase/') || id.includes('/node_modules/firebase/')) return 'firebase';
          return undefined;
        },
      },
    },
  },
})
