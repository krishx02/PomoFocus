import { useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTimerStore, startTimer, stopTimer, useCreateSession } from '@pomofocus/state';
import { TIMER_STATUS } from '@pomofocus/core';
import type { TimerStatus } from '@pomofocus/core';
import { createApiClient } from '@pomofocus/data-access';

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

// ── Button Visibility Rules ──

const SHOW_START: ReadonlySet<TimerStatus> = new Set([
  TIMER_STATUS.IDLE,
]);

const SHOW_PAUSE: ReadonlySet<TimerStatus> = new Set([
  TIMER_STATUS.FOCUSING,
  TIMER_STATUS.SHORT_BREAK,
  TIMER_STATUS.LONG_BREAK,
]);

const SHOW_RESUME: ReadonlySet<TimerStatus> = new Set([
  TIMER_STATUS.PAUSED,
  TIMER_STATUS.BREAK_PAUSED,
]);

const SHOW_ABANDON: ReadonlySet<TimerStatus> = new Set([
  TIMER_STATUS.FOCUSING,
  TIMER_STATUS.PAUSED,
  TIMER_STATUS.SHORT_BREAK,
  TIMER_STATUS.LONG_BREAK,
  TIMER_STATUS.BREAK_PAUSED,
]);

const SHOW_RESET: ReadonlySet<TimerStatus> = new Set([
  TIMER_STATUS.COMPLETED,
  TIMER_STATUS.ABANDONED,
]);

// ── Component ──

export function TimerControls(): React.JSX.Element {
  const status = useTimerStore((s) => s.state.status);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const abandon = useTimerStore((s) => s.abandon);
  const reset = useTimerStore((s) => s.reset);

  const client = useMemo(() => createApiClient(API_BASE_URL), []);
  const createSession = useCreateSession(client);

  // Track whether we've already fired the mutation for this completed state
  // to avoid duplicate calls on re-render.
  const savedRef = useRef(false);

  // Start the timer driver on mount, stop on unmount.
  useEffect(() => {
    startTimer(useTimerStore);
    return () => {
      stopTimer();
    };
  }, []);

  // Save session to API when state reaches completed.
  useEffect(() => {
    if (status === TIMER_STATUS.COMPLETED && !savedRef.current) {
      savedRef.current = true;
      createSession.mutate({
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        focus_quality: 'locked_in',
      });
    } else if (status !== TIMER_STATUS.COMPLETED) {
      savedRef.current = false;
    }
  }, [status, createSession]);

  return (
    <View testID="timer-controls">
      {SHOW_START.has(status) && (
        <Pressable role="button" accessibilityLabel="Start" onPress={start}>
          <Text>Start</Text>
        </Pressable>
      )}
      {SHOW_PAUSE.has(status) && (
        <Pressable role="button" accessibilityLabel="Pause" onPress={pause}>
          <Text>Pause</Text>
        </Pressable>
      )}
      {SHOW_RESUME.has(status) && (
        <Pressable role="button" accessibilityLabel="Resume" onPress={resume}>
          <Text>Resume</Text>
        </Pressable>
      )}
      {SHOW_ABANDON.has(status) && (
        <Pressable role="button" accessibilityLabel="Abandon" onPress={abandon}>
          <Text>Abandon</Text>
        </Pressable>
      )}
      {SHOW_RESET.has(status) && (
        <Pressable role="button" accessibilityLabel="Reset" onPress={reset}>
          <Text>Reset</Text>
        </Pressable>
      )}
    </View>
  );
}
