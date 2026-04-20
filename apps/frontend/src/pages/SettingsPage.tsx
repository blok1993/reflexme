import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUser, useUpdateUser, useUpdateSettings } from '../api/hooks';
import type { PreferredTone } from '@predictor/contracts';
import toast from 'react-hot-toast';
import { getTodayISO } from '../lib/date';

const TONE_LABELS: Record<PreferredTone, { label: string; description: string }> = {
  gentle: { label: 'Мягко', description: 'Поддерживающий тон' },
  neutral: { label: 'Нейтрально', description: 'Ясно и по делу' },
  sharp: { label: 'Прямо', description: 'Без лишних слов' },
};

export function SettingsPage() {
  const { data: userData, isLoading } = useUser();
  const updateUser = useUpdateUser();
  const updateSettings = useUpdateSettings();

  const user = userData?.user;

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  // Optimistic tone: null = use server value; non-null = pending mutation value.
  // This avoids the flash where local state starts as 'neutral' before useEffect fires.
  const [optimisticTone, setOptimisticTone] = useState<PreferredTone | null>(null);
  const displayTone: PreferredTone = optimisticTone ?? user?.preferredTone ?? 'neutral';
  const displayName = name !== '' ? name : (user?.name ?? '');
  const displayBirthDate = birthDate !== null ? birthDate : (user?.birthDate ?? '');

  async function handleSaveName() {
    if (!user) return;
    await updateUser.mutateAsync({ name: name.trim() || undefined });
    toast.success('Сохранено');
  }

  async function handleSaveBirthDate() {
    if (!user) return;
    await updateUser.mutateAsync({ birthDate: displayBirthDate || null });
    toast.success('Сохранено');
  }

  async function handleToneChange(newTone: PreferredTone) {
    setOptimisticTone(newTone);
    try {
      await updateSettings.mutateAsync({ preferredTone: newTone });
      toast.success('Тон изменён');
    } finally {
      // Clear optimistic override — server value (via React Query cache) now correct.
      setOptimisticTone(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page flex items-center justify-center min-h-dvh">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text)' }}>
          Настройки
        </h1>

        <div className="flex flex-col gap-4">
          <section className="card">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Имя
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как тебя зовут?"
                maxLength={40}
                className="flex-1 min-w-0 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: '1.5px solid transparent',
                  color: 'var(--color-text)',
                }}
              />
              <button
                onClick={handleSaveName}
                disabled={updateUser.isPending}
                className="px-4 py-3 rounded-xl text-sm font-medium tap-scale"
                style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
              >
                Сохранить
              </button>
            </div>
          </section>

          <section className="card">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Дата рождения
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                value={displayBirthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={getTodayISO()}
                min="1920-01-01"
                className="flex-1 min-w-0 px-4 py-3 rounded-xl"
                style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: '1.5px solid transparent',
                  color: displayBirthDate ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleSaveBirthDate}
                disabled={updateUser.isPending}
                className="px-4 py-3 rounded-xl text-sm font-medium tap-scale"
                style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
              >
                Сохранить
              </button>
            </div>
          </section>

          <section className="card">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Тон общения
            </p>
            <div className="flex flex-col gap-2">
              {(Object.entries(TONE_LABELS) as [PreferredTone, { label: string; description: string }][]).map(
                ([value, { label, description }]) => {
                  const isSelected = displayTone === value;
                  return (
                    <motion.button
                      key={value}
                      onClick={() => handleToneChange(value)}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-between p-3 rounded-xl transition-all duration-200"
                      style={{
                        background: isSelected ? 'var(--color-text)' : 'rgba(0,0,0,0.04)',
                        border: 'none',
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: isSelected ? '#FFFFFF' : 'var(--color-text)' }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--color-text-tertiary)' }}
                      >
                        {description}
                      </span>
                    </motion.button>
                  );
                },
              )}
            </div>
          </section>

          <section className="card">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
              Версия
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              ReflexMe 1.0.0
            </p>
          </section>

          <section className="card">
            <p
              className="text-xs text-center leading-relaxed whitespace-pre-line"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Все данные хранятся локально на устройстве.{'\n'}
              Прогнозы не являются психологическим советом.
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
