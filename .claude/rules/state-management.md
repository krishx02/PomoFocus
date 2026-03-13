---
paths:
  - 'packages/state/**'
---

# State Management Standards

Source: research/coding-standards.md Section 2e

- **PKG-S01:** Server data in TanStack Query, not Zustand. Never duplicate server state in a Zustand store — TanStack Query is the single cache for all server data (sessions, goals, friends, analytics).
- **PKG-S02:** Zustand stores are thin wrappers. Delegate business logic to `@pomofocus/core` functions — stores only manage state updates, not computation.
- **PKG-S03:** Always use selectors when reading from Zustand. For multi-value selections, use `useShallow` to prevent unnecessary re-renders. Never destructure the entire store.
- **PKG-S04:** Explicit `staleTime` on every `queryOptions()` call. Never rely on the 0ms default — use `30_000` to match the 30s polling interval.
- **PKG-S05:** One `queryOptions()` factory object per feature (sessions, goals, friends). Centralizes query keys — eliminates key typo bugs.
- **PKG-S06:** Zustand middleware order (outermost to innermost): `devtools(persist(immer(storeFn)))`. Wrong order breaks devtools and persistence.
- **PKG-S07:** After mutations, invalidate query keys to trigger refetch — don't manually update the TanStack Query cache. Invalidation is simpler and guaranteed correct with 30s polling.
- **PKG-S08:** No `useEffect` for state derivation. Derive values directly during render. `useEffect` derivation causes double renders and stale value flashes.
