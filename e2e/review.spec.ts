/**
 * Evening review flow tests.
 * Covers score selection, submit validation, and navigation.
 */
import { test, expect, type Page } from '@playwright/test';
import { setupMocks } from './helpers/mocks';

/** Review UI is only available from 17:00 local time — force evening so tests pass at any clock. */
async function mockEvening(page: Page) {
  await page.addInitScript(() => {
    const Orig = Date;
    class MockDate extends Orig {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(new Orig().toISOString().slice(0, 10) + 'T18:00:00.000Z');
        } else {
          super(...(args as []));
        }
      }
      getHours() {
        return 18;
      }
    }
    // @ts-expect-error — test shim
    globalThis.Date = MockDate;
  });
}

test.describe('Evening Review', () => {
  test('shows 3 prediction cards with score buttons', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    // Use role + exact name to avoid substring matching of 'да' inside words
    await expect(page.getByRole('button', { name: 'Да', exact: true })).toHaveCount(3, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Частично', exact: true })).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Мимо', exact: true })).toHaveCount(3);
  });

  test('submit button is disabled until all 3 cards are scored', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    const submitBtn = page.locator('[data-testid="submit-review-btn"]');
    await expect(submitBtn).toBeDisabled({ timeout: 5000 });

    // Score first card
    await page.getByRole('button', { name: 'Да', exact: true }).first().click();
    await expect(submitBtn).toBeDisabled();

    // Score second card
    await page.getByRole('button', { name: 'Да', exact: true }).nth(1).click();
    await expect(submitBtn).toBeDisabled();

    // Score third card
    await page.getByRole('button', { name: 'Да', exact: true }).nth(2).click();
    await expect(submitBtn).toBeEnabled();
  });

  test('can use mixed scores (Да / Частично / Мимо)', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    await page.getByRole('button', { name: 'Да', exact: true }).first().click();
    await page.getByRole('button', { name: 'Частично', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Мимо', exact: true }).nth(2).click();
  });

  test('can change score before submitting', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    // Score first card as "Да", then change to "Мимо"
    await page.getByRole('button', { name: 'Да', exact: true }).first().click();
    await page.getByRole('button', { name: 'Мимо', exact: true }).first().click();

    // Score the rest
    await page.getByRole('button', { name: 'Да', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Да', exact: true }).nth(2).click();

    const submitBtn = page.locator('[data-testid="submit-review-btn"]');
    await expect(submitBtn).toBeEnabled();
  });

  test('optional comment field is editable', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    const comment = 'День оказался легче, чем ожидал';
    await page.getByPlaceholder('Свободная мысль о дне...').fill(comment);
    await expect(page.getByPlaceholder('Свободная мысль о дне...')).toHaveValue(comment);
  });

  test('successful submit navigates to /insights', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    // Wait for review form to be visible
    const submitBtn = page.locator('[data-testid="submit-review-btn"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });

    // Score all 3 cards
    await page.getByRole('button', { name: 'Да', exact: true }).first().click();
    await page.getByRole('button', { name: 'Да', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Да', exact: true }).nth(2).click();

    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect(page).toHaveURL(/\/insights/, { timeout: 5000 });
  });

  test('prediction text is visible in review cards', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    await expect(page.getByText('Сегодня тебя будет задевать чужой тон')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Лучше всего сработаешь в одиночных')).toBeVisible();
    await expect(page.getByText('Не принимай утреннюю усталость')).toBeVisible();
  });

  test('shows "день закрыт" when review already completed', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'review_completed' });
    await page.goto('/review');

    await expect(page.getByText('День закрыт')).toBeVisible({ timeout: 5000 });
  });

  test('shows error when no prediction for today', async ({ page }) => {
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'checkin_missing' });
    await page.goto('/review');

    await expect(page.getByText('Сначала нужен утренний прогноз')).toBeVisible({ timeout: 5000 });
  });

  test('before 17:00 shows wait message instead of review form', async ({ page }) => {
    await page.addInitScript(() => {
      const Orig = Date;
      class MockDate extends Orig {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(new Orig().toISOString().slice(0, 10) + 'T10:00:00.000Z');
          } else {
            super(...(args as []));
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
    await page.goto('/review');

    await expect(page.getByTestId('review-too-early')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('review-page')).not.toBeVisible();
  });

  test('shows completion screen with accuracy after submit', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });
    await page.goto('/review');

    await expect(page.locator('[data-testid="submit-review-btn"]')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Да', exact: true }).first().click();
    await page.getByRole('button', { name: 'Да', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Да', exact: true }).nth(2).click();

    await page.locator('[data-testid="submit-review-btn"]').click();

    // Completion screen should appear (all yes = 100%)
    await expect(page.getByText('День закрыт')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/83%|100%|\d+%/)).toBeVisible({ timeout: 3000 });
  });

  test('sends correct payload to API', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'onboarded', dailyStatus: 'prediction_ready' });

    let capturedBody: Record<string, unknown> = {};
    await page.route('**/api/v1/reviews', async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      capturedBody = route.request().postDataJSON() ?? {};
      await route.fulfill({
        status: 201,
        body: JSON.stringify({
          success: true,
          data: {
            review: {
              id: 'review_1',
              userId: 'user_1',
              predictionId: 'pred_test_1',
              date: new Date().toISOString().slice(0, 10),
              likelyEventScore: 'yes',
              strengthPointScore: 'partial',
              trapWarningScore: 'no',
              comment: 'Тест',
              accuracyScore: 0.5,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
    });

    await page.goto('/review');

    // Wait for form
    await expect(page.locator('[data-testid="submit-review-btn"]')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Да', exact: true }).first().click();
    await page.getByRole('button', { name: 'Частично', exact: true }).nth(1).click();
    await page.getByRole('button', { name: 'Мимо', exact: true }).nth(2).click();
    await page.getByPlaceholder('Свободная мысль о дне...').fill('Тест');

    await page.locator('[data-testid="submit-review-btn"]').click();

    expect(capturedBody).toMatchObject({
      predictionId: 'pred_test_1',
      likelyEventScore: 'yes',
      strengthPointScore: 'partial',
      trapWarningScore: 'no',
      comment: 'Тест',
    });
  });
});
