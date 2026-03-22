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
export { QUEUE_ITEM_STATUS, SYNC_EVENT_TYPE, processQueue, createEmptyQueue } from './sync/index.js';
export type {
  QueueItemStatus,
  QueueItemState,
  SyncEventType,
  SyncEvent,
  SyncableEntityType,
  OutboxEntry,
  OutboxQueue,
  RetryPolicy,
} from './sync/index.js';
export type { SessionData, SessionReflection } from './session/index.js';
