import OpenAI from 'openai';
import { z } from 'zod';
import type { FocusArea, PreferredTone, PredictionConfidence } from '@predictor/contracts';
import { logger } from '../lib/logger.js';

// ─── Schemas ────────────────────────────────────────────────────────────────

const predictionOutputSchema = z.object({
  dayType: z.string().min(1).max(80),
  likelyEvent: z.string().min(1).max(240),
  strengthPoint: z.string().min(1).max(240),
  trapWarning: z.string().min(1).max(240),
  confidence: z.enum(['low', 'medium', 'high']),
  reasoningSummary: z.string().min(1).max(240),
});

const predictionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    dayType: { type: 'string', minLength: 1, maxLength: 80 },
    likelyEvent: { type: 'string', minLength: 1, maxLength: 240 },
    strengthPoint: { type: 'string', minLength: 1, maxLength: 240 },
    trapWarning: { type: 'string', minLength: 1, maxLength: 240 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasoningSummary: { type: 'string', minLength: 1, maxLength: 240 },
  },
  required: ['dayType', 'likelyEvent', 'strengthPoint', 'trapWarning', 'confidence', 'reasoningSummary'],
} as const;

const patternsOutputSchema = z.object({
  patterns: z.array(z.string().min(1).max(200)).min(1).max(6),
});

const patternsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patterns: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 200 },
      minItems: 1,
      maxItems: 6,
    },
  },
  required: ['patterns'],
} as const;

// ─── OpenAI client ──────────────────────────────────────────────────────────

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? '',
  timeout: 30_000,
  maxRetries: 0, // We implement our own retry with logging
});

// ─── Retry utility ───────────────────────────────────────────────────────────

/**
 * Retries an async fn with exponential backoff + jitter.
 * Retries only on 429 (rate limit), 5xx errors, and network timeouts.
 * Never retries on 4xx auth/validation errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, label = 'openai' }: { maxAttempts?: number; label?: string } = {},
): Promise<T> {
  let lastError!: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const status = (err as { status?: number }).status;

      // Don't retry: auth errors, context too long, invalid params
      const nonRetriable =
        status === 401 || status === 403 || status === 400 || status === 422;
      if (nonRetriable) throw err;

      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, ... with ±20% jitter
        const base = Math.pow(2, attempt - 1) * 1000;
        const jitter = base * 0.2 * (Math.random() - 0.5);
        const delay = Math.round(base + jitter);

        logger.warn(
          { label, attempt, maxAttempts, delay_ms: delay, error: (err as Error).message },
          `${label} call failed, retrying...`,
        );

        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  logger.error(
    { label, maxAttempts, error: lastError.message },
    `${label} call failed after ${maxAttempts} attempts`,
  );
  throw lastError;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function deriveFeatures(today: { mood: number; contextText: string }) {
  const text = today.contextText.toLowerCase();
  return {
    lowMood: today.mood <= 2,
    highMood: today.mood >= 4,
    mentionsPoorSleep: /не высп|плохо спал|мало спал|не сплю|insomnia|bad sleep|poor sleep|slept/.test(text),
    mentionsSocialResistance: /не хочу людей|не вывожу|никого не хочу|не хочу общаться|avoid people/.test(text),
    mentionsAnxiety: /тревог|беспок|волнуюсь|страшно|anxious|worry|nervous/.test(text),
    mentionsWork: /работ|задач|созвон|дедлайн|встреч|work|meeting|deadline/.test(text),
  };
}

const TONE_INSTRUCTIONS: Record<PreferredTone, string> = {
  gentle: 'Пиши мягко, поддерживающе. Используй слова "возможно", "скорее всего", "бывает так". Обращайся бережно.',
  neutral: 'Пиши нейтрально и ясно. Без лишних эмоций, но и без холодности. Конкретно и по делу.',
  sharp: 'Пиши прямо и честно. Без смягчений. Называй вещи своими именами. Уважай способность человека принять прямой разговор.',
};

// ─── Daily prediction ───────────────────────────────────────────────────────

export async function generatePredictionLLM(input: {
  preferredTone: PreferredTone;
  gender?: string | null;
  birthDate?: string | null;
  profileSummary?: string | null;
  today: { mood: 1 | 2 | 3 | 4 | 5; focus: FocusArea; contextText: string };
  recentHistory: Array<{
    date: string;
    mood: number;
    focus: string;
    accuracyScore: number | null;
    reviewComment: string | null;
    dayType?: string | null;
  }>;
}): Promise<{
  dayType: string;
  likelyEvent: string;
  strengthPoint: string;
  trapWarning: string;
  confidence: PredictionConfidence;
  reasoningSummary: string;
  modelVersion: string;
}> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  // Gender-specific grammatical instruction
  const genderInstruction = input.gender === 'female'
    ? 'Используй женский грамматический род в прилагательных и кратких формах глаголов: "уставшая", "раздражённая", "собранная" и т.д.'
    : input.gender === 'male'
      ? 'Используй мужской грамматический род в прилагательных и кратких формах глаголов: "уставший", "раздражённый", "собранный" и т.д.'
      : '';

  // Birth date context — subtle, not astrological
  const birthDateInstruction = input.birthDate
    ? `Дата рождения пользователя: ${input.birthDate}. Можешь тонко учитывать сезонность или другие психологические паттерны, не называя их явно.`
    : '';

  // Accumulated profile summary — the heart of personalisation.
  // Generated from the user's full review history; grows richer over time.
  const profileInstruction = input.profileSummary
    ? `ВАЖНО — накопленный психологический профиль этого человека: ${input.profileSummary} Используй эту информацию для персонализации прогноза. Не цитируй профиль напрямую — применяй его неявно.`
    : '';

  const systemPrompt = [
    'Ты — умный, тёплый близкий друг. Ты на стороне этого человека. Помогаешь ему понять свой день — не судишь.',
    'ОБЯЗАТЕЛЬНО: пиши ТОЛЬКО на русском языке.',
    'Обращайся на "ты".',
    genderInstruction,
    birthDateInstruction,
    profileInstruction,

    // ── Тон и эмпатия ──────────────────────────────────────────────────────────
    'ТОН: тёплый, честный, спокойный. Даже в тяжёлые дни — с пониманием. Не диагноз и не приговор.',
    'Признавай сложность мягко: "сегодня непросто" — не "день сгоревшей терпелки".',
    'В каждой карточке должна быть хоть капля поддержки или конкретной опоры.',

    // ── Стиль ──────────────────────────────────────────────────────────────────
    'СТИЛЬ: живой, разговорный, короткий. Максимум 15-20 слов на карточку.',
    'ЗАПРЕЩЕНО: "склонен к", "проявляется в", "что подтверждает", "уровень", "варьируется".',

    // ── Примеры ────────────────────────────────────────────────────────────────
    'ХОРОШО: "Тебя будет задевать тон, а не слова." / "Начни с механической задачи — включишься быстрее." / "Не принимай усталость за итог дня." / "Сегодня ты справишься лучше, чем кажется."',
    'ПЛОХО по тону: "День сгоревшей терпелки", "День серой рутины", "День на пределе" — это ярлыки, не поддержка.',

    // ── dayType ────────────────────────────────────────────────────────────────
    'dayType: поэтичное, образное, без осуждения. 3-5 слов. Описывает состояние, не ставит диагноз.',
    'Хорошие примеры dayType: "День внутреннего шума", "День тихой силы", "День ложной тревоги", "День чужого влияния", "День возврата к себе", "День ясности", "День накопленной усталости", "День в себе", "День неясной тревоги", "День тихого сопротивления", "День чуть медленнее".',
    'ЗАПРЕЩЕНО для dayType: жёсткие, резкие, унылые формулировки. Кальки с английского.',

    // ── Поля ───────────────────────────────────────────────────────────────────
    'likelyEvent: один сценарий дня. Конкретный, без осуждения.',
    'strengthPoint: одна точка силы. Практичная и ободряющая.',
    'trapWarning: одна ловушка. Честно, но бережно — не пугай, а предупреждай.',
    'reasoningSummary: для внутренних логов, можно на английском.',

    'НЕ используй мистику, астрологию, судьбу.',
    'НЕ выдумывай факты которых нет во входных данных.',
    'Мало данных — снижай confidence.',
  ].filter(Boolean).join(' ');

  const toneInstruction = TONE_INSTRUCTIONS[input.preferredTone];

  const payload = {
    preferredTone: input.preferredTone,
    toneInstruction,
    // profileSummary is already embedded in systemPrompt; pass it here too
    // so the model can see it in the user turn for cross-attention
    hasProfile: !!input.profileSummary,
    today: input.today,
    derivedFeatures: deriveFeatures(input.today),
    // With a profile we can rely more on long-term patterns, so we need fewer raw entries
    recentHistory: input.recentHistory.slice(0, input.profileSummary ? 4 : 7),
  };

  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const startMs = Date.now();

  const response = await withRetry(
    () => openai.responses.create({
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(payload) }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'daily_prediction',
          schema: predictionJsonSchema,
          strict: true,
        },
      },
    }),
    { label: 'generatePrediction' },
  );

  logger.info({ duration_ms: Date.now() - startMs, model }, 'Prediction generated');

  const rawText = response.output_text;
  if (!rawText) throw new Error('Empty model output');

  const parsed = predictionOutputSchema.parse(JSON.parse(rawText));
  return { ...parsed, modelVersion: model };
}

// ─── Weekly patterns ────────────────────────────────────────────────────────

export async function generateWeeklyPatternsLLM(input: {
  totalDays: number;
  averageAccuracy: number | null;
  mostFrequentDayType: string | null;
  reviews: Array<{
    date: string;
    dayType: string;
    likelyEventScore: string;
    strengthPointScore: string;
    trapWarningScore: string;
    comment: string | null;
    mood: number;
    focus: string;
  }>;
}): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackPatterns(input);
  }

  const systemPrompt = [
    'Ты — умный близкий друг. Смотришь на прошедшую неделю человека и говоришь ему что заметил.',
    'Обращайся на "ты". Пиши по-русски.',

    // ── Стиль ──────────────────────────────────────────────────────────────────
    'СТИЛЬ: коротко, живо, конкретно. Как будто говоришь вслух — не пишешь психологический отчёт.',
    'Одно предложение = один инсайт. Максимум 20 слов.',
    'ЗАПРЕЩЕНО: "склонен к", "что проявляется в", "свидетельствует о", "варьируется", "данная", "уровень использования", длинные придаточные конструкции.',
    'Не объясняй — просто наблюдай.',

    // ── Примеры ────────────────────────────────────────────────────────────────
    'ХОРОШО: "Ты чаще ждёшь конфликта там, где его потом нет." / "В тревожные дни предупреждения почти всегда сбываются." / "В дни с людьми ты заряжаешься, но потом нужно время на восстановление."',
    'ПЛОХО: "Прослеживается тенденция к ожиданию конфликтных ситуаций, которые в действительности не реализуются." / "Дни внутренней подготовки проходят с меньшей точностью прогнозов."',

    // ── Запреты ────────────────────────────────────────────────────────────────
    'ЗАПРЕЩЕНО использовать слово "ловушка" или "ловушки" — вместо него используй "предупреждение", "риск", "то, чего боялся".',
    'ЗАПРЕЩЕНО упоминать точность прогнозов — это не касается человека, это технический показатель.',

    // ── Содержание ─────────────────────────────────────────────────────────────
    'Только то что реально видно в данных. Не придумывай.',
    '3-5 инсайтов.',
  ].join(' ');

  try {
    const response = await withRetry(
      () => openai.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'weekly_patterns',
            schema: patternsJsonSchema,
            strict: true,
          },
        },
      }),
      { label: 'generateWeeklyPatterns', maxAttempts: 2 },
    );

    const rawText = response.output_text;
    if (!rawText) return generateFallbackPatterns(input);

    const parsed = patternsOutputSchema.parse(JSON.parse(rawText));
    return parsed.patterns;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Weekly patterns generation failed, using fallback');
    return generateFallbackPatterns(input);
  }
}

function generateFallbackPatterns(input: {
  totalDays: number;
  averageAccuracy: number | null;
  mostFrequentDayType: string | null;
}): string[] {
  const patterns: string[] = [];
  if (input.totalDays < 3) {
    patterns.push('Данных пока немного — с каждым днём прогнозы будут точнее.');
    return patterns;
  }
  if (input.averageAccuracy !== null) {
    if (input.averageAccuracy >= 0.7) {
      patterns.push('Прогнозы этой недели оказались достаточно точными.');
    } else if (input.averageAccuracy >= 0.4) {
      patterns.push('Прогнозы попадали примерно в половину случаев — это нормально на старте.');
    } else {
      patterns.push('Прогнозы пока ошибаются чаще, чем попадают. Продолжай — система учится.');
    }
  }
  if (input.mostFrequentDayType) {
    patterns.push(`Самый частый тип дня на этой неделе: "${input.mostFrequentDayType}".`);
  }
  patterns.push('Продолжай вечерние отметки — они делают следующие прогнозы точнее.');
  return patterns;
}

// ─── Profile summary ─────────────────────────────────────────────────────────

const profileSummarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', minLength: 1, maxLength: 1100 },
  },
  required: ['summary'],
} as const;

const profileSummaryZod = z.object({ summary: z.string().min(1).max(1100) });

/**
 * Generates a psychological profile summary from the user's review history.
 *
 * The summary is a compact Russian-language narrative (~300-500 chars) describing:
 * - Emotional patterns (what kinds of days are most common)
 * - Triggers (what correlates with low mood / poor days)
 * - Strengths (what consistently works for this person)
 * - Prediction accuracy patterns (which card type is most accurate)
 * - Vocabulary style (recurring words the user uses)
 *
 * The summary is injected into the daily prediction system prompt so the LLM
 * can produce increasingly personalised forecasts over time.
 */
export async function generateProfileSummaryLLM(input: {
  totalReviews: number;
  reviews: Array<{
    date: string;
    mood: number;
    focus: string;
    dayType: string;
    likelyEventScore: string;
    strengthPointScore: string;
    trapWarningScore: string;
    comment: string | null;
    contextText: string | null;
  }>;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (input.totalReviews < 5) return null;

  const systemPrompt = [
    'Ты составляешь психологический профиль пользователя на основе его истории прогнозов.',
    'Пиши на русском, от третьего лица: "Часто чувствует...", "Когда фокус на людях...", "Типичные слова:".',
    'Стиль: сухой и точный, как в записях умного психолога-практика. Без воды, без украшений.',
    'Короткие предложения. Только факты и паттерны из данных.',
    'ЗАПРЕЩЕНО: канцелярит, длинные объяснения, слова "склонен к", "проявляется", "свидетельствует".',
    'Включи: паттерны настроения, триггеры, точки силы, характерные слова, что чаще сбывается.',
    'Если данных мало — пиши только то, что точно видно.',
    '500-1000 символов.',
  ].join(' ');

  try {
    const response = await withRetry(
      () => openai.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(input) }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'profile_summary',
            schema: profileSummarySchema,
            strict: true,
          },
        },
      }),
      { label: 'generateProfileSummary', maxAttempts: 2 },
    );

    const rawText = response.output_text;
    if (!rawText) return null;

    const parsed = profileSummaryZod.parse(JSON.parse(rawText));
    logger.info({ length: parsed.summary.length }, 'Profile summary generated');
    return parsed.summary;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Profile summary generation failed');
    return null;
  }
}

// ─── Pattern cards ────────────────────────────────────────────────────────────

export interface PatternCard {
  id: string;
  title: string;         // 3-5 words, striking
  insight: string;       // 1-2 sentences, max 180 chars
  category: 'accuracy' | 'focus' | 'mood' | 'trigger' | 'strength';
  highlight?: string;    // optional data point, e.g. "73% случаев"
}

const patternCardsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title:     { type: 'string', minLength: 1, maxLength: 60 },
          insight:   { type: 'string', minLength: 1, maxLength: 200 },
          category:  { type: 'string', enum: ['accuracy', 'focus', 'mood', 'trigger', 'strength'] },
          // OpenAI strict mode requires ALL properties in 'required'.
          // Optional fields must use anyOf with null.
          highlight: { anyOf: [{ type: 'string', maxLength: 50 }, { type: 'null' }] },
        },
        required: ['title', 'insight', 'category', 'highlight'],
      },
      minItems: 1,
      maxItems: 5,
    },
  },
  required: ['cards'],
} as const;

const patternCardsZod = z.object({
  cards: z.array(z.object({
    title: z.string().min(1).max(60),
    insight: z.string().min(1).max(200),
    category: z.enum(['accuracy', 'focus', 'mood', 'trigger', 'strength']),
    highlight: z.string().max(50).optional(),
  })).min(1).max(5),
});

/**
 * Generates structural pattern discovery cards from long-term history.
 * These are more impactful than weekly insights — they reveal stable patterns
 * the user might not have noticed themselves (e.g. "your trapWarning is almost
 * always right on days you focus on people").
 *
 * Requires at least 15 reviews for meaningful patterns.
 */
export async function generatePatternCardsLLM(input: {
  totalReviews: number;
  reviews: Array<{
    date: string;
    mood: number;
    focus: string;
    dayType: string;
    likelyEventScore: string;
    strengthPointScore: string;
    trapWarningScore: string;
    comment: string | null;
    contextText: string | null;
  }>;
}): Promise<PatternCard[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (input.totalReviews < 7) return null;

  const systemPrompt = [
    'Ты психолог-аналитик. Смотришь на историю человека и находишь то, что он сам о себе не понял.',
    'Пиши на русском, обращайся на "ты".',

    // ── Главное правило ────────────────────────────────────────────────────────
    'САМОЕ ВАЖНОЕ: открытие — это не факт из данных, а вывод, который удивляет.',
    'Плохое открытие: "В рабочие дни у тебя хорошее настроение." — человек и сам это знает.',
    'Хорошее открытие: "Ты думаешь, что люди тебя поддерживают — но данные говорят обратное: после большинства дней с людьми ты чувствуешь себя хуже."',
    'Спроси себя перед каждым открытием: "Удивит ли это человека? Скажет ли он — ого, не замечал?"',

    // ── Что искать ────────────────────────────────────────────────────────────
    'Ищи НЕОЧЕВИДНЫЕ связи и противоречия:',
    '— Ожидал одно от дня, получил другое',
    '— Что-то всегда помогает, но человек этого не замечает',
    '— Что-то никогда не срабатывает, но человек всё равно на это надеется',
    '— Паттерн, который повторяется, но сам человек его не видит',
    '— Конкретный триггер плохого дня — не очевидный',

    // ── Формат ────────────────────────────────────────────────────────────────
    'Insight: 1-2 предложения. Максимум 30 слов. Начинай с наблюдения — не с вывода.',
    'Highlight: конкретная цифра или факт из данных. Без слова "дней" в конце если уже есть число.',
    'ЗАПРЕЩЕНО: технические поля (likelyEventScore и т.п.), канцелярит, очевидные факты.',
    'Стиль: живой, прямой, как умный друг который видит тебя насквозь.',

    // ── Запреты ────────────────────────────────────────────────────────────────
    'ЗАПРЕЩЕНО использовать слово "ловушка" или "ловушки" — вместо него используй "предупреждение", "риск", "то, чего боялся".',
    'ЗАПРЕЩЕНО упоминать точность прогнозов или сравнивать точность — это технический показатель, не касается человека.',
    'ЗАПРЕЩЕНО запутанные многоступенчатые фразы — если предложение нужно перечитать, перепиши проще.',

    // ── Примеры хорошего ──────────────────────────────────────────────────────
    'ХОРОШО: "Ты идёшь на людей за энергией — но после почти каждого такого дня тебе хуже." / "Советы о силе не работают именно тогда, когда ты в них больше всего нуждаешься — в тревожные дни." / "Ты боишься плохого дня заранее — но чаще всего он оказывается лучше, чем ожидал."',
    'ПЛОХО: "Твои предупреждения о ловушках работают не всегда." / "Дни внутренней подготовки проходят спокойнее, но с меньшей точностью прогнозов."',

    '3-5 открытий. Только то, что реально видно в данных.',
  ].join(' ');

  // Map raw data to human-readable Russian before sending to LLM.
  // This prevents the model from echoing technical field names in card text.
  const FOCUS_RU: Record<string, string> = {
    work: 'работа',
    people: 'люди',
    energy: 'энергия',
    emotions: 'эмоции',
    tension: 'напряжение',
    control: 'контроль',
    rest: 'отдых',
    self_focus: 'фокус на себе',
  };
  const SCORE_RU: Record<string, string> = {
    yes: 'сбылось', partial: 'частично', no: 'не сбылось',
  };
  const MOOD_RU: Record<number, string> = {
    1: 'очень плохое', 2: 'плохое', 3: 'нейтральное', 4: 'хорошее', 5: 'отличное',
  };

  const humanReadableReviews = input.reviews.map((r) => ({
    дата: r.date,
    настроение: MOOD_RU[r.mood] ?? String(r.mood),
    фокус_дня: FOCUS_RU[r.focus] ?? r.focus,
    тип_дня: r.dayType,
    прогноз_события: SCORE_RU[r.likelyEventScore] ?? r.likelyEventScore,
    совет_о_силе: SCORE_RU[r.strengthPointScore] ?? r.strengthPointScore,
    предупреждение: SCORE_RU[r.trapWarningScore] ?? r.trapWarningScore,
    комментарий: r.comment,
    контекст_утра: r.contextText,
  }));

  try {
    const response = await withRetry(
      () => openai.responses.create({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: JSON.stringify({ всего_дней: input.totalReviews, дни: humanReadableReviews }),
            }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'pattern_cards',
            schema: patternCardsSchema,
            strict: true,
          },
        },
      }),
      { label: 'generatePatternCards', maxAttempts: 2 },
    );

    const rawText = response.output_text;
    if (!rawText) return null;

    const parsed = patternCardsZod.parse(JSON.parse(rawText));
    const cards: PatternCard[] = parsed.cards.map((c, i) => ({
      id: `card_${Date.now()}_${i}`,
      ...c,
    }));
    logger.info({ count: cards.length }, 'Pattern cards generated');
    return cards;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Pattern cards generation failed');
    return null;
  }
}
