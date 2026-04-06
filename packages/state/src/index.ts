// Zustand stores + TanStack Query hooks.
// Depends on core, data-access, types.
// Re-exports from immediate children only (U-014).
export { useTimerStore, createTimerStore, startTimer, stopTimer, TIMER_STORAGE_KEY } from './timer/index.js';
export type { TimerStore, TimerStoreInstance, TimerStoreOptions, TimerStorage } from './timer/index.js';
export { useSessions, sessionsQueryOptions, useCreateSession } from './hooks/index.js';
export { createQueryClient } from './query-client.js';
export { QueryProvider } from './providers.js';
export { createAuthStore, useAuth, useUser, useIsAuthenticated, AuthProvider, AuthStoreContext } from './auth/index.js';
export type { AuthStore, AuthStoreInstance, AuthState, AuthActions, AuthOperations, UseAuthReturn, AuthProviderProps } from './auth/index.js';
