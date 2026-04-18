/**
 * Re-generates all prediction texts via OpenAI using the improved prompts.
 * Updates predictions IN PLACE — same IDs, reviews untouched.
 * Run: tsx src/regen.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { generatePredictionLLM } from './services/prediction.service.js';

const prisma = new PrismaClient();
const USER_ID = 'cmo4o1tia0000501ek25zv48v';

async function regen() {
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  if (!user) throw new Error('User not found');

  const predictions = await prisma.prediction.findMany({
    where: { userId: USER_ID },
    orderBy: { date: 'asc' },
    include: { checkin: true },
  });

  console.log(`Found ${predictions.length} predictions to regenerate\n`);

  for (const pred of predictions) {
    const checkin = pred.checkin;
    if (!checkin) { console.log(`⚠ Skip ${pred.date} — no checkin`); continue; }

    process.stdout.write(`Generating ${pred.date} (${pred.dayType}) → `);

    try {
      const llm = await generatePredictionLLM({
        preferredTone: user.preferredTone as 'gentle' | 'neutral' | 'sharp',
        gender: user.gender,
        birthDate: user.birthDate,
        profileSummary: user.profileSummary,
        today: {
          mood: checkin.mood as 1 | 2 | 3 | 4 | 5,
          focus: checkin.focus as
            | 'work'
            | 'people'
            | 'energy'
            | 'emotions'
            | 'tension'
            | 'control'
            | 'rest'
            | 'self_focus',
          contextText: checkin.contextText ?? '',
        },
        recentHistory: [], // no history context needed for regeneration
      });

      await prisma.prediction.update({
        where: { id: pred.id },
        data: {
          dayType: llm.dayType,
          likelyEvent: llm.likelyEvent,
          strengthPoint: llm.strengthPoint,
          trapWarning: llm.trapWarning,
          confidence: llm.confidence,
          modelVersion: llm.modelVersion,
        },
      });

      console.log(`✓ ${llm.dayType}`);
    } catch (err) {
      console.log(`✗ Error: ${(err as Error).message}`);
    }
  }

  // Clear all LLM caches so they regenerate with new content
  await prisma.user.update({
    where: { id: USER_ID },
    data: {
      weeklyPatternsCache: null,
      patternCards: null,
      patternCardsUpdatedAt: null,
      profileSummary: null,
      profileUpdatedAt: null,
    },
  });

  console.log('\n✦ All caches cleared — will regenerate on next visit');
  await prisma.$disconnect();
}

regen().catch((e) => { console.error(e); process.exit(1); });
