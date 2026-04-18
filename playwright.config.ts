import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    // Mobile-sized viewport (iPhone-like) using Chromium
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
  },

  projects: [
    { name: 'mobile-chrome', use: { browserName: 'chromium' } },
  ],

  webServer: {
    command: 'npm run dev -w @predictor/frontend',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
