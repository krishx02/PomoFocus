---
paths:
  - "packages/analytics/**"
---

# Analytics Package Standards

Source: research/coding-standards.md Section 2c

- **PKG-A01:** No IO imports — same restrictions as core. Analytics functions are pure: data in, computed metrics out.
- **PKG-A02:** No composite Focus Score. Use individual component metrics (completion rate, focus quality distribution, consistency, streaks) with trend arrows. This is a core product decision (ADR-014).
- **PKG-A03:** Analytics depends on `@pomofocus/types` and `@pomofocus/core` only. Never from `data-access`, `state`, `ui`, or `ble-protocol`.
- **PKG-A04:** All exported functions must be pure — same input always produces same output, no side effects.
