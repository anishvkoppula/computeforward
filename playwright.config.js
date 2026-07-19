import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3217',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'PORT=3217 PUBLIC_ORIGIN=http://127.0.0.1:3217 DATA_DIR=/private/tmp/computeforward-e2e DATABASE_URL= ADMIN_TOKEN=e2e-admin-token-that-is-longer-than-thirty-two-characters npm start',
    url: 'http://127.0.0.1:3217/healthz',
    reuseExistingServer: false,
    timeout: 30_000
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
  ]
});
