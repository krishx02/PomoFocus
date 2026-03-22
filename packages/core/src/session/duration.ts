/**
 * Calculates the actual focus time for an abandoned session.
 *
 * Both timestamps are epoch milliseconds, injected by the caller
 * (no Date.now() — PKG-C04).
 *
 * @returns Elapsed focus time in milliseconds (non-negative).
 */
export function calculatePartialDuration(startedAt: number, abandonedAt: number): number {
  return Math.max(0, abandonedAt - startedAt);
}
