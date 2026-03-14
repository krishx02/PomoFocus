import type { TimerConfig } from './types.js';

export function isLongBreak(sessionNumber: number, config: TimerConfig): boolean {
  return sessionNumber % config.sessionsBeforeLongBreak === 0;
}

export function isReflectionEnabled(config: TimerConfig): boolean {
  return config.reflectionEnabled;
}
