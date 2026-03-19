// Zustand stores + TanStack Query hooks.
// Depends on core, data-access, types.
// Re-exports from immediate children only (U-014).
export { useTimerStore, createTimerStore, startTimer, stopTimer } from './timer/index.js';
export type { TimerStore, TimerStoreInstance } from './timer/index.js';
export { useSessions, sessionsQueryOptions, useCreateSession } from './hooks/index.js';
export { createQueryClient } from './query-client.js';
export { QueryProvider } from './providers.js';
