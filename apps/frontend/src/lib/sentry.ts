/**
 * Sentry integration — opt-in via VITE_SENTRY_DSN environment variable.
 *
 * To enable:
 *   1. Create a project at https://sentry.io
 *   2. Add VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx to .env
 *   3. npm install @sentry/react -w @predictor/frontend
 *   4. Uncomment the Sentry.init call below
 *
 * The app works without Sentry — this module is a safe no-op when DSN is absent.
 */

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  // Uncomment after installing @sentry/react:
  //
  // import('@sentry/react').then((Sentry) => {
  //   Sentry.init({
  //     dsn,
  //     environment: import.meta.env.MODE,
  //     tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  //     allowUrls: [window.location.origin],
  //     ignoreErrors: [
  //       'ResizeObserver loop limit exceeded',
  //       'Network request failed',
  //       /^Loading chunk/,
  //     ],
  //   });
  // }).catch(() => {});
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    console.error('[captureError]', err, context);
  }
  // _sentry?.captureException(err, context ? { extra: context } : undefined);
}

export function captureMessage(msg: string, _level: 'info' | 'warning' | 'error' = 'info'): void {
  if (import.meta.env.DEV) {
    console.info('[captureMessage]', msg);
  }
  // _sentry?.captureMessage(msg, _level);
}

export function identifyUser(_user: { id: string; name: string | null } | null): void {
  // _sentry?.setUser(_user ? { id: _user.id, username: _user.name ?? undefined } : null);
}
