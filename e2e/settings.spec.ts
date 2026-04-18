/**
 * Settings / Profile page tests.
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';

test.describe('Settings Page', () => {
  test('shows profile page with name field', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Как тебя зовут?')).toBeVisible();
  });

  test('shows tone selection options', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/settings');

    await expect(page.getByText('Тон общения')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Мягко')).toBeVisible();
    await expect(page.getByText('Нейтрально')).toBeVisible();
    await expect(page.getByText('Прямо')).toBeVisible();
  });

  test('can type a name and save it', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });

    let savedName = '';
    await page.route('**/api/v1/users/me', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() ?? {};
        savedName = body.name ?? '';
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { user: { id: 'u1', name: savedName, preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: true, eveningReminderTime: null, notificationsEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { user: { id: 'u1', name: null, preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: true, eveningReminderTime: null, notificationsEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
          }),
        });
      }
    });

    await page.goto('/settings');

    await page.getByPlaceholder('Как тебя зовут?').fill('Иван');
    await page.getByText('Сохранить').click();

    expect(savedName).toBe('Иван');
  });

  test('can change tone setting', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });

    let savedTone = '';
    await page.route('**/api/v1/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() ?? {};
        savedTone = body.preferredTone ?? '';
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { settings: { preferredTone: savedTone, eveningReminderTime: null, notificationsEnabled: false } },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/settings');

    // Click "Прямо" tone
    await page.getByText('Прямо').click();

    expect(savedTone).toBe('sharp');
  });

  test('shows app version', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/settings');

    await expect(page.getByText('ReflexMe 1.0.0')).toBeVisible({ timeout: 5000 });
  });

  test('shows privacy disclaimer', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/settings');

    await expect(page.getByText(/Все данные хранятся локально/)).toBeVisible({ timeout: 5000 });
  });
});
