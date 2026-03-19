# Self-Healing Rules

Source: research/10-self-healing-agents.md

These apply to ALL fix loops, retry attempts, and error recovery across all skills and ad-hoc work.

## Fix Loop Discipline

- **SH-001: External verification only.** Never rely on your own judgment to determine if a fix worked. Run the actual test/lint/build command and read the output. If you think the fix is correct but the tests still fail, the tests are right and you are wrong.
- **SH-002: Derivative check.** Before each fix attempt, compare the current failure count to the previous attempt. If the number of failures INCREASED, STOP IMMEDIATELY — your approach is making things worse. Revert your last change and try a fundamentally different strategy.
- **SH-003: Verbal reflection before retry.** Before attempting any fix after a failed attempt, explicitly reason: (1) what specifically failed, (2) WHY it failed (root cause, not symptom), (3) why your previous fix didn't work, (4) what specifically you will do differently. Do not retry with the same approach that just failed.
- **SH-004: Budget caps.** Respect iteration limits in skills (typically 3-5 attempts). After exhausting attempts, escalate — do not continue. If no explicit limit exists, default to 3 attempts for any fix loop.
- **SH-005: Fresh start over continued repair.** If you've made 3 failed fix attempts on the same issue, your context is likely polluted. Revert to the last known-good state (last passing commit) and re-approach the problem from scratch with only the original error message.

## Test Immutability

- **SH-006: Never modify test files during a fix loop.** When tests fail and you're trying to make them pass, you may ONLY modify implementation code. Do not weaken assertions, delete test cases, mock away the problem, or broaden expected values. If a test is genuinely wrong, that's a separate issue — escalate to human.
- **SH-007: Never modify test infrastructure to pass.** Do not change test configuration, test utilities, or test setup to work around a failure. Fix the code under test.

## Verification Strategy

- **SH-008: Level-triggered, not edge-triggered.** After any fix, re-run the FULL relevant test suite — not just the single test that was failing. Your fix may have broken something else. Track the total failure count, not just the original failing test.
- **SH-009: Layered defense.** For known error patterns (missing imports, type errors, lint violations), apply the deterministic fix immediately without LLM reasoning. Reserve deliberative reasoning for novel bugs. Don't overthink simple problems.

## Escalation

- **SH-010: Escalation ladder.** When fixing failures, follow this order:
  1. **Pattern match:** Is this a known error type with a standard fix? Apply it.
  2. **Single attempt with error context:** Read the error, fix the root cause.
  3. **Reflect and retry:** If attempt 1 failed, reason about WHY, then try a different approach.
  4. **Fresh start:** If attempt 2 failed, revert to last good state and re-approach.
  5. **Alternative strategy:** Try a fundamentally different implementation approach.
  6. **Escalate to human:** Label `needs-human`, post a detailed comment with what was tried.
- **SH-011: Never skip the escalation.** Do not jump from attempt 1 to attempt 5. Each step exists because it catches failures the previous step misses.

## Reversibility

- **SH-012: Checkpoint before risky changes.** Before making changes during a fix loop, ensure the current state is committed (or stashed). Every fix attempt must be individually revertable.
- **SH-013: Revert on regression.** If a fix attempt causes MORE test failures than before (derivative check, SH-002), immediately `git checkout -- .` or revert the commit. Do not compound the problem.
