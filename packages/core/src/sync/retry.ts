import type { OutboxEntry, RetryPolicy } from './types.js';

// ── Default Policy (ADR-006: exponential backoff with jitter, max 5 retries) ──

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  baseDelayMs: 1_000,
  jitterMs: 500,
} as const;

// ── Max delay cap to prevent unbounded growth ──

const MAX_DELAY_MS = 60_000;

// ── Public API ──

/**
 * Returns the base exponential backoff delay for a given retry count.
 * Formula: min(baseDelay * 2^retryCount, MAX_DELAY_MS).
 * Does not include jitter — use calculateNextRetry for that.
 */
export function getRetryDelay(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): number {
  if (retryCount < 0) {
    return policy.baseDelayMs;
  }

  const exponentialDelay = policy.baseDelayMs * Math.pow(2, retryCount);
  return Math.min(exponentialDelay, MAX_DELAY_MS);
}

/**
 * Returns the delay for the next retry including jitter.
 * Formula: getRetryDelay(retryCount) + random jitter in [0, jitterMs).
 * Accepts an optional random function (0..1) for deterministic testing.
 * No IO, no setTimeout — returns a delay value for the caller to schedule.
 */
export function calculateNextRetry(
  retryCount: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  const baseDelay = getRetryDelay(retryCount, policy);
  const jitter = Math.floor(random() * policy.jitterMs);
  return baseDelay + jitter;
}

/**
 * Returns whether an outbox entry should be retried.
 * True when retryCount < maxRetries; false when retries are exhausted.
 */
export function shouldRetry(
  entry: OutboxEntry,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): boolean {
  return entry.retryCount < policy.maxRetries;
}
