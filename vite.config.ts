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

/** Pages has no rewrites — a copy of index.html at 404.html is the SPA fallback. */
function githubPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'github-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
      // Without this, Pages runs Jekyll and drops files starting with "_".
      writeFileSync(join(outDir, '.nojekyll'), '')
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
