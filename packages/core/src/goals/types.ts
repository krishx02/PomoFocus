export type StreakResult = {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly gracePeriodActive: boolean;
};

export type GoalProgress = {
  readonly goalId: string;
  readonly completedToday: number;
  readonly target: number;
};
