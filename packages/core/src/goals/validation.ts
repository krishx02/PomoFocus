// ── Validation Result (discriminated union) ──

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

// ── Constants ──

const INTENTION_MAX_LENGTH = 200;

// ── Intention Validation ──

export function validateIntention(text: string): ValidationResult<string> {
  const trimmed = text.trim();

  if (trimmed.length > INTENTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `Intention must be ${String(INTENTION_MAX_LENGTH)} characters or fewer (got ${String(trimmed.length)})`,
    };
  }

  return { ok: true, value: trimmed };
}

// ── Process Goal Validation ──

export type ProcessGoalInput = {
  readonly title: string;
  readonly targetSessionsPerDay: number;
};

export function validateProcessGoal(input: ProcessGoalInput): ValidationResult<ProcessGoalInput> {
  const trimmedTitle = input.title.trim();

  if (trimmedTitle.length === 0) {
    return { ok: false, error: 'Process goal title must not be empty' };
  }

  if (input.targetSessionsPerDay < 1) {
    return {
      ok: false,
      error: `Target sessions per day must be at least 1 (got ${String(input.targetSessionsPerDay)})`,
    };
  }

  if (!Number.isInteger(input.targetSessionsPerDay)) {
    return {
      ok: false,
      error: `Target sessions per day must be a whole number (got ${String(input.targetSessionsPerDay)})`,
    };
  }

  return { ok: true, value: { title: trimmedTitle, targetSessionsPerDay: input.targetSessionsPerDay } };
}

// ── Long-Term Goal Validation ──

export type LongTermGoalInput = {
  readonly title: string;
  readonly description?: string | null;
};

export function validateLongTermGoal(input: LongTermGoalInput): ValidationResult<LongTermGoalInput> {
  const trimmedTitle = input.title.trim();

  if (trimmedTitle.length === 0) {
    return { ok: false, error: 'Long-term goal title must not be empty' };
  }

  const trimmedDescription = input.description?.trim() ?? null;

  return {
    ok: true,
    value: { title: trimmedTitle, description: trimmedDescription },
  };
}
