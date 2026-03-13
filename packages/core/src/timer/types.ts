import type { FocusQuality, DistractionType } from '@pomofocus/types';

// ── Timer Configuration ──

export type TimerConfig = {
  workDurationMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
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
  | { status: 'idle'; config: TimerConfig }
  | {
      status: 'focusing';
      timeRemaining: number;
      startedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: 'paused';
      timeRemaining: number;
      pausedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: 'short_break';
      timeRemaining: number;
      startedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: 'long_break';
      timeRemaining: number;
      startedAt: number;
      sessionNumber: number;
      config: TimerConfig;
    }
  | {
      status: 'break_paused';
      timeRemaining: number;
      pausedAt: number;
      breakType: 'short' | 'long';
      sessionNumber: number;
      config: TimerConfig;
    }
  | { status: 'reflection'; sessionNumber: number; config: TimerConfig }
  | { status: 'completed'; sessionNumber: number; reflectionData?: ReflectionData }
  | { status: 'abandoned'; sessionNumber: number; abandonedAt: number };

// ── Timer Events (10 event types per ADR-004) ──

export type TimerEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TICK' }
  | { type: 'TIMER_DONE' }
  | { type: 'SKIP' }
  | { type: 'SUBMIT'; data: ReflectionData }
  | { type: 'SKIP_BREAK' }
  | { type: 'ABANDON' }
  | { type: 'RESET' };
