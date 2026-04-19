import type { Page, Route } from '@playwright/test';
import {
  NEW_USER,
  ONBOARDED_USER,
  NAMED_USER,
  CHECKIN,
  PREDICTION,
  REVIEW,
  WEEKLY_INSIGHTS,
  HISTORY,
  makeStatus,
  type DailyStatusType,
} from './data';

// ─── Low-level helpers ────────────────────────────────────────────────────────

function ok<T>(data: T) {
  return { status: 200, body: JSON.stringify({ success: true, data }) };
}

function fail(code: string, message: string, status = 400) {
  return { status, body: JSON.stringify({ success: false, error: { code, message } }) };
}

// ─── Route registration ───────────────────────────────────────────────────────

type MockConfig = {
  user?: 'new' | 'onboarded' | 'named';
  dailyStatus?: DailyStatusType;
  checkinAlreadyExists?: boolean;
  generateError?: boolean;
};

/**
 * Set up all API mocks for a given scenario.
 * Call this before page.goto() so routes are registered early.
 */
export async function setupMocks(page: Page, config: MockConfig = {}) {
  const {
    user = 'onboarded',
    dailyStatus = 'checkin_missing',
    checkinAlreadyExists = false,
    generateError = false,
  } = config;

  const userFixture =
    user === 'new' ? NEW_USER : user === 'named' ? NAMED_USER : ONBOARDED_USER;

  // Mutable snapshot so after POST (e.g. onboarding) subsequent GET returns updated user.
  let currentUser: typeof NEW_USER | typeof ONBOARDED_USER | typeof NAMED_USER = {
    ...userFixture,
  };

  // GET /api/v1/users/me
  await page.route('**/api/v1/users/me', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill(ok({ user: currentUser }));
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() ?? {};
      currentUser = { ...currentUser, ...body };
      await route.fulfill(ok({ user: currentUser }));
    } else {
      await route.continue();
    }
  });

  // GET /api/v1/daily-status
  await page.route('**/api/v1/daily-status**', async (route: Route) => {
    await route.fulfill(ok(makeStatus(dailyStatus)));
  });

  // POST /api/v1/checkins
  await page.route('**/api/v1/checkins', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    if (checkinAlreadyExists) {
      await route.fulfill(fail('CHECKIN_ALREADY_EXISTS', 'Check-in for this date already exists', 409));
    } else {
      await route.fulfill({ ...ok({ checkin: CHECKIN }), status: 201 });
    }
  });

  // GET /api/v1/checkins/by-date
  await page.route('**/api/v1/checkins/by-date**', async (route: Route) => {
    if (dailyStatus === 'checkin_missing') {
      await route.fulfill(fail('NOT_FOUND', 'Check-in not found', 404));
    } else {
      await route.fulfill(ok({ checkin: CHECKIN }));
    }
  });

  // POST /api/v1/predictions/generate
  await page.route('**/api/v1/predictions/generate', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    if (generateError) {
      await route.fulfill(fail('GENERATION_FAILED', 'Failed to generate prediction', 500));
    } else {
      await route.fulfill({ ...ok({ prediction: PREDICTION }), status: 201 });
    }
  });

  // GET /api/v1/predictions/by-date
  await page.route('**/api/v1/predictions/by-date**', async (route: Route) => {
    const hasPrediction =
      dailyStatus === 'prediction_ready' || dailyStatus === 'review_completed';
    if (hasPrediction) {
      await route.fulfill(ok({ prediction: PREDICTION }));
    } else {
      await route.fulfill(fail('NOT_FOUND', 'Prediction not found', 404));
    }
  });

  // POST /api/v1/reviews
  await page.route('**/api/v1/reviews', async (route: Route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    await route.fulfill({ ...ok({ review: REVIEW }), status: 201 });
  });

  // GET /api/v1/reviews/by-date (frontend may treat 404 as «no review»)
  await page.route('**/api/v1/reviews/by-date**', async (route: Route) => {
    if (dailyStatus === 'review_completed') {
      await route.fulfill(ok({ review: REVIEW }));
    } else {
      await route.fulfill(fail('NOT_FOUND', 'Review not found', 404));
    }
  });

  // GET /api/v1/insights/weekly
  await page.route('**/api/v1/insights/weekly**', async (route: Route) => {
    await route.fulfill(ok(WEEKLY_INSIGHTS));
  });

  // GET /api/v1/history
  await page.route('**/api/v1/history**', async (route: Route) => {
    await route.fulfill(ok(HISTORY));
  });

  // PATCH /api/v1/settings
  await page.route('**/api/v1/settings', async (route: Route) => {
    if (route.request().method() !== 'PATCH') { await route.continue(); return; }
    const body = route.request().postDataJSON() ?? {};
    await route.fulfill(ok({
      settings: {
        preferredTone: body.preferredTone ?? 'neutral',
        eveningReminderTime: null,
        notificationsEnabled: false,
      },
    }));
  });
}

/**
 * Helper that intercepts the daily-status call and returns an updated status.
 * Useful for simulating status changes after actions (e.g. after creating checkin).
 */
export async function updateStatusMock(page: Page, newStatus: DailyStatusType) {
  await page.route('**/api/v1/daily-status**', async (route: Route) => {
    await route.fulfill(ok(makeStatus(newStatus)));
  });
}
