import type { FocusQuality, DistractionType } from '@pomofocus/types';

// ── Timer Status (as const object per U-010) ──

export const TIMER_STATUS = {
  IDLE: 'idle',
  FOCUSING: 'focusing',
  PAUSED: 'paused',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break',
  BREAK_PAUSED: 'break_paused',
  REFLECTION: 'reflection',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
} as const;

export type TimerStatus = (typeof TIMER_STATUS)[keyof typeof TIMER_STATUS];

// ── Timer Event Type (as const object per U-010) ──

export const TIMER_EVENT_TYPE = {
  START: 'START',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  TICK: 'TICK',
  TIMER_DONE: 'TIMER_DONE',
  SKIP: 'SKIP',
  SUBMIT: 'SUBMIT',
  SKIP_BREAK: 'SKIP_BREAK',
  ABANDON: 'ABANDON',
  RESET: 'RESET',
} as const;

export type TimerEventType = (typeof TIMER_EVENT_TYPE)[keyof typeof TIMER_EVENT_TYPE];

// ── Timer Configuration ──

export type TimerConfig = {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  reflectionEnabled: boolean;
};

// ── Reflection Data ──

export type ReflectionData = {
  focusQuality: FocusQuality;
  distractionType?: DistractionType;
};

// ── Timer State (discriminated union, 9 variants) ──

export type TimerState =
  | { status: typeof TIMER_STATUS.IDLE; config: TimerConfig }
  | {
      status: typeof TIMER_STATUS.FOCUSING;
      timeRemaining: number;
      startedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: typeof TIMER_STATUS.PAUSED;
      timeRemaining: number;
      pausedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: typeof TIMER_STATUS.SHORT_BREAK;
      timeRemaining: number;
      startedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: typeof TIMER_STATUS.LONG_BREAK;
      timeRemaining: number;
      startedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: typeof TIMER_STATUS.BREAK_PAUSED;
      timeRemaining: number;
      pausedAt: number;
      breakType: 'short' | 'long';
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: typeof TIMER_STATUS.REFLECTION;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: typeof TIMER_STATUS.COMPLETED;
      sessionNumber: number;
      reflectionData?: ReflectionData;
    }
  | {
      status: typeof TIMER_STATUS.ABANDONED;
      sessionNumber: number;
      abandonedAt: number;
    };

// ── Timer Events (10 event types per ADR-004) ──

export type TimerEvent =
  | { type: typeof TIMER_EVENT_TYPE.START }
  | { type: typeof TIMER_EVENT_TYPE.PAUSE }
  | { type: typeof TIMER_EVENT_TYPE.RESUME }
  | { type: typeof TIMER_EVENT_TYPE.TICK }
  | { type: typeof TIMER_EVENT_TYPE.TIMER_DONE }
  | { type: typeof TIMER_EVENT_TYPE.SKIP }
  | { type: typeof TIMER_EVENT_TYPE.SUBMIT; data: ReflectionData }
  | { type: typeof TIMER_EVENT_TYPE.SKIP_BREAK }
  | { type: typeof TIMER_EVENT_TYPE.ABANDON }
  | { type: typeof TIMER_EVENT_TYPE.RESET };
