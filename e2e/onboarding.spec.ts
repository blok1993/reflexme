/**
 * Onboarding flow tests.
 */
import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mocks';

test.describe('Onboarding', () => {
  test('new user sees onboarding on first visit', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding-page"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ReflexMe')).toBeVisible();
  });

  test('shows welcome screen as step 1', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');
    await expect(page.getByText('Утром — прогноз.')).toBeVisible();
    await expect(page.getByText('Не гороскоп')).toBeVisible();
  });

  test('step 2 explains how it works', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await expect(page.getByText('Как это работает')).toBeVisible();
    await expect(page.getByText('Утром')).toBeVisible();
    await expect(page.getByText('Три карточки')).toBeVisible();
    await expect(page.getByText('Вечером')).toBeVisible();
  });

  test('step 3 shows tone selection', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    // Step 1 → 2
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    // Step 2 → 3
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await expect(page.getByText('Немного о тебе')).toBeVisible();
    await expect(page.getByText('Мягко')).toBeVisible();
    await expect(page.getByText('Нейтрально')).toBeVisible();
    await expect(page.getByText('Прямо')).toBeVisible();
  });

  test('can select different tone options', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    // Click "Прямо"
    await page.getByText('Прямо').click();
    // Click "Мягко"
    await page.getByText('Мягко').click();
  });

  test('completing onboarding redirects to checkin', async ({ page }) => {
    await setupMocks(page, { user: 'new', dailyStatus: 'checkin_missing' });
    await page.goto('/onboarding');

    // Navigate through all 3 steps
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await page.locator('[data-testid="gender-option-male"]').click();

    // Step 3: click "Начать" (пол обязателен)
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await expect(page.locator('[data-testid="checkin-page"]')).toBeVisible({ timeout: 5000 });
  });

  test('step 3 shows gender selection', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await expect(page.locator('[data-testid="gender-option-male"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="gender-option-female"]')).toBeVisible();
  });

  test('can select gender', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await page.locator('[data-testid="gender-option-female"]').click();
    await page.locator('[data-testid="gender-option-male"]').click();
  });

  test('step 3 shows birthday input', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await expect(page.locator('[data-testid="birthday-input"]')).toBeVisible({ timeout: 3000 });
  });

  test('saves gender and birthday on completion', async ({ page }) => {
    await setupMocks(page, { user: 'new', dailyStatus: 'checkin_missing' });

    let savedData: Record<string, unknown> = {};
    await page.route('**/api/v1/users/me', async (route) => {
      if (route.request().method() === 'POST') {
        savedData = route.request().postDataJSON() ?? {};
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { user: { id: 'u1', deviceId: 'x', name: null, gender: 'female', birthDate: '1995-03-20', preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: true, eveningReminderTime: null, notificationsEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: { user: { id: 'u1', deviceId: 'x', name: null, gender: null, birthDate: null, preferredTone: 'neutral', timezone: 'UTC', onboardingCompleted: false, eveningReminderTime: null, notificationsEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } }),
        });
      }
    });

    await page.goto('/onboarding');

    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    await page.locator('[data-testid="gender-option-female"]').click();
    await page.locator('[data-testid="birthday-input"]').fill('1995-03-20');
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    expect(savedData).toMatchObject({ gender: 'female', birthDate: '1995-03-20', onboardingCompleted: true });
  });

  test('progress bar advances through steps', async ({ page }) => {
    await setupMocks(page, { user: 'new' });
    await page.goto('/onboarding');

    // Step 1 of 3
    const progressBars = page.locator('.h-1.flex-1');
    await expect(progressBars).toHaveCount(3);

    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    // On last step, "Начать →" text appears
    await expect(page.locator('[data-testid="onboarding-next-btn"]')).toContainText('Начать');
  });
});
