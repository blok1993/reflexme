import { NavLink, useNavigate } from 'react-router-dom';
import { useDailyStatus } from '../api/hooks';
import { getTodayISO, isEvening } from '../lib/date';

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
        strokeWidth={active ? 2 : 1.5}
        strokeLinejoin="round"
        fill={active ? 'var(--color-accent-light)' : 'none'}
      />
    </svg>
  );
}

function InsightsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="3" y="14" width="4" height="7" rx="1"
        fill={active ? 'var(--color-accent)' : 'none'}
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
        strokeWidth="1.5"
      />
      <rect
        x="10" y="9" width="4" height="12" rx="1"
        fill={active ? 'var(--color-accent)' : 'none'}
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
        strokeWidth="1.5"
      />
      <rect
        x="17" y="4" width="4" height="17" rx="1"
        fill={active ? 'var(--color-accent)' : 'none'}
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-tertiary)'}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const stroke = active ? 'var(--color-accent)' : 'var(--color-text-tertiary)';
  const sw = active ? 2 : 1.5;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke={stroke}
        strokeWidth={sw}
        fill={active ? 'var(--color-accent-light)' : 'none'}
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BottomNav() {
  const navigate = useNavigate();
  const { data: status } = useDailyStatus(getTodayISO());

  function handleTodayTap() {
    if (!status) { navigate('/checkin'); return; }
    if (status.status === 'checkin_missing') navigate('/checkin');
    else if (status.status === 'prediction_ready' && isEvening()) navigate('/review');
    else navigate('/prediction');
  }

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around px-4">
        <button
          onClick={handleTodayTap}
          className="flex flex-col items-center gap-1 py-1 px-4 tap-scale"
        >
          <TodayIcon active={false} />
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Сегодня</span>
        </button>

        <NavLink
          to="/insights"
          className="flex flex-col items-center gap-1 py-1 px-4 tap-scale"
        >
          {({ isActive }) => (
            <>
              <InsightsIcon active={isActive} />
              <span
                className="text-xs"
                style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
              >
                Паттерны
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/settings"
          className="flex flex-col items-center gap-1 py-1 px-4 tap-scale"
        >
          {({ isActive }) => (
            <>
              <SettingsIcon active={isActive} />
              <span
                className="text-xs"
                style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
              >
                Настройки
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
