import { TIMER_STATUS } from './types.js';
import type { TimerConfig, TimerState, ReflectionData } from './types.js';

// ── Serialization Version ──

export const SERIALIZATION_VERSION = 1;

// ── Serialized Shape ──

export type SerializedTimerState = {
  version: number;
  state: TimerState;
};

// ── Serialize ──

export function serializeState(state: TimerState): SerializedTimerState {
  return {
    version: SERIALIZATION_VERSION,
    state,
  };
}

// ── Deserialize ──

export function deserializeState(data: unknown): TimerState | null {
  if (!isRecord(data)) return null;

  const version = data['version'];
  if (typeof version !== 'number') return null;

  // Future: add migration handlers for older versions here
  if (version !== SERIALIZATION_VERSION) return null;

  const state = data['state'];
  if (!isRecord(state)) return null;

  return validateTimerState(state);
}

// ── Type Guard Helpers ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidTimerConfig(value: unknown): value is TimerConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value['focusDuration'] === 'number' &&
    typeof value['shortBreakDuration'] === 'number' &&
    typeof value['longBreakDuration'] === 'number' &&
    typeof value['sessionsBeforeLongBreak'] === 'number' &&
    typeof value['reflectionEnabled'] === 'boolean'
  );
}

const VALID_FOCUS_QUALITIES = new Set([
  'locked_in',
  'decent',
  'struggled',
]);

const VALID_DISTRACTION_TYPES = new Set([
  'phone',
  'people',
  'thoughts_wandering',
  'got_stuck',
  'other',
]);

function isValidReflectionData(value: unknown): value is ReflectionData {
  if (!isRecord(value)) return false;
  if (typeof value['focusQuality'] !== 'string') return false;
  if (!VALID_FOCUS_QUALITIES.has(value['focusQuality'])) return false;

  if (value['distractionType'] !== undefined) {
    if (typeof value['distractionType'] !== 'string') return false;
    if (!VALID_DISTRACTION_TYPES.has(value['distractionType'])) return false;
  }

  return true;
}

const VALID_STATUSES = new Set(Object.values(TIMER_STATUS));

function validateTimerState(data: Record<string, unknown>): TimerState | null {
  const status = data['status'];
  if (typeof status !== 'string') return null;
  if (!VALID_STATUSES.has(status as TimerState['status'])) return null;

  const config = data['config'];
  if (!isValidTimerConfig(config)) return null;

  switch (status) {
    case TIMER_STATUS.IDLE:
      return { status, config };

    case TIMER_STATUS.FOCUSING:
      if (typeof data['timeRemaining'] !== 'number') return null;
      if (typeof data['startedAt'] !== 'number') return null;
      if (typeof data['sessionNumber'] !== 'number') return null;
      return {
        status,
        timeRemaining: data['timeRemaining'],
        startedAt: data['startedAt'],
        sessionNumber: data['sessionNumber'],
        config,
      };

    case TIMER_STATUS.PAUSED:
      if (typeof data['timeRemaining'] !== 'number') return null;
      if (typeof data['pausedAt'] !== 'number') return null;
      if (typeof data['sessionNumber'] !== 'number') return null;
      return {
        status,
        timeRemaining: data['timeRemaining'],
        pausedAt: data['pausedAt'],
        sessionNumber: data['sessionNumber'],
        config,
      };

    case TIMER_STATUS.SHORT_BREAK:
      if (typeof data['timeRemaining'] !== 'number') return null;
      if (typeof data['startedAt'] !== 'number') return null;
      if (typeof data['sessionNumber'] !== 'number') return null;
      return {
        status,
        timeRemaining: data['timeRemaining'],
        startedAt: data['startedAt'],
        sessionNumber: data['sessionNumber'],
        config,
      };

    case TIMER_STATUS.LONG_BREAK:
      if (typeof data['timeRemaining'] !== 'number') return null;
      if (typeof data['startedAt'] !== 'number') return null;
      if (typeof data['sessionNumber'] !== 'number') return null;
      return {
        status,
        timeRemaining: data['timeRemaining'],
        startedAt: data['startedAt'],
        sessionNumber: data['sessionNumber'],
        config,
      };

    case TIMER_STATUS.BREAK_PAUSED:
      if (typeof data['timeRemaining'] !== 'number') return null;
      if (typeof data['pausedAt'] !== 'number') return null;
      if (data['breakType'] !== 'short' && data['breakType'] !== 'long') return null;
      if (typeof data['sessionNumber'] !== 'number') return null;
      return {
        status,
        timeRemaining: data['timeRemaining'],
        pausedAt: data['pausedAt'],
        breakType: data['breakType'],
        sessionNumber: data['sessionNumber'],
        config,
      };

    case TIMER_STATUS.REFLECTION:
      if (typeof data['sessionNumber'] !== 'number') return null;
      return {
        status,
        sessionNumber: data['sessionNumber'],
        config,
      };

    case TIMER_STATUS.COMPLETED: {
      if (typeof data['sessionNumber'] !== 'number') return null;
      const reflectionData = data['reflectionData'];
      if (reflectionData !== undefined) {
        if (!isValidReflectionData(reflectionData)) return null;
        return {
          status,
          sessionNumber: data['sessionNumber'],
          config,
          reflectionData,
        };
      }
      return {
        status,
        sessionNumber: data['sessionNumber'],
        config,
      };
    }

    case TIMER_STATUS.ABANDONED:
      if (typeof data['sessionNumber'] !== 'number') return null;
      if (typeof data['abandonedAt'] !== 'number') return null;
      return {
        status,
        sessionNumber: data['sessionNumber'],
        abandonedAt: data['abandonedAt'],
        config,
      };

    default:
      return null;
  }
}
