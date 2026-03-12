# Testing Standards

Source: research/coding-standards.md Section 5

These apply to all tests in the repo.

- **TST-001:** Tests first. Write the test before or alongside the implementation — never ship code without a corresponding test file. 100% coverage for `packages/core/`.
- **TST-002:** Query elements by user visibility: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`. Use `getByTestId` only as a last resort.
- **TST-003:** Prefer fewer, longer integration tests that test user flows (render → interact → assert) over many isolated unit tests for individual components.
- **TST-004:** Pure functions (core, analytics) tested with `expect(fn(input)).toEqual(output)` — no mocks, no setup, no teardown. If you need `vi.mock` in core, the architecture is wrong.
- **TST-005:** Every test must be able to fail. After writing a test, mentally verify: if the code under test broke, would this test catch it?
- **TST-006:** Co-locate test files. `machine.ts` → `machine.test.ts` in the same directory. No separate `__tests__/` directories.
