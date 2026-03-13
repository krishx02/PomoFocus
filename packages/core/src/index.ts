// Pure domain logic: timer, goals, sessions, sync protocol.
// No IO, no React, no Supabase imports.
export type { StreakResult, GoalProgress } from './goals/index.js';
export type { TimerConfig, ReflectionData, TimerState, TimerEvent } from './timer/index.js';
