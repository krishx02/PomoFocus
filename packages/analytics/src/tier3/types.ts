import type { DistractionType } from '@pomofocus/types';

/** Result shape for a month-over-month trend comparison. */
export type TrendResult = {
  readonly current: number;
  readonly previous: number;
};

/** Top distraction pattern for a month, or null when no struggled sessions exist. */
export type DistractionPattern = {
  readonly type: DistractionType;
  readonly count: number;
} | null;

/** Per-goal breakdown for a given time period. */
export type GoalBreakdown = {
  readonly goalId: string;
  readonly sessions: number;
  readonly focusMinutes: number;
};
