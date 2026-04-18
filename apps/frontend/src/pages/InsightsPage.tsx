import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useWeeklyInsights,
  useHistory,
  useAccuracyCurve,
  useVocabulary,
  usePatternCards,
} from '../api/hooks';
import { formatDateShortRu, formatDateWithWeekdayRu, getWeekRange } from '../lib/date';
import { SkeletonHistoryItem } from '../components/SkeletonCard';
import { AccuracyCurve } from '../components/AccuracyCurve';
import { VocabularyWords } from '../components/VocabularyWords';
import { PatternCards } from '../components/PatternCards';
import { InsightsLoadingScreen } from '../components/InsightsLoadingScreen';

type Tab = 'week' | 'history' | 'profile';

const TAB_LABELS: Record<Tab, string> = {
  week: 'Неделя',
  history: 'История',
  profile: 'Мой профиль',
};

export function InsightsPage() {
  const [tab, setTab] = useState<Tab>('week');

  return (
    <div className="page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1
          className="text-2xl font-bold mb-5"
          style={{ color: 'var(--color-text)' }}
          data-testid="insights-title"
        >
          Паттерны
        </h1>

        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: 'rgba(0,0,0,0.05)' }}
        >
          {(['week', 'history', 'profile'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 tap-scale"
              style={{
                background: tab === t ? '#FFFFFF' : 'transparent',
                color: tab === t ? 'var(--color-text)' : 'var(--color-text-secondary)',
                boxShadow: tab === t ? '0 1px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'week' && (
            <motion.div key="week" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
              <WeekTab />
            </motion.div>
          )}
          {tab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
              <HistoryTab />
            </motion.div>
          )}
          {tab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
              <ProfileTab />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Week tab ─────────────────────────────────────────────────────────────────

function WeekTab() {
  const { startDate, endDate } = getWeekRange();
  const { data, isLoading, error } = useWeeklyInsights();

  if (isLoading) {
    return <InsightsLoadingScreen type="weekly" />;
  }

  if (error || !data) {
    return (
      <div className="card text-center py-8">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Не удалось загрузить данные</p>
      </div>
    );
  }

  const { summary, patterns, days } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
        {formatDateShortRu(startDate)} — {formatDateShortRu(endDate)}
      </div>

      {summary.totalDays === 0 ? (
        <div className="card text-center py-10">
          <p className="text-3xl mb-3">🌱</p>
          <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>Ещё нет данных</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Каждый вечер оценивай прогноз — и со временем здесь появятся наблюдения о тебе
          </p>
        </div>
      ) : (
        <>
          <SummaryCard summary={summary} />

          {patterns.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                Наблюдения
              </p>
              <div className="flex flex-col gap-3">
                {patterns.map((pattern, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0 mt-0.5">💡</span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>{pattern}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {days.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                Дни недели
              </p>
              <div className="flex flex-col gap-2">
                {days.map((day) => <WeekDayRow key={day.date} day={day} />)}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

function SummaryCard({ summary }: { summary: { totalDays: number; averageAccuracy: number | null; mostFrequentDayType: string | null } }) {
  const accuracy = summary.averageAccuracy !== null ? Math.round(summary.averageAccuracy * 100) : null;
  const maxDaysInWeek = 7;
  const completionLabel = `${summary.totalDays} из ${maxDaysInWeek}`;

  return (
    <div className="card">
      {/* Stat row */}
      <div className="flex items-stretch gap-3">
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{completionLabel}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>дней заполнено</p>
        </div>
        <div className="w-px" style={{ background: 'var(--color-border)' }} />
        {accuracy !== null && (
          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <p className="text-2xl font-bold" style={{ color: accuracy >= 60 ? '#3DAB7A' : accuracy >= 35 ? '#C09A50' : '#AEAEB2' }}>{accuracy}%</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>точность</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekDayRow({ day }: { day: { date: string; dayType: string; accuracyScore: number | null } }) {
  const navigate = useNavigate();
  const accuracy = day.accuracyScore !== null ? Math.round(day.accuracyScore * 100) : null;
  const dotColor = accuracy === null ? '#AEAEB2' : accuracy >= 67 ? '#3DAB7A' : accuracy >= 34 ? '#C09A50' : '#D07848';
  return (
    <div
      className="flex items-center gap-3 py-1.5 tap-scale cursor-pointer rounded-xl px-1 -mx-1"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/history/${day.date}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/history/${day.date}`)}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{day.dayType}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {formatDateWithWeekdayRu(day.date)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {accuracy !== null && <span className="text-xs font-medium" style={{ color: dotColor }}>{accuracy}%</span>}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading, error } = useHistory();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => <SkeletonHistoryItem key={i} />)}
      </div>
    );
  }

  if (error || !data) {
    return <div className="card text-center py-8"><p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Не удалось загрузить историю</p></div>;
  }

  if (data.items.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-3xl mb-3">📖</p>
        <p className="font-semibold text-base mb-1" style={{ color: 'var(--color-text)' }}>История пуста</p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Здесь появятся все твои дни</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.items.map((item, i) => <HistoryItem key={item.date} item={item} index={i} />)}
    </div>
  );
}

const FOCUS_LABELS: Record<string, string> = {
  work: 'Работа',
  people: 'Люди',
  energy: 'Энергия',
  emotions: 'Эмоции',
  tension: 'Напряжение',
  control: 'Контроль',
  rest: 'Отдых',
  self_focus: 'Фокус на себе',
};
const MOOD_EMOJIS: Record<number, string> = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😊' };

function HistoryItem({ item, index }: {
  item: { date: string; dayType: string | null; mood: number; focus: string; accuracyScore: number | null; reviewCompleted: boolean };
  index: number;
}) {
  const navigate = useNavigate();
  const accuracy = item.accuracyScore !== null ? Math.round(item.accuracyScore * 100) : null;
  const dotColor = !item.reviewCompleted ? '#AEAEB2' : accuracy !== null && accuracy >= 67 ? '#3DAB7A' : accuracy !== null && accuracy >= 34 ? '#C09A50' : '#D07848';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="card tap-scale cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Открыть прогноз за ${item.date}`}
      onClick={() => navigate(`/history/${item.date}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/history/${item.date}`)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl leading-none flex-shrink-0">{MOOD_EMOJIS[item.mood] ?? '😐'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.dayType ?? 'Прогноз не сгенерирован'}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{formatDateShortRu(item.date)} · {FOCUS_LABELS[item.focus] ?? item.focus}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
          {accuracy !== null && <span className="text-xs font-medium" style={{ color: dotColor }}>{accuracy}%</span>}
          {!item.reviewCompleted && <span className="text-xs" style={{ color: '#AEAEB2' }}>—</span>}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { data: curveData, isLoading: curveLoading } = useAccuracyCurve();
  const { data: vocabData, isLoading: vocabLoading } = useVocabulary();
  const { data: patternsData, isLoading: patternsLoading } = usePatternCards();

  const isLoading = curveLoading || vocabLoading || patternsLoading;

  if (isLoading) {
    return <InsightsLoadingScreen type="profile" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Accuracy curve */}
      {curveData && (
        <AccuracyCurve
          points={curveData.points}
          trend={curveData.trend}
          totalReviews={curveData.totalReviews}
        />
      )}

      {/* Pattern cards */}
      {patternsData && (
        <PatternCards
          cards={patternsData.cards}
          hasEnoughData={patternsData.hasEnoughData}
          totalReviews={patternsData.totalReviews}
          minimumRequired={patternsData.minimumRequired}
        />
      )}

      {/* Vocabulary */}
      {vocabData && (
        <VocabularyWords
          words={vocabData.words}
          hasEnoughData={vocabData.hasEnoughData}
          analyzedCheckins={vocabData.analyzedCheckins}
        />
      )}
    </div>
  );
}
