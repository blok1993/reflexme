import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpdateUser, useUser } from '../api/hooks';
import type { PreferredTone, Gender } from '@predictor/contracts';
import { getTodayISO } from '../lib/date';

const TONE_OPTIONS: { value: PreferredTone; label: string; subtitle: string; example: string }[] = [
  {
    value: 'gentle',
    label: 'Мягко',
    subtitle: 'Поддерживающий тон',
    example: '«Сегодня у тебя больше ресурса, чем ты думаешь»',
  },
  {
    value: 'neutral',
    label: 'Нейтрально',
    subtitle: 'Ясно и по делу',
    example: '«Высока вероятность эмоционального напряжения»',
  },
  {
    value: 'sharp',
    label: 'Прямо',
    subtitle: 'Без лишних слов',
    example: '«Тебя накроет. Лучше выйти раньше»',
  },
];

const STEPS = ['welcome', 'how', 'setup'] as const;

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const updateUser = useUpdateUser();
  const { data: userData } = useUser();

  // Guard: if the user already completed onboarding, redirect away
  useEffect(() => {
    if (userData?.user?.onboardingCompleted) {
      navigate('/checkin', { replace: true });
    }
  }, [userData, navigate]);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [tone, setTone] = useState<PreferredTone>('gentle');

  function next() {
    setDirection(1);
    setStep((s) => s + 1);
  }

  async function finish() {
    if (gender !== 'male' && gender !== 'female') return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await updateUser.mutateAsync({
      name: name.trim() || undefined,
      gender,
      birthDate: birthDate || undefined,
      preferredTone: tone,
      timezone,
      onboardingCompleted: true,
    });
    navigate('/checkin');
  }

  return (
    <div
      data-testid="onboarding-page"
      className="min-h-dvh flex flex-col overflow-x-hidden"
      style={{ background: 'var(--color-mood-bg)', maxWidth: 430, margin: '0 auto' }}
    >
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && <WelcomeStep />}
            {step === 1 && <HowStep />}
            {step === 2 && (
              <SetupStep
                name={name}
                onNameChange={setName}
                gender={gender}
                onGenderChange={setGender}
                birthDate={birthDate}
                onBirthDateChange={setBirthDate}
                tone={tone}
                onToneChange={setTone}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-6 pb-12">
        <div className="flex items-center gap-3 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? 'var(--color-text)' : 'var(--color-border)' }}
            />
          ))}
        </div>

        <button
          onClick={step < STEPS.length - 1 ? next : finish}
          disabled={
            updateUser.isPending ||
            (step === STEPS.length - 1 && gender !== 'male' && gender !== 'female')
          }
          data-testid="onboarding-next-btn"
          className="w-full py-4 rounded-2xl text-base font-semibold transition-all tap-scale disabled:opacity-50"
          style={{ background: 'var(--color-text)', color: '#FFFFFF' }}
        >
          {step < STEPS.length - 1
            ? 'Дальше'
            : updateUser.isPending
              ? 'Запускаем...'
              : 'Начать →'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
        className="w-24 h-24 rounded-[1.75rem] mb-8 overflow-hidden shadow-md shrink-0"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
      >
        <img
          src="/apple-touch-icon.png"
          alt=""
          width={96}
          height={96}
          decoding="async"
          draggable={false}
          className="w-full h-full object-cover select-none"
        />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl font-bold mb-4 tracking-tight"
        style={{ color: 'var(--color-text)' }}
      >
        ReflexMe
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-medium leading-snug mb-3 whitespace-pre-line"
        style={{ color: 'var(--color-text)' }}
      >
        Утром — прогноз.{'\n'}Вечером — итоги дня.
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-base whitespace-pre-line"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Не гороскоп. Не магия.
      </motion.p>
    </div>
  );
}

// ─── Step 2: How it works ─────────────────────────────────────────────────────

function HowStep() {
  return (
    <div className="flex flex-col justify-center flex-1">
      <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--color-text)' }}>
        Как это работает
      </h2>
      <div className="flex flex-col gap-6">
        {[
          { emoji: '🌅', title: 'Утром', text: 'Пара слов о твоём настроении и планах на день.' },
          { emoji: '🔮', title: 'Три карточки', text: 'Прогноз на твой день, твоя сила сегодня и на что обратить внимание.' },
          { emoji: '🌙', title: 'Вечером — итоги дня', text: 'Зайди и отметь, как всё прошло.\nС каждым днём прогнозы становятся точнее.' },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.12 }}
            className="flex items-start gap-4"
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              {item.emoji}
            </div>
            <div>
              <p className="font-semibold text-base mb-0.5" style={{ color: 'var(--color-text)' }}>
                {item.title}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>
                {item.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Setup ────────────────────────────────────────────────────────────

function SetupStep({
  name, onNameChange,
  gender, onGenderChange,
  birthDate, onBirthDateChange,
  tone, onToneChange,
}: {
  name: string; onNameChange: (v: string) => void;
  gender: Gender | null; onGenderChange: (v: Gender) => void;
  birthDate: string; onBirthDateChange: (v: string) => void;
  tone: PreferredTone; onToneChange: (v: PreferredTone) => void;
}) {
  // Max date for birthday: today
  const today = getTodayISO();

  return (
    <div className="flex flex-col flex-1 min-w-0 gap-5 overflow-y-auto pb-2">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        Немного о тебе
      </h2>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          Пол{' '}
          <span className="text-red-500" aria-hidden>
            *
          </span>
        </label>
        <div className="flex gap-2">
          {([
            { value: 'male' as Gender, label: '👨 Мужской' },
            { value: 'female' as Gender, label: '👩 Женский' },
          ]).map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => onGenderChange(opt.value)}
              whileTap={{ scale: 0.96 }}
              data-testid={`gender-option-${opt.value}`}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-all duration-200"
              style={{
                background: gender === opt.value ? 'var(--color-text)' : 'rgba(0,0,0,0.04)',
                color: gender === opt.value ? '#FFFFFF' : 'var(--color-text)',
              }}
            >
              {opt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
          Имя{' '}
          <span className="font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
            (необязательно)
          </span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Как тебя зовут?"
          maxLength={40}
          className="w-full px-4 py-3 rounded-xl text-base"
          style={{
            background: 'rgba(0,0,0,0.04)',
            border: '1.5px solid transparent',
            color: 'var(--color-text)',
          }}
        />
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
          Как говорить с тобой?
        </label>
        <div className="flex flex-col gap-2">
          {TONE_OPTIONS.map((option) => {
            const isSelected = tone === option.value;
            return (
              <motion.button
                key={option.value}
                onClick={() => onToneChange(option.value)}
                whileTap={{ scale: 0.98 }}
                className="w-full text-left p-3.5 rounded-xl transition-all duration-200"
                style={{
                  background: isSelected ? 'var(--color-text)' : 'rgba(0,0,0,0.04)',
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-semibold text-sm" style={{ color: isSelected ? '#FFFFFF' : 'var(--color-text)' }}>
                    {option.label}
                  </span>
                  <span className="text-xs" style={{ color: isSelected ? 'rgba(255,255,255,0.55)' : 'var(--color-text-tertiary)' }}>
                    {option.subtitle}
                  </span>
                </div>
                <p className="text-xs italic" style={{ color: isSelected ? 'rgba(255,255,255,0.65)' : 'var(--color-text-tertiary)' }}>
                  {option.example}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Birthday */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
          Дата рождения{' '}
          <span className="font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
            (необязательно)
          </span>
        </label>
        <p className="text-xs mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Помогает делать прогнозы чуть точнее
        </p>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => onBirthDateChange(e.target.value)}
          max={today}
          min="1920-01-01"
          data-testid="birthday-input"
          className="w-full h-12 px-4 rounded-xl text-base"
          style={{
            background: 'rgba(0,0,0,0.04)',
            border: '1.5px solid transparent',
            color: birthDate ? 'var(--color-text)' : 'var(--color-text-tertiary)',
          }}
        />
      </div>
    </div>
  );
}
