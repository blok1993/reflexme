/**
 * Prediction screen tests.
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { PREDICTION, makeStatus } from './helpers/data';

test.describe('Prediction Page', () => {
  test('shows all 3 prediction cards', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await expect(page.locator('[data-testid="prediction-card-likelyEvent"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="prediction-card-strengthPoint"]')).toBeVisible();
    await expect(page.locator('[data-testid="prediction-card-trapWarning"]')).toBeVisible();
  });

  test('displays day type in heading', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await expect(page.locator('[data-testid="day-type"]')).toContainText(PREDICTION.dayType, { timeout: 5000 });
  });

  test('prediction card texts are shown', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await expect(page.getByText('Сегодня тебя будет задевать')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Лучше всего сработаешь')).toBeVisible();
    await expect(page.getByText('Не принимай утреннюю усталость')).toBeVisible();
  });

  test('shows accuracy badge', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    // Wait for prediction to load first
    await expect(page.locator('[data-testid="prediction-page"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="day-type"]')).toBeVisible({ timeout: 3000 });

    // AccuracyBadge: with no accuracy-curve data or < 7 reviews → "Точность копится"
    await expect(page.getByText('Точность копится', { exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('shows "come back tonight" note in the morning', async ({ page }) => {
    await page.addInitScript(() => {
      const OriginalDate = Date;
      class MockDate extends OriginalDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) {
            super(new OriginalDate().toISOString().slice(0, 10) + 'T10:00:00.000Z');
          } else {
            super(...args);
          }
        }
        getHours() {
          return 10;
        }
      }
      // @ts-expect-error — test shim
      globalThis.Date = MockDate;
    });

    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await expect(page.locator('[data-testid="prediction-page"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Вечером подведём итоги дня/)).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="go-to-review-btn"]')).not.toBeVisible();
  });

  test('shows review button in the evening', async ({ page }) => {
    await page.addInitScript(() => {
      const Orig = Date;
      class MockDate extends Orig { getHours() { return 19; } }
      // @ts-ignore
      globalThis.Date = MockDate;
    });

    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await expect(page.locator('[data-testid="prediction-page"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="go-to-review-btn"]')).toBeVisible({ timeout: 3000 });
  });

  test('clicking review button navigates to /review', async ({ page }) => {
    await page.addInitScript(() => {
      const Orig = Date;
      class MockDate extends Orig { getHours() { return 19; } }
      // @ts-ignore
      globalThis.Date = MockDate;
    });

    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await page.locator('[data-testid="go-to-review-btn"]').click();
    await expect(page).toHaveURL(/\/review/, { timeout: 3000 });
  });

  test('shows "День закрыт" when review is completed', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/prediction');

    await expect(page.locator('[data-testid="day-closed-badge"]')).toBeVisible({ timeout: 5000 });
  });

  test('share button exists and is clickable', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.resolve() },
        writable: true,
        configurable: true,
      });
    });

    await expect(page.locator('[data-testid="share-btn"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="share-btn"]').click();
  });

  test('generates prediction when checkin exists but no prediction yet', async ({ page }) => {
    let generateCalled = false;

    // prediction_generating: checkin exists but prediction hasn't been generated
    // setupMocks returns predictionExists=false and 404 for by-date
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_generating' });

    // Track the generate call
    await page.route('**/api/v1/predictions/generate', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      generateCalled = true;
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }),
      });
    });

    // predictions/by-date: return 404 BEFORE generate, PREDICTION after
    await page.route('**/api/v1/predictions/by-date**', async (route) => {
      if (generateCalled) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }),
        });
      } else {
        await route.fulfill({
          status: 404,
          body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }),
        });
      }
    });

    await page.goto('/prediction');

    // Wait for prediction to appear — generate must have been called first
    await expect(page.locator('[data-testid="day-type"]')).toContainText(PREDICTION.dayType, { timeout: 10000 });
    expect(generateCalled).toBe(true);
  });

  test('shows error state when generation fails', async ({ page }) => {
    await setupMocks(page, {
      user: 'onboarded',
      dailyStatus: 'prediction_generating',
      generateError: true,
    });

    // prediction/by-date returns 404 (prediction doesn't exist)
    await page.route('**/api/v1/predictions/by-date**', async (route) => {
      await route.fulfill({
        status: 404,
        body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Prediction not found' } }),
      });
    });

    await page.goto('/prediction');

    await expect(page.locator('[data-testid="prediction-not-found"]')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Не удалось получить прогноз/)).toBeVisible();
  });

  test('"Попробовать ещё раз" button appears when generation fails', async ({ page }) => {
    await setupMocks(page, {
      user: 'onboarded',
      dailyStatus: 'prediction_generating',
      generateError: true,
    });

    await page.route('**/api/v1/predictions/by-date**', async (route) => {
      await route.fulfill({
        status: 404,
        body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }),
      });
    });

    await page.goto('/prediction');

    await expect(page.locator('[data-testid="retry-generate-btn"]')).toBeVisible({ timeout: 8000 });
  });

  test('retry button triggers new generation attempt', async ({ page }) => {
    let generateCallCount = 0;

    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_generating' });

    // First call fails, second succeeds
    await page.route('**/api/v1/predictions/generate', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      generateCallCount++;
      if (generateCallCount === 1) {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ success: false, error: { code: 'GENERATION_FAILED', message: 'Failed' } }),
        });
      } else {
        await route.fulfill({
          status: 201,
          body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }),
        });
      }
    });

    let predCallCount = 0;
    await page.route('**/api/v1/predictions/by-date**', async (route) => {
      predCallCount++;
      if (generateCallCount >= 2) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { prediction: PREDICTION } }),
        });
      } else {
        await route.fulfill({
          status: 404,
          body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }),
        });
      }
    });

    await page.goto('/prediction');

    // Retry button should appear after first failure
    await expect(page.locator('[data-testid="retry-generate-btn"]')).toBeVisible({ timeout: 8000 });
    await page.locator('[data-testid="retry-generate-btn"]').click();

    // Should now show the prediction
    await expect(page.locator('[data-testid="day-type"]')).toContainText(PREDICTION.dayType, { timeout: 8000 });
    expect(generateCallCount).toBe(2);
  });

  test('redirects to /checkin when no checkin exists', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/prediction');

    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  });
});
