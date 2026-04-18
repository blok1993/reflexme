import { describe, it, expect } from 'vitest';
import { scoreValue, calculateAccuracy } from '../routes/index.js';

// ─── scoreValue ───────────────────────────────────────────────────────────────

describe('scoreValue', () => {
  it('returns 1 for "yes"', () => {
    expect(scoreValue('yes')).toBe(1);
  });

  it('returns 0.5 for "partial"', () => {
    expect(scoreValue('partial')).toBe(0.5);
  });

  it('returns 0 for "no"', () => {
    expect(scoreValue('no')).toBe(0);
  });
});

// ─── calculateAccuracy ────────────────────────────────────────────────────────

describe('calculateAccuracy', () => {
  it('returns 1 when all scores are "yes"', () => {
    expect(calculateAccuracy('yes', 'yes', 'yes')).toBe(1);
  });

  it('returns 0 when all scores are "no"', () => {
    expect(calculateAccuracy('no', 'no', 'no')).toBe(0);
  });

  it('returns 0.5 when all scores are "partial"', () => {
    expect(calculateAccuracy('partial', 'partial', 'partial')).toBe(0.5);
  });

  it('calculates mixed correctly: yes + partial + no = (1 + 0.5 + 0) / 3', () => {
    const result = calculateAccuracy('yes', 'partial', 'no');
    expect(result).toBeCloseTo(0.5, 5);
  });

  it('calculates yes + yes + no = 2/3', () => {
    const result = calculateAccuracy('yes', 'yes', 'no');
    expect(result).toBeCloseTo(2 / 3, 5);
  });

  it('result is always between 0 and 1', () => {
    const combos: Array<[string, string, string]> = [
      ['yes', 'no', 'partial'],
      ['no', 'no', 'yes'],
      ['partial', 'yes', 'yes'],
    ];
    for (const [a, b, c] of combos) {
      const r = calculateAccuracy(a as 'yes' | 'partial' | 'no', b as 'yes' | 'partial' | 'no', c as 'yes' | 'partial' | 'no');
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });
});
