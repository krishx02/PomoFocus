import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { StoreApi } from 'zustand';
import type { UseBoundStore } from 'zustand';
import type { TimerState, ReflectionData, TimerConfig } from '@pomofocus/core';
import {
  transition,
  createInitialState,
  TIMER_EVENT_TYPE,
} from '@pomofocus/core';

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

export type TimerStoreInstance = UseBoundStore<StoreApi<TimerStore>>;

export function createTimerStore(config: TimerConfig = DEFAULT_CONFIG): TimerStoreInstance {
  return create<TimerStore>()(
    devtools(
      (set) => ({
        state: createInitialState(config),

        start: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.START }, Date.now()),
            }),
            false,
            'timer/start',
          );
        },

        pause: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.PAUSE }, Date.now()),
            }),
            false,
            'timer/pause',
          );
        },

        resume: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.RESUME }, Date.now()),
            }),
            false,
            'timer/resume',
          );
        },

        abandon: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.ABANDON }, Date.now()),
            }),
            false,
            'timer/abandon',
          );
        },

        reset: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.RESET }, Date.now()),
            }),
            false,
            'timer/reset',
          );
        },

        tick: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.TICK }, Date.now()),
            }),
            false,
            'timer/tick',
          );
        },

        timerDone: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.TIMER_DONE }, Date.now()),
            }),
            false,
            'timer/timerDone',
          );
        },

        skipBreak: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.SKIP_BREAK }, Date.now()),
            }),
            false,
            'timer/skipBreak',
          );
        },

        submitReflection: (data: ReflectionData): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.SUBMIT, data }, Date.now()),
            }),
            false,
            'timer/submitReflection',
          );
        },

        skipReflection: (): void => {
          set(
            (store) => ({
              state: transition(store.state, { type: TIMER_EVENT_TYPE.SKIP }, Date.now()),
            }),
            false,
            'timer/skipReflection',
          );
        },
      }),
      { name: 'TimerStore' },
    ),
  );
}

// ── Singleton Instance ──

export const useTimerStore = createTimerStore();
