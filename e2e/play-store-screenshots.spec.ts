/**
 * Generates PNG screenshots for Google Play (upload from predictor/play-store-screenshots/).
 * Run from repo root: cd predictor && npx playwright test e2e/play-store-screenshots.spec.ts
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { setupMocks } from './helpers/mocks';
import { TODAY } from './helpers/data';

const OUT_DIR = path.join(process.cwd(), 'play-store-screenshots');

async function mockMorning(page: Page) {
  await page.addInitScript(() => {
    const Orig = Date;
    class MockDate extends Orig {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(new Orig().toISOString().slice(0, 10) + 'T10:30:00.000Z');
        } else {
          super(...(args as []));
        }
      }
      getHours() {
        return 10;
      }
    }
    // @ts-expect-error — test shim for screenshot time gate
    globalThis.Date = MockDate;
  });
}

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
    // @ts-expect-error — test shim for screenshot time gate
    globalThis.Date = MockDate;
  });
}

function subtractDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

function json(data: unknown) {
  return { status: 200, body: JSON.stringify({ success: true, data }) };
}

async function routeRichProfileInsights(page: Page) {
  const points = [6, 5, 4, 3, 2, 1, 0].map((ago) => ({
    date: subtractDays(TODAY, ago),
    accuracy: Math.min(0.92, 0.52 + (6 - ago) * 0.06),
  }));

  await page.route('**/api/v1/insights/accuracy-curve**', async (route) => {
    await route.fulfill(
      json({
        points,
        trend: 'improving' as const,
        totalReviews: 14,
      }),
    );
  });

  await page.route('**/api/v1/insights/vocabulary**', async (route) => {
    await route.fulfill(
      json({
        words: [
          { word: 'усталость', count: 8 },
          { word: 'разговор', count: 6 },
          { word: 'работа', count: 5 },
          { word: 'семья', count: 4 },
        ],
        totalCheckins: 14,
        analyzedCheckins: 14,
        hasEnoughData: true,
      }),
    );
  });

  await page.route('**/api/v1/insights/patterns**', async (route) => {
    await route.fulfill(
      json({
        cards: [
          {
            id: '1',
            title: 'Когда ждёшь конфликт',
            insight: 'В такие дни чаще всего совпадает предупреждение про «тон» — это твой триггер.',
            category: 'trigger' as const,
            highlight: 'тон',
          },
          {
            id: '2',
            title: 'Фокус «работа»',
            insight: 'Точность прогнозов в рабочие дни выше среднего.',
            category: 'focus' as const,
          },
        ],
        generatedAt: `${TODAY}T12:00:00.000Z`,
        totalReviews: 14,
        hasEnoughData: true,
        minimumRequired: 7,
      }),
    );
  });
}

test.describe('Play Store screenshots', () => {
  test.use({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
  });

  test.beforeAll(async () => {
    await fs.mkdir(OUT_DIR, { recursive: true });
  });

  test('01 — onboarding welcome', async ({ page }) => {
    await setupMocks(page, { user: 'new', dailyStatus: 'checkin_missing' });
    await page.goto('/onboarding');
    await page.getByTestId('onboarding-page').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT_DIR, '01-onboarding-welcome.png') });
  });

  test('02 — how it works', async ({ page }) => {
    await setupMocks(page, { user: 'new', dailyStatus: 'checkin_missing' });
    await page.goto('/onboarding');
    await page.getByTestId('onboarding-next-btn').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '02-onboarding-how.png') });
  });

  test('03 — morning check-in', async ({ page }) => {
    await mockMorning(page);
    await setupMocks(page, { user: 'named', dailyStatus: 'checkin_missing' });
    await page.goto('/checkin');
    await page.getByTestId('checkin-page').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByTestId('mood-option-4').click();
    await page.getByTestId('focus-option-work').click();
    await page.getByTestId('context-input').fill('Важная встреча днём, немного не выспался.');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '03-checkin.png'), fullPage: true });
  });

  test('04 — daily prediction', async ({ page }) => {
    await mockMorning(page);
    await setupMocks(page, { user: 'named', dailyStatus: 'prediction_ready' });
    await page.goto('/prediction');
    await page.getByText('День внутреннего шума', { exact: false }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '04-prediction.png'), fullPage: true });
  });

  test('05 — evening review', async ({ page }) => {
    await mockEvening(page);
    await setupMocks(page, { user: 'named', dailyStatus: 'prediction_ready' });
    await page.goto('/review');
    await expect(page.getByRole('button', { name: 'Да', exact: true })).toHaveCount(3, {
      timeout: 10000,
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '05-review.png'), fullPage: true });
  });

  test('06 — insights week', async ({ page }) => {
    await setupMocks(page, { user: 'named', dailyStatus: 'review_completed' });
    await routeRichProfileInsights(page);
    await page.goto('/insights');
    await page.getByTestId('insights-title').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByText('точность', { exact: true }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '06-insights-week.png'), fullPage: true });
  });

  test('07 — insights profile', async ({ page }) => {
    await setupMocks(page, { user: 'named', dailyStatus: 'review_completed' });
    await routeRichProfileInsights(page);
    await page.goto('/insights');
    await page.getByRole('button', { name: 'Мой профиль', exact: true }).click();
    await page.getByText('Точность прогнозов', { exact: true }).waitFor({ timeout: 10000 });
    await page.getByText('Открытия', { exact: true }).first().waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT_DIR, '07-insights-profile.png'), fullPage: true });
  });

  test('08 — settings', async ({ page }) => {
    await setupMocks(page, { user: 'named', dailyStatus: 'prediction_ready' });
    await page.goto('/settings');
    await page.getByRole('heading', { name: 'Настройки' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, '08-settings.png'), fullPage: true });
  });
});
