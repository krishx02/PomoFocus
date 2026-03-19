import { Text, View } from 'react-native';
import { useTimerStore } from '@pomofocus/state';
import { TIMER_STATUS } from '@pomofocus/core';
import type { TimerStatus, TimerState } from '@pomofocus/core';

/** Formats seconds as mm:ss (e.g., 1500 -> "25:00", 299 -> "04:59"). */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const STATUS_LABELS = {
  [TIMER_STATUS.IDLE]: 'Ready',
  [TIMER_STATUS.FOCUSING]: 'Focusing',
  [TIMER_STATUS.PAUSED]: 'Paused',
  [TIMER_STATUS.SHORT_BREAK]: 'Short Break',
  [TIMER_STATUS.LONG_BREAK]: 'Long Break',
  [TIMER_STATUS.BREAK_PAUSED]: 'Break Paused',
  [TIMER_STATUS.REFLECTION]: 'Reflection',
  [TIMER_STATUS.COMPLETED]: 'Completed',
  [TIMER_STATUS.ABANDONED]: 'Abandoned',
} as const satisfies Record<TimerStatus, string>;

function getDisplaySeconds(state: TimerState): number {
  switch (state.status) {
    case TIMER_STATUS.IDLE:
      return state.config.focusDuration;
    case TIMER_STATUS.FOCUSING:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.SHORT_BREAK:
    case TIMER_STATUS.LONG_BREAK:
    case TIMER_STATUS.BREAK_PAUSED:
      return state.timeRemaining;
    case TIMER_STATUS.REFLECTION:
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return 0;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function getSessionNumber(state: TimerState): number | undefined {
  switch (state.status) {
    case TIMER_STATUS.IDLE:
      return undefined;
    case TIMER_STATUS.FOCUSING:
    case TIMER_STATUS.PAUSED:
    case TIMER_STATUS.SHORT_BREAK:
    case TIMER_STATUS.LONG_BREAK:
    case TIMER_STATUS.BREAK_PAUSED:
    case TIMER_STATUS.REFLECTION:
    case TIMER_STATUS.COMPLETED:
    case TIMER_STATUS.ABANDONED:
      return state.sessionNumber;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function TimerDisplay(): React.JSX.Element {
  const timerState = useTimerStore((s) => s.state);

  const displaySeconds = getDisplaySeconds(timerState);
  const sessionNumber = getSessionNumber(timerState);

  return (
    <View testID="timer-display">
      <Text testID="timer-status">{STATUS_LABELS[timerState.status]}</Text>
      <Text testID="timer-countdown">{formatTime(displaySeconds)}</Text>
      {sessionNumber !== undefined && (
        <Text testID="timer-session-number">Session {sessionNumber}</Text>
      )}
    </View>
  );
}
