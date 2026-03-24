import { describe, it, expect } from 'vitest';
import {
  getRetryDelay,
  calculateNextRetry,
  shouldRetry,
  DEFAULT_RETRY_POLICY,
} from './retry.js';
import { QUEUE_ITEM_STATUS } from './types.js';
import type { OutboxEntry, RetryPolicy } from './types.js';

// ── Helpers ──

function makeEntry(overrides?: Partial<OutboxEntry>): OutboxEntry {
  return {
    id: 'entry-1',
    entityType: 'sessions',
    entityId: 'session-abc',
    state: { type: QUEUE_ITEM_STATUS.FAILED, errorMessage: 'network error' },
    retryCount: 0,
    createdAt: 1000,
    ...overrides,
  };
}

// ── DEFAULT_RETRY_POLICY ──

describe('DEFAULT_RETRY_POLICY', () => {
  it('has max 5 retries per ADR-006', () => {
    expect(DEFAULT_RETRY_POLICY.maxRetries).toBe(5);
  });

  it('has 1000ms base delay', () => {
    expect(DEFAULT_RETRY_POLICY.baseDelayMs).toBe(1_000);
  });

  it('has 500ms jitter range', () => {
    expect(DEFAULT_RETRY_POLICY.jitterMs).toBe(500);
  });
});

// ── getRetryDelay ──

describe('getRetryDelay', () => {
  it('returns base delay for retryCount 0', () => {
    expect(getRetryDelay(0)).toBe(1_000);
  });

  it('doubles the delay for each retry (exponential backoff)', () => {
    expect(getRetryDelay(0)).toBe(1_000);
    expect(getRetryDelay(1)).toBe(2_000);
    expect(getRetryDelay(2)).toBe(4_000);
    expect(getRetryDelay(3)).toBe(8_000);
    expect(getRetryDelay(4)).toBe(16_000);
  });

  it('caps delay at 60 seconds', () => {
    expect(getRetryDelay(10)).toBe(60_000);
    expect(getRetryDelay(20)).toBe(60_000);
  });

  it('returns base delay for negative retryCount', () => {
    expect(getRetryDelay(-1)).toBe(1_000);
    expect(getRetryDelay(-100)).toBe(1_000);
  });

  it('uses custom policy when provided', () => {
    const policy: RetryPolicy = { maxRetries: 3, baseDelayMs: 500, jitterMs: 100 };
    expect(getRetryDelay(0, policy)).toBe(500);
    expect(getRetryDelay(1, policy)).toBe(1_000);
    expect(getRetryDelay(2, policy)).toBe(2_000);
  });

  it('caps custom policy delay at 60 seconds', () => {
    const policy: RetryPolicy = { maxRetries: 3, baseDelayMs: 10_000, jitterMs: 0 };
    expect(getRetryDelay(3, policy)).toBe(60_000);
  });
});

// ── calculateNextRetry ──

describe('calculateNextRetry', () => {
  it('returns base delay plus jitter', () => {
    const fixedRandom = (): number => 0.5;
    const delay = calculateNextRetry(0, DEFAULT_RETRY_POLICY, fixedRandom);
    // 1000 + floor(0.5 * 500) = 1000 + 250 = 1250
    expect(delay).toBe(1_250);
  });

  it('returns base delay with no jitter when random returns 0', () => {
    const zeroRandom = (): number => 0;
    const delay = calculateNextRetry(0, DEFAULT_RETRY_POLICY, zeroRandom);
    expect(delay).toBe(1_000);
  });

  it('returns base delay plus max jitter - 1 when random returns ~1', () => {
    const maxRandom = (): number => 0.999;
    const delay = calculateNextRetry(0, DEFAULT_RETRY_POLICY, maxRandom);
    // 1000 + floor(0.999 * 500) = 1000 + 499 = 1499
    expect(delay).toBe(1_499);
  });

  it('applies exponential backoff with jitter', () => {
    const fixedRandom = (): number => 0.5;
    expect(calculateNextRetry(0, DEFAULT_RETRY_POLICY, fixedRandom)).toBe(1_250);
    expect(calculateNextRetry(1, DEFAULT_RETRY_POLICY, fixedRandom)).toBe(2_250);
    expect(calculateNextRetry(2, DEFAULT_RETRY_POLICY, fixedRandom)).toBe(4_250);
    expect(calculateNextRetry(3, DEFAULT_RETRY_POLICY, fixedRandom)).toBe(8_250);
  });

  it('uses Math.random by default (result is within expected range)', () => {
    const delay = calculateNextRetry(0);
    // Should be between 1000 (base) and 1499 (base + max jitter - 1)
    expect(delay).toBeGreaterThanOrEqual(1_000);
    expect(delay).toBeLessThan(1_500);
  });

  it('uses custom policy', () => {
    const policy: RetryPolicy = { maxRetries: 3, baseDelayMs: 200, jitterMs: 100 };
    const fixedRandom = (): number => 0.5;
    const delay = calculateNextRetry(0, policy, fixedRandom);
    // 200 + floor(0.5 * 100) = 200 + 50 = 250
    expect(delay).toBe(250);
  });

  it('handles zero jitter policy', () => {
    const policy: RetryPolicy = { maxRetries: 3, baseDelayMs: 1_000, jitterMs: 0 };
    const fixedRandom = (): number => 0.5;
    const delay = calculateNextRetry(0, policy, fixedRandom);
    expect(delay).toBe(1_000);
  });
});

// ── shouldRetry ──

describe('shouldRetry', () => {
  it('returns true when retryCount is 0', () => {
    expect(shouldRetry(makeEntry({ retryCount: 0 }))).toBe(true);
  });

  it('returns true when retryCount is below max', () => {
    expect(shouldRetry(makeEntry({ retryCount: 1 }))).toBe(true);
    expect(shouldRetry(makeEntry({ retryCount: 4 }))).toBe(true);
  });

  it('returns false when retryCount equals max (5)', () => {
    expect(shouldRetry(makeEntry({ retryCount: 5 }))).toBe(false);
  });

  it('returns false when retryCount exceeds max', () => {
    expect(shouldRetry(makeEntry({ retryCount: 6 }))).toBe(false);
    expect(shouldRetry(makeEntry({ retryCount: 100 }))).toBe(false);
  });

  it('uses custom policy max retries', () => {
    const policy: RetryPolicy = { maxRetries: 3, baseDelayMs: 1_000, jitterMs: 500 };
    expect(shouldRetry(makeEntry({ retryCount: 2 }), policy)).toBe(true);
    expect(shouldRetry(makeEntry({ retryCount: 3 }), policy)).toBe(false);
    expect(shouldRetry(makeEntry({ retryCount: 4 }), policy)).toBe(false);
  });

  it('works with entries in any state', () => {
    const pendingEntry = makeEntry({
      retryCount: 3,
      state: { type: QUEUE_ITEM_STATUS.PENDING },
    });
    expect(shouldRetry(pendingEntry)).toBe(true);

    const confirmedEntry = makeEntry({
      retryCount: 0,
      state: { type: QUEUE_ITEM_STATUS.CONFIRMED },
    });
    expect(shouldRetry(confirmedEntry)).toBe(true);
  });
});
