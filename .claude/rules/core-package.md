---
paths:
  - 'packages/core/**'
---

# Core Package Standards

Source: research/coding-standards.md Section 2b

Core is the most critical package — portable across 9 platforms. Must be pure.

- **PKG-C01:** No IO imports (no `fetch`, `fs`, `net`, `window`, `document`, `process`, or any Node/browser API).
- **PKG-C02:** No React imports (`react`, `react-native`, `react-dom`).
- **PKG-C03:** No Supabase imports (`@supabase/supabase-js`, `@supabase/auth-helpers`).
- **PKG-C04:** No timers or clocks (`setTimeout`, `setInterval`, `Date.now()`, `new Date()`, `performance.now()`, `requestAnimationFrame`). Receive current time as a parameter.
- **PKG-C05:** No auth tokens. Functions receive `userId: string`, never a session object or JWT.
- **PKG-C06:** FSMs follow `transition(state, event) → newState` — pure, no mutations, no side effects. (Code review only.)
- **PKG-C07:** No downward imports. Core may only import from `@pomofocus/types`.
- **PKG-C08:** 100% test coverage. CI enforces 100% line and branch coverage. Every function must have a test.
