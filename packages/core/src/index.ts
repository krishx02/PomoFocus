// Pure domain logic: timer, goals, sessions, sync protocol.
// No IO, no React, no Supabase imports.
export type { StreakResult, GoalProgress } from './goals/index.js';
export { TIMER_STATUS, TIMER_EVENT_TYPE, createInitialState, isRunning, getTimeRemaining, transition } from './timer/index.js';
export type {
  TimerStatus,
  TimerEventType,
  TimerConfig,
  ReflectionData,
  TimerState,
  TimerEvent,
} from './timer/index.js';
export type { QueueItemState, SyncEvent, RetryPolicy, SyncableEntityType } from './sync/index.js';
export type { SessionData, SessionReflection } from './session/index.js';
