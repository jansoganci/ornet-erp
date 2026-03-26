import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.svg', 'apple-touch-icon.png', 'ornet.logo.png'],
      manifest: {
        name: 'Ornet ERP - Security Management',
        short_name: 'Ornet ERP',
        description: 'Ornet Security - Work Order Management & ERP',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // App + @react-pdf are large; suppress noise until routes are lazy-loaded.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Split only heavy, stable deps. A catch-all "vendor" chunk can create
        // circular deps with react-vendor; leave other node_modules to Rollup.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('@react-pdf')) return 'pdf-renderer'
          if (id.includes('pdfjs-dist')) return 'pdfjs'
          if (id.includes('recharts')) return 'recharts'
          if (id.includes('xlsx')) return 'xlsx'
        },
      },
    },
  },
})
