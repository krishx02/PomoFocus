import { describe, it, expect } from 'vitest';
import { isLongBreak, isReflectionEnabled } from './guards.js';
import type { TimerConfig } from './types.js';

const defaultConfig: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

describe('isLongBreak', () => {
  describe('with sessionsBeforeLongBreak = 4', () => {
    it('returns false for session 1', () => {
      expect(isLongBreak(1, defaultConfig)).toBe(false);
    });

    it('returns false for session 2', () => {
      expect(isLongBreak(2, defaultConfig)).toBe(false);
    });

    it('returns false for session 3 (N-1)', () => {
      expect(isLongBreak(3, defaultConfig)).toBe(false);
    });

    it('returns true for session 4 (N)', () => {
      expect(isLongBreak(4, defaultConfig)).toBe(true);
    });

    it('returns false for session 5', () => {
      expect(isLongBreak(5, defaultConfig)).toBe(false);
    });

    it('returns true for session 8 (2N)', () => {
      expect(isLongBreak(8, defaultConfig)).toBe(true);
    });

    it('returns true for session 0', () => {
      expect(isLongBreak(0, defaultConfig)).toBe(true);
    });
  });

  describe('with sessionsBeforeLongBreak = 1', () => {
    const config: TimerConfig = { ...defaultConfig, sessionsBeforeLongBreak: 1 };

    it('returns true for every session number', () => {
      expect(isLongBreak(0, config)).toBe(true);
      expect(isLongBreak(1, config)).toBe(true);
      expect(isLongBreak(2, config)).toBe(true);
      expect(isLongBreak(5, config)).toBe(true);
    });
  });

  describe('with sessionsBeforeLongBreak = 6', () => {
    const config: TimerConfig = { ...defaultConfig, sessionsBeforeLongBreak: 6 };

    it('returns false for session 1', () => {
      expect(isLongBreak(1, config)).toBe(false);
    });

    it('returns false for session 5 (N-1)', () => {
      expect(isLongBreak(5, config)).toBe(false);
    });

    it('returns true for session 6 (N)', () => {
      expect(isLongBreak(6, config)).toBe(true);
    });

    it('returns true for session 12 (2N)', () => {
      expect(isLongBreak(12, config)).toBe(true);
    });

    it('returns false for session 7', () => {
      expect(isLongBreak(7, config)).toBe(false);
    });
  });
});

describe('isReflectionEnabled', () => {
  it('returns true when reflectionEnabled is true', () => {
    const config: TimerConfig = { ...defaultConfig, reflectionEnabled: true };
    expect(isReflectionEnabled(config)).toBe(true);
  });

  it('returns false when reflectionEnabled is false', () => {
    const config: TimerConfig = { ...defaultConfig, reflectionEnabled: false };
    expect(isReflectionEnabled(config)).toBe(false);
  });
});
