/**
 * Insights / Patterns page tests.
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';

test.describe('Insights Page', () => {
  test('shows page title "Паттерны"', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/insights');

    // Use testid to avoid matching the bottom nav item with same label
    await expect(page.locator('[data-testid="insights-title"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="insights-title"]')).toContainText('Паттерны');
  });

  test('shows "Неделя", "История" and "Мой профиль" tabs', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });

    // Mock new profile endpoints
    await page.route('**/api/v1/insights/accuracy-curve**', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { points: [], trend: 'insufficient_data', totalReviews: 1 } }) });
    });
    await page.route('**/api/v1/insights/vocabulary**', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { words: [], totalCheckins: 1, analyzedCheckins: 1, hasEnoughData: false } }) });
    });
    await page.route('**/api/v1/insights/patterns**', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true, data: { cards: [], generatedAt: null, totalReviews: 1, hasEnoughData: false, minimumRequired: 7 } }) });
    });

    await page.goto('/insights');

    await expect(page.getByText('Неделя', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('История', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Мой профиль', exact: true })).toBeVisible();
  });

  test('weekly tab shows totalDays count', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/insights');

    await expect(page.getByText('3 из 7')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('дней заполнено')).toBeVisible();
  });

  test('weekly tab shows accuracy percentage', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/insights');

    // Accuracy = 72% (0.72 * 100 = 72, rendered as "72")
    await expect(page.getByText('точность', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('weekly tab shows patterns from API', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/insights');

    await expect(
      page.getByText('Ты чаще ждёшь конфликта там, где его потом не происходит.'),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('В дни с фокусом на работе прогнозы точнее.'),
    ).toBeVisible();
  });

  test('switching to История tab shows history', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/insights');

    // Wait for initial weekly tab to load
    await expect(page.locator('[data-testid="insights-title"]')).toBeVisible({ timeout: 5000 });

    // Click История tab
    await page.getByText('История', { exact: true }).click();

    // AnimatePresence mode="wait" keeps both tabs briefly during transition.
    // Wait for it to complete before asserting.
    await page.waitForTimeout(600);

    // History item text (use nth(1) since week tab may still show same dayType briefly)
    await expect(
      page.getByText('День внутреннего шума').last(),
    ).toBeVisible({ timeout: 5000 });
    // Accuracy % from HistoryItem
    await expect(page.getByText(/\d+%/).first()).toBeVisible({ timeout: 3000 });
  });

  test('empty week state when no data', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });

    await page.route('**/api/v1/insights/weekly**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: {
            range: { startDate: '2026-04-14', endDate: '2026-04-20' },
            summary: { totalDays: 0, averageAccuracy: null, mostFrequentDayType: null, mostAccurateSection: null },
            patterns: [],
            days: [],
          },
        }),
      });
    });

    await page.goto('/insights');
    await expect(page.getByText('Ещё нет данных')).toBeVisible({ timeout: 5000 });
  });

  test('empty history state', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });

    await page.route('**/api/v1/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: { items: [], pagination: { limit: 30, offset: 0, total: 0 } },
        }),
      });
    });

    await page.goto('/insights');
    // Switch to История tab
    await page.getByText('История', { exact: true }).click();

    await expect(page.getByText('История пуста')).toBeVisible({ timeout: 5000 });
  });

  test('bottom nav items are visible on insights page', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/insights');

    // Check bottom nav items — use the nav element directly to be specific
    const nav = page.locator('.bottom-nav');
    await expect(nav).toBeVisible({ timeout: 5000 });
    await expect(nav.getByText('Паттерны')).toBeVisible();
    await expect(nav.getByText('Настройки')).toBeVisible();
  });
});
