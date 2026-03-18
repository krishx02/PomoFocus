import type { TimerConfig } from './types.js';

export function isLongBreak(sessionNumber: number, config: TimerConfig): boolean {
  if (sessionNumber < 1) return false;
  if (config.sessionsBeforeLongBreak < 1) return false;
  return sessionNumber % config.sessionsBeforeLongBreak === 0;
}

export function isReflectionEnabled(config: TimerConfig): boolean {
  return config.reflectionEnabled;
}
