import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StoreApi } from 'zustand';
import type { UseBoundStore } from 'zustand';
import type { TimerState, ReflectionData, TimerConfig } from '@pomofocus/core';
import {
  transition,
  createInitialState,
  serializeState,
  deserializeState,
  rehydrate,
  TIMER_EVENT_TYPE,
} from '@pomofocus/core';

// ── Persistence ──

export const TIMER_STORAGE_KEY = 'pomofocus:timer-state';

export type TimerStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function loadInitialState(config: TimerConfig, storage: TimerStorage | null, now: number): TimerState {
  if (storage === null) return createInitialState(config);

  const raw = storage.getItem(TIMER_STORAGE_KEY);
  if (raw === null) return createInitialState(config);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(TIMER_STORAGE_KEY);
    return createInitialState(config);
  }

  const deserialized = deserializeState(parsed);
  if (deserialized === null) {
    storage.removeItem(TIMER_STORAGE_KEY);
    return createInitialState(config);
  }

  const { state } = rehydrate(deserialized, now);
  return state;
}

function persistState(state: TimerState, storage: TimerStorage | null): void {
  if (storage === null) return;
  const serialized = serializeState(state);
  storage.setItem(TIMER_STORAGE_KEY, JSON.stringify(serialized));
}

// ── Store Shape ──

type TimerActions = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  abandon: () => void;
  reset: () => void;
  tick: () => void;
  timerDone: () => void;
  skipBreak: () => void;
  submitReflection: (data: ReflectionData) => void;
  skipReflection: () => void;
};

export type TimerStore = {
  state: TimerState;
} & TimerActions;

// ── Default Config ──

const DEFAULT_CONFIG: TimerConfig = {
  focusDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  sessionsBeforeLongBreak: 4,
  reflectionEnabled: true,
};

// ── Store Factory ──

export type TimerStoreOptions = {
  config?: TimerConfig;
  storage?: TimerStorage | null;
  now?: number;
};

export type TimerStoreInstance = UseBoundStore<StoreApi<TimerStore>>;

export function createTimerStore(options: TimerStoreOptions = {}): TimerStoreInstance {
  const config = options.config ?? DEFAULT_CONFIG;
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const now = options.now ?? Date.now();

  const initialState = loadInitialState(config, storage, now);

  const store = create<TimerStore>()(
    devtools(
      (set) => ({
        state: initialState,

        start: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.START }, Date.now()),
            }),
            false,
            'timer/start',
          );
        },

        pause: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.PAUSE }, Date.now()),
            }),
            false,
            'timer/pause',
          );
        },

        resume: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.RESUME }, Date.now()),
            }),
            false,
            'timer/resume',
          );
        },

        abandon: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.ABANDON }, Date.now()),
            }),
            false,
            'timer/abandon',
          );
        },

        reset: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.RESET }, Date.now()),
            }),
            false,
            'timer/reset',
          );
        },

        tick: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.TICK }, Date.now()),
            }),
            false,
            'timer/tick',
          );
        },

        timerDone: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, Date.now()),
            }),
            false,
            'timer/timerDone',
          );
        },

        skipBreak: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, Date.now()),
            }),
            false,
            'timer/skipBreak',
          );
        },

        submitReflection: (data: ReflectionData): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.SUBMIT, data }, Date.now()),
            }),
            false,
            'timer/submitReflection',
          );
        },

        skipReflection: (): void => {
          set(
            (s) => ({
              state: transition(s.state, { type: TIMER_EVENT_TYPE.SKIP }, Date.now()),
            }),
            false,
            'timer/skipReflection',
          );
        },
      }),
      { name: 'TimerStore' },
    ),
  );

  // Subscribe to persist state on every change
  if (storage !== null) {
    store.subscribe((current) => {
      persistState(current.state, storage);
    });
  }

  return store;
}

function isTimerStorage(value: unknown): value is TimerStorage {
  return (
    value != null &&
    typeof (value as TimerStorage).getItem === 'function' &&
    typeof (value as TimerStorage).setItem === 'function' &&
    typeof (value as TimerStorage).removeItem === 'function'
  );
}

function getDefaultStorage(): TimerStorage | null {
  try {
    // localStorage may not exist at runtime (Node.js, sandboxed contexts).
    // Use 'in' check to avoid TypeScript assuming globalThis.localStorage is always Storage.
    if ('localStorage' in globalThis && isTimerStorage(globalThis.localStorage)) {
      return globalThis.localStorage;
    }
  } catch {
    // localStorage access may throw in sandboxed contexts
  }
  return null;
}

// ── Singleton Instance ──

export const useTimerStore = createTimerStore();
