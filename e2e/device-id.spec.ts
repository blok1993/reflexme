/**
 * Device ID (anonymous session) tests.
 * Verifies that:
 * - A device ID is generated and persisted across page reloads
 * - A new device gets its own user (goes to onboarding)
 * - A known device with completed onboarding skips onboarding
 * - The X-Device-ID header is sent with every API request
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { makeStatus } from './helpers/data';

const VALID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe('Device ID — anonymous session', () => {
  test('generates a valid UUID v4 on first visit', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    const deviceId = await page.evaluate(() => localStorage.getItem('predictor_device_id'));
    expect(deviceId).not.toBeNull();
    expect(deviceId).toMatch(VALID_UUID_RE);
  });

  test('reuses the same device ID across page reloads', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    const firstId = await page.evaluate(() => localStorage.getItem('predictor_device_id'));

    // Reload the page
    await setupMocks(page, { user: 'new' });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const secondId = await page.evaluate(() => localStorage.getItem('predictor_device_id'));
    expect(firstId).toBe(secondId);
  });

  test('X-Device-ID header is sent with API requests', async ({ page }) => {
    const capturedHeaders: string[] = [];

    await page.route('**/api/v1/users/me', async (route) => {
      const headers = route.request().headers();
      if (headers['x-device-id']) {
        capturedHeaders.push(headers['x-device-id']);
      }
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'u1', deviceId: 'some-id', name: null, gender: null, birthDate: null,
              preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: false,
              eveningReminderTime: null, notificationsEnabled: false,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
    });

    await page.route('**/api/v1/daily-status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: makeStatus('checkin_missing') }),
      });
    });

    await page.goto('/');
    // Wait for API call
    await page.waitForTimeout(1000);

    expect(capturedHeaders.length).toBeGreaterThan(0);
    expect(capturedHeaders[0]).toMatch(VALID_UUID_RE);
  });

  test('new device (no localStorage) → goes to onboarding', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding-page"]')).toBeVisible({ timeout: 5000 });
  });

  test('known device with completed onboarding → skips onboarding', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/');
    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="onboarding-page"]')).not.toBeVisible();
  });

  test('known device navigating to /onboarding after completion → redirected away', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/onboarding');
    // Guard should redirect to checkin
    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  });
});
