import type {
  AbandonmentReason,
  DistractionType,
  FocusQuality,
} from '@pomofocus/types';

/** Pre-persistence session shape (domain layer, camelCase). */
export type SessionData = {
  readonly id: string;
  readonly userId: string;
  readonly processGoalId: string;
  readonly intentionText: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly completed: boolean;
  readonly abandonmentReason: AbandonmentReason | null;
  readonly deviceId: string | null;
};

/** Persisted reflection fields on a session record. */
export type SessionReflection = {
  readonly focusQuality: FocusQuality | null;
  readonly distractionType: DistractionType | null;
  readonly notes: string | null;
};
