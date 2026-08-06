import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const buildDate = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version || '0.0.0'),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __APP_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'pwa/icon-192.svg', 'pwa/icon-512.svg'],
      manifest: {
        name: 'Horizon',
        short_name: 'Horizon',
        description: 'Application de suivi budgetaire Horizon',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#0f172a',
        icons: [
          {
            src: '/pwa/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
        skipWaiting: true,
      },
    }),
  ],
})
