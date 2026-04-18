/**
 * Morning check-in flow tests.
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { makeStatus, PREDICTION, CHECKIN, ONBOARDED_USER } from './helpers/data';

test.describe('Morning Check-in', () => {
  test('shows check-in form for onboarded user', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/checkin');

    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="mood-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="focus-section"]')).toBeVisible();
  });

  test('submit button is disabled until mood and focus are selected', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/checkin');

    const btn = page.locator('[data-testid="submit-checkin-btn"]');
    await expect(btn).toBeDisabled();

    // Select mood only — still disabled
    await page.locator('[data-testid="mood-option-3"]').click();
    await expect(btn).toBeDisabled();

    // Select focus — now enabled
    await page.locator('[data-testid="focus-option-work"]').click();
    await expect(btn).toBeEnabled();
  });

  test('all 5 mood options are clickable', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/checkin');

    for (const mood of [1, 2, 3, 4, 5]) {
      await page.locator(`[data-testid="mood-option-${mood}"]`).click();
    }
  });

  test('all 8 focus options are clickable', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/checkin');

    for (const focus of [
      'work',
      'people',
      'energy',
      'emotions',
      'tension',
      'control',
      'rest',
      'self_focus',
    ]) {
      await page.locator(`[data-testid="focus-option-${focus}"]`).click();
    }
  });

  test('context textarea accepts text up to 300 chars', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/checkin');

    const textarea = page.locator('[data-testid="context-input"]');
    const text = 'Тестовый контекст дня';
    await textarea.fill(text);
    await expect(textarea).toHaveValue(text);
    await expect(page.getByText(`${text.length}/300`)).toBeVisible();
  });

  test('successful submit navigates to /prediction', async ({ page }) => {
    // Register ALL routes BEFORE page.goto to avoid race conditions.
    // Use state variable: before submit daily-status returns checkin_missing,
    // after submit returns prediction_generating so prediction page can load.
    let submitDone = false;

    await page.route('**/api/v1/daily-status**', async (route) => {
      const data = submitDone ? makeStatus('prediction_generating') : makeStatus('checkin_missing');
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data }) });
    });

    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: { user: ONBOARDED_USER } }),
      });
    });

    await page.route('**/api/v1/checkins', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      submitDone = true;
      await route.fulfill({ status: 201, body: JSON.stringify({ success: true, data: { checkin: CHECKIN } }) });
    });

    await page.route('**/api/v1/predictions/generate', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({ status: 201, body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }) });
    });

    await page.route('**/api/v1/predictions/by-date**', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }) });
    });

    await page.goto('/checkin');
    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="mood-option-4"]').click();
    await page.locator('[data-testid="focus-option-work"]').click();
    await page.locator('[data-testid="context-input"]').fill('Хороший день');
    await page.locator('[data-testid="submit-checkin-btn"]').click();

    await expect(page).toHaveURL(/\/prediction/, { timeout: 8000 });
  });

  test('already checked in today → redirects to /prediction', async ({ page }) => {
    // Status says prediction_ready (checkin already done)
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/checkin');

    // Should immediately redirect
    await expect(page.locator('[data-testid="prediction-page"]')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/prediction/);
  });

  test('409 checkin error → still navigates to /prediction', async ({ page }) => {
    // Checkin page shows (status = checkin_missing for initial check)
    // But checkin API returns 409 (already exists)
    // Prediction already exists, so prediction page should show

    let statusCallCount = 0;
    await page.route('**/api/v1/daily-status**', async (route) => {
      statusCallCount++;
      // First 2 calls (checkin page load): return checkin_missing so form shows
      // Subsequent calls (prediction page load): return prediction_ready
      const status = statusCallCount <= 2 ? 'checkin_missing' : 'prediction_ready';
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: makeStatus(status) }),
      });
    });

    // Checkin API returns 409
    await page.route('**/api/v1/checkins', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      await route.fulfill({
        status: 409,
        body: JSON.stringify({ success: false, error: { code: 'CHECKIN_ALREADY_EXISTS', message: 'Check-in for this date already exists' } }),
      });
    });

    // Prediction is available
    await page.route('**/api/v1/predictions/by-date**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }),
      });
    });

    await page.route('**/api/v1/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { user: { id: 'u1', name: null, preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: true, eveningReminderTime: null, notificationsEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/checkin');

    // Wait for form to be visible
    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="mood-option-3"]').click();
    await page.locator('[data-testid="focus-option-work"]').click();
    await page.locator('[data-testid="submit-checkin-btn"]').click();

    // Should redirect to prediction despite 409
    await expect(page).toHaveURL(/\/prediction/, { timeout: 5000 });
  });

  test('greets user by name if name is set', async ({ page }) => {
    // Use setupMocks then override just the user route
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });

    // Override user with a named one (registered AFTER setupMocks → takes priority)
    await page.route('**/api/v1/users/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: 'user_test_1',
                name: 'Алекс',
                preferredTone: 'neutral',
                timezone: 'UTC',
                onboardingCompleted: true,
                eveningReminderTime: null,
                notificationsEnabled: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { user: { id: 'u1', name: 'Алекс', preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: true, eveningReminderTime: null, notificationsEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } }),
        });
      }
    });

    await page.goto('/checkin');
    await expect(page.getByText(/Алекс/)).toBeVisible({ timeout: 5000 });
  });
});
