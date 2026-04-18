/**
 * Vocabulary analysis — pure algorithmic, no LLM needed.
 * Extracts meaningful words from the user's check-in context texts,
 * filters out Russian stop words, and returns frequency-ranked results.
 */

const STOP_WORDS = new Set([
  // Pronouns
  'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'себя', 'себе', 'меня', 'тебя',
  'него', 'неё', 'нас', 'вас', 'их', 'им', 'мне', 'тебе',
  // Prepositions
  'в', 'на', 'с', 'по', 'за', 'из', 'к', 'у', 'о', 'от', 'до', 'при', 'над',
  'под', 'про', 'для', 'без', 'через', 'из-за', 'из-под', 'между',
  // Conjunctions & particles
  'и', 'а', 'но', 'или', 'не', 'ни', 'что', 'как', 'так', 'это', 'вот', 'ну',
  'же', 'бы', 'ли', 'тут', 'там', 'где', 'когда', 'если', 'то', 'уж',
  'еще', 'ещё',  // both forms (normalised and original)
  'уже', 'даже', 'просто', 'только', 'лишь', 'тоже', 'также',
  // Common adverbs / filler
  'очень', 'совсем', 'слишком', 'немного', 'чуть', 'много', 'мало', 'всегда',
  'никогда', 'иногда', 'часто', 'редко', 'опять', 'снова',
  // Verbs (forms of "to be", "to go", "to have")
  'быть', 'был', 'была', 'было', 'были', 'есть', 'нет', 'буду', 'будет',
  'будут', 'иду', 'идет', 'идёт', 'пойти', 'пришел', 'пришла',
  // Time words (too generic)
  'сегодня', 'завтра', 'вчера', 'утром', 'вечером', 'ночью', 'день', 'дня',
  'дней', 'утро', 'вечер', 'ночь', 'час', 'часов', 'минут',
  // Modal / hedging
  'надо', 'нужно', 'можно', 'нельзя', 'хочу', 'хочется', 'надеюсь',
  // Common short words that survive length filter
  'все', 'всё', 'всех', 'каждый', 'каждая', 'любой',
]);

export interface VocabularyWord {
  word: string;
  count: number;
}

export function analyzeVocabulary(texts: (string | null | undefined)[]): VocabularyWord[] {
  const freq = new Map<string, number>();

  for (const text of texts) {
    if (!text) continue;

    const words = text
      .toLowerCase()
      .replace(/ё/g, 'е')             // normalize ё → е for better matching
      .replace(/[^а-яa-z\s-]/g, ' ')  // keep only Cyrillic, Latin, hyphens
      .split(/[\s,;.!?—–\-]+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 2)   // only words appearing 2+ times
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));
}
