/**
 * Smart redirect logic tests.
 * Verifies that the app routes users to the correct screen
 * based on daily status and user state.
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';

test.describe('Smart redirect from "/"', () => {
  test('new user → /onboarding', async ({ page }) => {
    await setupMocks(page, { user: 'new', dailyStatus: 'checkin_missing' });
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding-page"]')).toBeVisible({ timeout: 5000 });
  });

  test('onboarded user with no checkin → /checkin', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/');
    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  });

  test('prediction_ready + morning → /prediction', async ({ page }) => {
    // Force morning time by overriding Date (before 17:00)
    await page.addInitScript(() => {
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) {
            // Return a fixed morning time
            super(new OriginalDate().toISOString().slice(0, 10) + 'T10:00:00.000Z');
          } else {
            super(...args);
          }
        }
        getHours() { return 10; }
      }
      // @ts-ignore
      globalThis.Date = MockDate;
    });

    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/');
    await expect(page.locator('[data-testid="prediction-page"]')).toBeVisible({ timeout: 5000 });
  });

  test('review_completed → /insights', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/');
    await expect(page.locator('[data-testid="insights-title"]')).toBeVisible({ timeout: 5000 });
  });

  test('unknown route → redirect to /', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/nonexistent-route');
    // Should end up somewhere known (checkin in this case)
    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  });

  test('navigating directly to /checkin when already checked in → /prediction', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/checkin');
    // Should redirect to prediction because status !== checkin_missing
    await expect(page.locator('[data-testid="prediction-page"]')).toBeVisible({ timeout: 5000 });
  });
});
