/**
 * Seed script: generates 14 days of realistic mock data for the existing user.
 * Run: tsx src/seed.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USER_ID = 'cmo4o1tia0000501ek25zv48v';

// ─── Mock data ────────────────────────────────────────────────────────────────

const DAYS: Array<{
  mood: 1|2|3|4|5;
  focus: string;
  context: string;
  dayType: string;
  likelyEvent: string;
  strengthPoint: string;
  trapWarning: string;
  confidence: string;
  likelyScore: 'yes'|'partial'|'no';
  strengthScore: 'yes'|'partial'|'no';
  trapScore: 'yes'|'partial'|'no';
  comment: string | null;
}> = [
  {
    mood: 2, focus: 'people',
    context: 'плохо спал, сегодня важный созвон с командой, немного тревожно',
    dayType: 'День внутреннего шума',
    likelyEvent: 'Тебя будет задевать тон собеседника сильнее, чем сами слова.',
    strengthPoint: 'Если начнёшь день с простой механической задачи — включишься быстрее.',
    trapWarning: 'Не принимай утреннюю усталость за нежелание работать.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'partial', trapScore: 'yes',
    comment: 'созвон прошел нормально но реально задело как один человек сказал фразу',
  },
  {
    mood: 3, focus: 'work',
    context: 'дедлайн через два дня, надо сосредоточиться',
    dayType: 'День собранности',
    likelyEvent: 'Ты будешь продуктивнее, чем ожидаешь — фокус придёт быстро.',
    strengthPoint: 'Список задач на бумаге сегодня сработает лучше любого приложения.',
    trapWarning: 'Не трать первый час на мелкие задачи — берись за главное сразу.',
    confidence: 'medium',
    likelyScore: 'yes', strengthScore: 'yes', trapScore: 'partial',
    comment: null,
  },
  {
    mood: 4, focus: 'energy',
    context: 'выспался наконец-то, чувствую себя хорошо',
    dayType: 'День возвращения энергии',
    likelyEvent: 'Сегодня ты будешь эффективнее в общении — слова будут находиться легче.',
    strengthPoint: 'Используй этот ресурс на задачи, которые требуют концентрации.',
    trapWarning: 'Не бери на себя слишком много — энергия есть, но не безгранична.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'yes', trapScore: 'no',
    comment: 'день реально прошел хорошо, взял много задач и справился',
  },
  {
    mood: 2, focus: 'tension',
    context: 'не понимаю почему тревожно с утра, ничего особенного не происходит',
    dayType: 'День фоновой тревоги',
    likelyEvent: 'Тревога будет искать себе объяснение — и найдёт, даже если его нет.',
    strengthPoint: 'Короткая прогулка в середине дня сбросит напряжение лучше, чем работа.',
    trapWarning: 'Не пытайся «решить» тревогу — просто дай ей пройти.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'partial', trapScore: 'yes',
    comment: 'к вечеру отпустило само собой, без причины',
  },
  {
    mood: 3, focus: 'emotions',
    context: 'вечером встреча с другом которого давно не видел',
    dayType: 'День переключения',
    likelyEvent: 'Встреча придаст больше сил, чем ты ожидаешь.',
    strengthPoint: 'Живое общение сегодня важнее любой задачи — не торопись.',
    trapWarning: 'Не уходи в телефон во время разговора.',
    confidence: 'medium',
    likelyScore: 'yes', strengthScore: 'yes', trapScore: 'yes',
    comment: 'хороший вечер, давно так не отдыхал',
  },
  {
    mood: 1, focus: 'people',
    context: 'конфликт с коллегой вчера, сегодня снова видеться, не хочу',
    dayType: 'День чужого влияния',
    likelyEvent: 'Ты будешь заранее готовиться к столкновению, которого может не быть.',
    strengthPoint: 'Скажи прямо и коротко — длинные объяснения сейчас не помогут.',
    trapWarning: 'Не интерпретируй молчание как враждебность.',
    confidence: 'high',
    likelyScore: 'partial', strengthScore: 'no', trapScore: 'yes',
    comment: 'коллега вёл себя нормально, я зря накрутил себя',
  },
  {
    mood: 3, focus: 'rest',
    context: 'выходной, планирую ничего не делать',
    dayType: 'День тихой перезагрузки',
    likelyEvent: 'В какой-то момент захочется сделать «хоть что-то полезное» — сопротивляйся.',
    strengthPoint: 'Настоящий отдых сегодня — это инвестиция в следующую неделю.',
    trapWarning: 'Не превращай отдых в список дел.',
    confidence: 'medium',
    likelyScore: 'yes', strengthScore: 'partial', trapScore: 'yes',
    comment: null,
  },
  {
    mood: 4, focus: 'work',
    context: 'новый проект начинается, интересно',
    dayType: 'День открытого начала',
    likelyEvent: 'Первые несколько часов пройдут в исследовании — это нормально.',
    strengthPoint: 'Твой свежий взгляд сегодня ценнее опыта — задавай вопросы.',
    trapWarning: 'Не пытайся сразу всё понять — позволь информации накопиться.',
    confidence: 'medium',
    likelyScore: 'yes', strengthScore: 'yes', trapScore: 'partial',
    comment: 'задавал вопросы, команда оценила',
  },
  {
    mood: 2, focus: 'people',
    context: 'накрывает, не вывожу людей сегодня',
    dayType: 'День социального истощения',
    likelyEvent: 'Любое взаимодействие с людьми будет стоить больше ресурса, чем обычно.',
    strengthPoint: 'Сократи встречи до минимума — всё важное можно написать.',
    trapWarning: 'Не давай обещаний сегодня — завтра пожалеешь.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'yes', trapScore: 'yes',
    comment: 'один из худших дней за неделю, хорошо что предупредило',
  },
  {
    mood: 3, focus: 'self_focus',
    context: 'обычный день, ничего особенного',
    dayType: 'День ровного хода',
    likelyEvent: 'День пройдёт предсказуемо — без взлётов и падений.',
    strengthPoint: 'Хороший момент для задач, которые требуют усидчивости.',
    trapWarning: 'Не путай спокойствие со скукой — иногда ровный день — это лучшее что есть.',
    confidence: 'low',
    likelyScore: 'yes', strengthScore: 'partial', trapScore: 'no',
    comment: null,
  },
  {
    mood: 5, focus: 'energy',
    context: 'хорошее настроение, погода отличная, поел нормально',
    dayType: 'День лёгкости',
    likelyEvent: 'Сегодня ты можешь сделать то, что обычно кажется сложным.',
    strengthPoint: 'Используй подъём для разговора, который давно откладывал.',
    trapWarning: 'Не переоценивай своё состояние — одного хорошего дня мало для больших решений.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'yes', trapScore: 'partial',
    comment: 'отличный день, даже поговорил с тем человеком наконец',
  },
  {
    mood: 3, focus: 'tension',
    context: 'жду важного ответа, немного нервничаю',
    dayType: 'День ожидания',
    likelyEvent: 'Мысли будут возвращаться к тому, что ждёшь — несколько раз в час.',
    strengthPoint: 'Чем больше ты занят руками — тем меньше думаешь.',
    trapWarning: 'Не проверяй почту каждые 10 минут — это усиливает тревогу, не уменьшает.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'no', trapScore: 'yes',
    comment: 'реально проверял почту постоянно, предупреждение было в точку',
  },
  {
    mood: 4, focus: 'control',
    context: 'сдал проект, теперь надо разобраться с накопившимся',
    dayType: 'День разбора',
    likelyEvent: 'Накопившееся окажется меньше, чем ты думал — начни и убедишься.',
    strengthPoint: 'Расставь приоритеты с утра — иначе потратишь день на срочное, а не важное.',
    trapWarning: 'Не начинай новое, пока не закрыл старое.',
    confidence: 'medium',
    likelyScore: 'partial', strengthScore: 'yes', trapScore: 'partial',
    comment: null,
  },
  {
    mood: 3, focus: 'people',
    context: 'созвон с командой и встреча с клиентом в один день',
    dayType: 'День насыщенного общения',
    likelyEvent: 'К вечеру будешь ощущать лёгкую пустоту от большого количества слов.',
    strengthPoint: 'Делай паузы между встречами — даже 5 минут в тишине восстанавливают.',
    trapWarning: 'Не соглашайся на дополнительные встречи — сегодня лимит уже у предела.',
    confidence: 'high',
    likelyScore: 'yes', strengthScore: 'partial', trapScore: 'yes',
    comment: 'к вечеру реально опустошение, завтра надо меньше общаться',
  },
];

// ─── Script ───────────────────────────────────────────────────────────────────

async function seed() {
  const today = new Date();

  // Delete existing checkins/predictions/reviews for this user (keep today's if exists)
  const existingToday = await prisma.dailyCheckin.findUnique({
    where: {
      userId_date: {
        userId: USER_ID,
        date: today.toISOString().slice(0, 10),
      },
    },
  });

  // Remove all past records (not today)
  const checkinsToDelete = await prisma.dailyCheckin.findMany({
    where: {
      userId: USER_ID,
      date: { not: today.toISOString().slice(0, 10) },
    },
    select: { id: true },
  });

  if (checkinsToDelete.length > 0) {
    await prisma.dailyCheckin.deleteMany({
      where: { id: { in: checkinsToDelete.map((c: { id: string }) => c.id) } },
    });
    console.log(`Deleted ${checkinsToDelete.length} old records`);
  }

  let created = 0;

  for (let i = 0; i < DAYS.length; i++) {
    const day = DAYS[i];
    // Day 0 = 14 days ago, day 13 = yesterday
    const date = new Date(today);
    date.setDate(today.getDate() - (DAYS.length - i));
    const dateStr = date.toISOString().slice(0, 10);

    // Skip today if already exists
    if (dateStr === today.toISOString().slice(0, 10) && existingToday) continue;

    // Create checkin
    const checkin = await prisma.dailyCheckin.create({
      data: {
        userId: USER_ID,
        date: dateStr,
        mood: day.mood,
        focus: day.focus,
        contextText: day.context,
      },
    });

    // Create prediction
    const prediction = await prisma.prediction.create({
      data: {
        userId: USER_ID,
        checkinId: checkin.id,
        date: dateStr,
        dayType: day.dayType,
        likelyEvent: day.likelyEvent,
        strengthPoint: day.strengthPoint,
        trapWarning: day.trapWarning,
        confidence: day.confidence,
        modelVersion: 'gpt-4.1-mini',
        generatedFrom: { mood: day.mood, focus: day.focus },
      },
    });

    // Create review
    const accuracyScore =
      (['yes','partial','no'].indexOf(day.likelyScore) === 0 ? 1 : ['yes','partial','no'].indexOf(day.likelyScore) === 1 ? 0.5 : 0) / 3 +
      (['yes','partial','no'].indexOf(day.strengthScore) === 0 ? 1 : ['yes','partial','no'].indexOf(day.strengthScore) === 1 ? 0.5 : 0) / 3 +
      (['yes','partial','no'].indexOf(day.trapScore) === 0 ? 1 : ['yes','partial','no'].indexOf(day.trapScore) === 1 ? 0.5 : 0) / 3;

    await prisma.review.create({
      data: {
        userId: USER_ID,
        predictionId: prediction.id,
        date: dateStr,
        likelyEventScore: day.likelyScore,
        strengthPointScore: day.strengthScore,
        trapWarningScore: day.trapScore,
        comment: day.comment,
        accuracyScore,
      },
    });

    created++;
    console.log(`✓ ${dateStr} — ${day.dayType} (accuracy: ${(accuracyScore * 100).toFixed(0)}%)`);
  }

  console.log(`\n✦ Done: created ${created} days of history`);
  await prisma.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
