import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Custom fallback — defaults to the built-in crash screen */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report to Sentry (or any monitoring tool) if configured
    if (typeof window !== 'undefined' && (window as { __sentry__?: unknown }).__sentry__) {
      // Sentry.captureException(error, { extra: info });
    }
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <CrashScreen error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

// ─── Crash screen ─────────────────────────────────────────────────────────────

function CrashScreen({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  const isDev = import.meta.env.DEV;

  return (
    <div
      style={{ maxWidth: 430, margin: '0 auto' }}
      className="min-h-dvh flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="mb-6 text-5xl select-none">🌙</div>

      <h1
        className="text-xl font-semibold mb-3"
        style={{ color: 'var(--color-text)' }}
      >
        Что-то пошло не так
      </h1>

      <p
        className="text-sm leading-relaxed mb-8"
        style={{ color: 'var(--color-text-secondary)', maxWidth: 280 }}
      >
        Приложение столкнулось с неожиданной ошибкой.
        Обычно помогает обновить страницу.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.location.reload()}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
        >
          Обновить страницу
        </button>

        <button
          onClick={onReset}
          className="w-full py-3.5 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--color-text-secondary)' }}
        >
          Попробовать ещё раз
        </button>
      </div>

      {isDev && error && (
        <details className="mt-8 text-left w-full max-w-xs">
          <summary
            className="text-xs cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Детали ошибки (dev)
          </summary>
          <pre
            className="mt-2 p-3 rounded-xl text-xs overflow-auto"
            style={{
              background: 'rgba(0,0,0,0.05)',
              color: 'var(--color-text-secondary)',
              maxHeight: 200,
            }}
          >
            {error.message}
            {'\n'}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
