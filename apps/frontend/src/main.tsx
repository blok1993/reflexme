import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ApiError } from './api/client';
import { getDeviceId } from './lib/deviceId';
import './index.css';

// Ensure device ID is generated and persisted before any API calls
getDeviceId();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry client errors (404, 409 etc.) — they won't resolve on retry.
      // Retry server errors (5xx) and network errors up to 2 times.
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.isClientError) return false;
          return failureCount < 2;
        }
        return failureCount < 2;
      },
      // This app's data changes through user actions, not external changes.
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Don't retry mutations — they may not be idempotent
      retry: false,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 2500,
              style: {
                background: '#1C1C1E',
                color: '#FFFFFF',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 500,
                padding: '12px 16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
