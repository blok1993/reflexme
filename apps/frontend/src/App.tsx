import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { OnboardingPage } from './pages/OnboardingPage';
import { CheckinPage } from './pages/CheckinPage';
import { PredictionPage } from './pages/PredictionPage';
import { PredictionDetailPage } from './pages/PredictionDetailPage';
import { ReviewPage } from './pages/ReviewPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useUser, useDailyStatus } from './api/hooks';
import { getTodayISO, isEvening } from './lib/date';
import { initSentry, identifyUser } from './lib/sentry';

function SmartRedirect() {
  const navigate = useNavigate();
  const { data: userData, isLoading: userLoading } = useUser();
  const today = getTodayISO();
  const { data: statusData, isLoading: statusLoading } = useDailyStatus(today);

  // Identify user in Sentry for error context
  useEffect(() => {
    if (userData?.user) {
      identifyUser({ id: userData.user.id, name: userData.user.name });
    }
  }, [userData]);

  useEffect(() => {
    if (userLoading || statusLoading) return;
    const user = userData?.user;
    if (!user || !user.onboardingCompleted) {
      navigate('/onboarding', { replace: true });
      return;
    }
    // Guard: if user somehow ended up at /onboarding after completing it, redirect away
    if (window.location.pathname === '/onboarding') {
      navigate('/checkin', { replace: true });
      return;
    }
    const status = statusData?.status;
    if (!status || status === 'checkin_missing') {
      navigate('/checkin', { replace: true });
    } else if (status === 'prediction_generating' || status === 'prediction_ready') {
      if (isEvening()) {
        navigate('/review', { replace: true });
      } else {
        navigate('/prediction', { replace: true });
      }
    } else {
      navigate('/insights', { replace: true });
    }
  }, [userLoading, statusLoading, userData, statusData]);

  return <LoadingScreen message="Загрузка..." />;
}

// Initialize Sentry once
initSentry();

/**
 * Guards any route that requires a completed onboarding.
 * If the user record doesn't exist yet or onboarding isn't done → /onboarding.
 * Shows nothing while loading so there's no flash of the protected page.
 */
function RequireOnboarding({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { data: userData, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;
    const user = userData?.user;
    if (!user || !user.onboardingCompleted) {
      navigate('/onboarding', { replace: true });
    }
  }, [isLoading, userData, navigate]);

  // While loading, show nothing (prevents flash of protected content)
  if (isLoading) return null;
  const user = userData?.user;
  if (!user || !user.onboardingCompleted) return null;

  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <AnimatePresence mode="wait">
      <Routes>
        <Route path="/" element={<SmartRedirect />} />
        <Route
          path="/onboarding"
          element={
            <Layout showNav={false}>
              <OnboardingPage />
            </Layout>
          }
        />
        <Route
          path="/checkin"
          element={<RequireOnboarding><Layout><CheckinPage /></Layout></RequireOnboarding>}
        />
        <Route
          path="/prediction"
          element={<RequireOnboarding><Layout><PredictionPage /></Layout></RequireOnboarding>}
        />
        <Route
          path="/review"
          element={<RequireOnboarding><Layout><ReviewPage /></Layout></RequireOnboarding>}
        />
        <Route
          path="/insights"
          element={<RequireOnboarding><Layout><InsightsPage /></Layout></RequireOnboarding>}
        />
        <Route
          path="/settings"
          element={<RequireOnboarding><Layout><SettingsPage /></Layout></RequireOnboarding>}
        />
        <Route
          path="/history/:date"
          element={<RequireOnboarding><Layout><PredictionDetailPage /></Layout></RequireOnboarding>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AnimatePresence>
    </>
  );
}
