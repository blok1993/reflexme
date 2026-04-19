# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: device-id.spec.ts >> Device ID — anonymous session >> reuses the same device ID across page reloads
- Location: e2e/device-id.spec.ts:25:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e8]:
      - heading "ReflexMe" [level=1] [ref=e10]
      - paragraph [ref=e11]: Утром — прогноз. Вечером — проверка.
      - paragraph [ref=e12]: Не гороскоп. Не магия. Что-то точнее.
    - button "Дальше" [ref=e18] [cursor=pointer]
```

# Test source

```ts
  1  | /**
  2  |  * Device ID (anonymous session) tests.
  3  |  * Verifies that:
  4  |  * - A device ID is generated and persisted across page reloads
  5  |  * - A new device gets its own user (goes to onboarding)
  6  |  * - A known device with completed onboarding skips onboarding
  7  |  * - The X-Device-ID header is sent with every API request
  8  |  */
  9  | import { test, expect } from '@playwright/test';
  10 | import { setupMocks } from './helpers/mocks';
  11 | import { makeStatus } from './helpers/data';
  12 | 
  13 | const VALID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  14 | 
  15 | test.describe('Device ID — anonymous session', () => {
  16 |   test('generates a valid UUID v4 on first visit', async ({ page }) => {
  17 |     await setupMocks(page, { user: 'new' });
  18 |     await page.goto('/onboarding');
  19 | 
  20 |     const deviceId = await page.evaluate(() => localStorage.getItem('predictor_device_id'));
  21 |     expect(deviceId).not.toBeNull();
  22 |     expect(deviceId).toMatch(VALID_UUID_RE);
  23 |   });
  24 | 
  25 |   test('reuses the same device ID across page reloads', async ({ page }) => {
  26 |     await setupMocks(page, { user: 'new' });
  27 |     await page.goto('/onboarding');
  28 | 
  29 |     const firstId = await page.evaluate(() => localStorage.getItem('predictor_device_id'));
  30 | 
  31 |     // Reload the page
  32 |     await setupMocks(page, { user: 'new' });
  33 |     await page.reload();
> 34 |     await page.waitForLoadState('networkidle');
     |                ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  35 | 
  36 |     const secondId = await page.evaluate(() => localStorage.getItem('predictor_device_id'));
  37 |     expect(firstId).toBe(secondId);
  38 |   });
  39 | 
  40 |   test('X-Device-ID header is sent with API requests', async ({ page }) => {
  41 |     const capturedHeaders: string[] = [];
  42 | 
  43 |     await page.route('**/api/v1/users/me', async (route) => {
  44 |       const headers = route.request().headers();
  45 |       if (headers['x-device-id']) {
  46 |         capturedHeaders.push(headers['x-device-id']);
  47 |       }
  48 |       await route.fulfill({
  49 |         status: 200,
  50 |         body: JSON.stringify({
  51 |           success: true,
  52 |           data: {
  53 |             user: {
  54 |               id: 'u1', deviceId: 'some-id', name: null, gender: null, birthDate: null,
  55 |               preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: false,
  56 |               eveningReminderTime: null, notificationsEnabled: false,
  57 |               createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  58 |             },
  59 |           },
  60 |         }),
  61 |       });
  62 |     });
  63 | 
  64 |     await page.route('**/api/v1/daily-status**', async (route) => {
  65 |       await route.fulfill({
  66 |         status: 200,
  67 |         body: JSON.stringify({ success: true, data: makeStatus('checkin_missing') }),
  68 |       });
  69 |     });
  70 | 
  71 |     await page.goto('/');
  72 |     // Wait for API call
  73 |     await page.waitForTimeout(1000);
  74 | 
  75 |     expect(capturedHeaders.length).toBeGreaterThan(0);
  76 |     expect(capturedHeaders[0]).toMatch(VALID_UUID_RE);
  77 |   });
  78 | 
  79 |   test('new device (no localStorage) → goes to onboarding', async ({ page }) => {
  80 |     await setupMocks(page, { user: 'new' });
  81 |     await page.goto('/');
  82 |     await expect(page.locator('[data-testid="onboarding-page"]')).toBeVisible({ timeout: 5000 });
  83 |   });
  84 | 
  85 |   test('known device with completed onboarding → skips onboarding', async ({ page }) => {
  86 |     await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
  87 |     await page.goto('/');
  88 |     await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  89 |     await expect(page.locator('[data-testid="onboarding-page"]')).not.toBeVisible();
  90 |   });
  91 | 
  92 |   test('known device navigating to /onboarding after completion → redirected away', async ({ page }) => {
  93 |     await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
  94 |     await page.goto('/onboarding');
  95 |     // Guard should redirect to checkin
  96 |     await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  97 |   });
  98 | });
  99 | 
```