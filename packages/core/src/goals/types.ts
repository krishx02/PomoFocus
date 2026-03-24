import type { GoalStatus as GoalStatusEnum, RecurrenceType as RecurrenceTypeEnum } from '@pomofocus/types';

// ── Goal Status (as const object per U-010, U-012) ──

export const GOAL_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  RETIRED: 'retired',
} as const satisfies Record<string, GoalStatusEnum>;

export type GoalStatus = (typeof GOAL_STATUS)[keyof typeof GOAL_STATUS];

// ── Recurrence Type (as const object per U-010, U-012) ──

export const RECURRENCE_TYPE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
} as const satisfies Record<string, RecurrenceTypeEnum>;

export type RecurrenceType = (typeof RECURRENCE_TYPE)[keyof typeof RECURRENCE_TYPE];

// ── Long-Term Goal (matches ADR-005 long_term_goals table) ──

export type LongTermGoal = {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: GoalStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// ── Process Goal (matches ADR-005 process_goals table) ──

export type ProcessGoal = {
  readonly id: string;
  readonly longTermGoalId: string;
  readonly userId: string;
  readonly title: string;
  readonly targetSessionsPerDay: number;
  readonly recurrence: RecurrenceType;
  readonly status: GoalStatus;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

// ── Streak Result (Tier 1 analytics, ADR-014) ──

export type StreakResult = {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly gracePeriodActive: boolean;
};

// ── Goal Progress (Tier 1 analytics, ADR-014) ──

export type GoalProgress = {
  readonly goalId: string;
  readonly goalTitle: string;
  readonly completedToday: number;
  readonly targetToday: number;
};
