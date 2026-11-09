import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests: real browser -> React app -> Flask API -> trained models -> SQLite.
 *
 * Playwright starts both servers itself:
 *   - API on :5001 with a fresh, seeded database (backend/scripts/e2e_server.py)
 *   - Vite dev server on :5174, proxying /api to :5001
 *
 * Set E2E_PYTHON to the Python interpreter that has the backend installed,
 * e.g. ../.venv/Scripts/python.exe on Windows (defaults to `python`).
 */
const python = process.env.E2E_PYTHON ?? 'python'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // tests share one seeded database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `"${python}" ../backend/scripts/e2e_server.py`,
      url: 'http://127.0.0.1:5001/api/health',
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'ignore',
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { VITE_PROXY_TARGET: 'http://127.0.0.1:5001' },
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
