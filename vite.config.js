import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
