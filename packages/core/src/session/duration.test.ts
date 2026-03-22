import { describe, it, expect } from 'vitest';
import { calculatePartialDuration } from './duration.js';

describe('calculatePartialDuration', () => {
  it('returns the difference between abandonedAt and startedAt', () => {
    expect(calculatePartialDuration(1000, 2500)).toBe(1500);
  });

  it('returns zero when startedAt equals abandonedAt', () => {
    expect(calculatePartialDuration(5000, 5000)).toBe(0);
  });

  it('returns zero when abandonedAt is before startedAt (clamps negative)', () => {
    expect(calculatePartialDuration(3000, 1000)).toBe(0);
  });

  it('handles large timestamps (realistic epoch ms)', () => {
    const startedAt = 1711100000000; // realistic epoch ms
    const abandonedAt = 1711100900000; // 900 seconds later
    expect(calculatePartialDuration(startedAt, abandonedAt)).toBe(900_000);
  });

  it('returns correct duration for a short focus session', () => {
    // 5 minutes of focus = 300_000 ms
    expect(calculatePartialDuration(0, 300_000)).toBe(300_000);
  });
});
