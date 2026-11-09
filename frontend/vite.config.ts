/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    port: 5173,
    // Forward API calls to the Flask backend (the E2E tests point this at a separate server)
    proxy: { '/api': process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:5000' },
  },
  build: {
    // main bundle is ~200 kB gzipped; Recharts is split into its own lazy chunk
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'], // e2e/ is run by Playwright
  },
})
