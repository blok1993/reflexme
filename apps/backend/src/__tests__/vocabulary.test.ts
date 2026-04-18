import { describe, it, expect } from 'vitest';
import { analyzeVocabulary } from '../services/vocabulary.service.js';

describe('analyzeVocabulary', () => {
  it('returns empty array for empty input', () => {
    expect(analyzeVocabulary([])).toEqual([]);
  });

  it('returns empty array for all-null texts', () => {
    expect(analyzeVocabulary([null, null, undefined])).toEqual([]);
  });

  it('filters stop words', () => {
    const result = analyzeVocabulary(['я не хочу идти', 'не хочу вообще']);
    // 'хочу' appears twice and is not in stop words by default — check it appears
    const words = result.map((w) => w.word);
    expect(words).not.toContain('не');
    expect(words).not.toContain('я');
  });

  it('filters words shorter than 3 chars', () => {
    const result = analyzeVocabulary(['да нет ну вот', 'да нет ну вот']);
    const words = result.map((w) => w.word);
    expect(words).not.toContain('да');
    expect(words).not.toContain('нет'); // also a stop word
  });

  it('counts word frequency correctly', () => {
    const texts = [
      'тяжело встреча созвон',
      'тяжело встреча работа',
      'тяжело работа задача',
    ];
    const result = analyzeVocabulary(texts);
    const тяжело = result.find((w) => w.word === 'тяжело');
    expect(тяжело?.count).toBe(3);
    const встреча = result.find((w) => w.word === 'встреча');
    expect(встреча?.count).toBe(2);
  });

  it('only includes words appearing 2+ times', () => {
    const texts = ['уникальное слово здесь', 'другое слово тут'];
    const result = analyzeVocabulary(texts);
    // 'слово' appears twice in these two texts → should be included
    const слово = result.find((w) => w.word === 'слово');
    expect(слово).toBeDefined();
    // 'уникальное' appears only once → should not be included
    const уникальное = result.find((w) => w.word === 'уникальное');
    expect(уникальное).toBeUndefined();
  });

  it('returns results sorted by count descending', () => {
    const texts = [
      'стресс стресс стресс работа',
      'стресс работа созвон',
      'работа созвон задача',
    ];
    const result = analyzeVocabulary(texts);
    if (result.length >= 2) {
      expect(result[0].count).toBeGreaterThanOrEqual(result[1].count);
    }
  });

  it('returns at most 20 words', () => {
    const longText = Array.from({ length: 30 }, (_, i) => `уникальное${i} уникальное${i}`).join(' ');
    const result = analyzeVocabulary([longText]);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('normalises ё to е', () => {
    const texts = ['ещё ещё ещё'];
    // 'ещё' normalises to 'еще' which is in stop words → should be filtered
    const result = analyzeVocabulary(texts);
    expect(result.find((w) => w.word === 'ещё')).toBeUndefined();
    expect(result.find((w) => w.word === 'еще')).toBeUndefined();
  });
});
