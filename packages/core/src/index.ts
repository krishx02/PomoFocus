// Pure domain logic: timer, goals, sessions, sync protocol.
// No IO, no React, no Supabase imports.
export { GOAL_STATUS, RECURRENCE_TYPE } from './goals/index.js';
export type {
  GoalStatus,
  RecurrenceType,
  LongTermGoal,
  ProcessGoal,
  StreakResult,
  GoalProgress,
  ValidationResult,
  ProcessGoalInput,
  LongTermGoalInput,
} from './goals/index.js';
export { validateIntention, validateProcessGoal, validateLongTermGoal } from './goals/index.js';
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
