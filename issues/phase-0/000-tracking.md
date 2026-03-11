---
title: "Phase 0: Foundation — Make the Change Easy"
labels: ["phase:0", "tracking"]
---

## Phase 0: Foundation — "Make the Change Easy"

**Appetite:** 2 weeks
**Done milestone:** `pnpm nx affected --target=test` runs green on an empty test suite across all 7 packages, CI passes on push, `supabase gen types` produces TypeScript types from the live schema.

This phase is pure structural investment (Beck's S-changes). It produces no user-visible features but makes every subsequent feature dramatically cheaper.

---

### Sub-items and Issues

#### [0.1] Nx + pnpm Monorepo Scaffold (10 issues)
- [ ] #001 — Initialize Nx workspace with pnpm
- [ ] #002 — Scaffold packages/types stub
- [ ] #003 — Scaffold packages/core stub
- [ ] #004 — Scaffold packages/analytics stub
- [ ] #005 — Scaffold packages/data-access stub
- [ ] #006 — Scaffold packages/state, packages/ui, packages/ble-protocol stubs
- [ ] #007 — Scaffold apps/api stub (Hono on CF Workers)
- [ ] #008 — Scaffold apps/web stub (Expo web)
- [ ] #009 — Scaffold apps/mobile stub (Expo)
- [ ] #010 — Configure Nx dependency constraints and module boundaries

#### [0.2] Supabase Project + Core Schema Migration (9 issues)
- [ ] #011 — Initialize Supabase project and config
- [ ] #012 — Create enum types migration (9 enums)
- [ ] #013 — Create profiles and user_preferences tables migration
- [ ] #014 — Create long_term_goals and process_goals tables migration
- [ ] #015 — Create sessions and breaks tables migration
- [ ] #016 — Create devices and device_sync_log tables migration
- [ ] #017 — Create social tables migration (friend_requests, friendships, encouragement_taps)
- [ ] #018 — Create get_user_id() helper function and skeleton RLS policies
- [ ] #019 — Create seed data script for local development

#### [0.3] Type Generation Pipeline (3 issues)
- [ ] #020 — Configure supabase gen types script in packages/types
- [ ] #021 — Create barrel exports for commonly used types
- [ ] #022 — Verify type imports from downstream packages

#### [0.4] Test Framework Configuration (5 issues)
- [ ] #023 — Configure root Vitest config with workspace mode
- [ ] #024 — Add per-package Vitest configs for all 7 packages
- [ ] #025 — Create example test in packages/core to validate pipeline
- [ ] #026 — Configure test coverage reporting
- [ ] #027 — Add Nx test targets for all packages and apps

#### [0.5] Linting + Formatting Configuration (6 issues)
- [ ] #028 — Configure ESLint flat config with typescript-eslint strict
- [ ] #029 — Configure Prettier and editor settings
- [ ] #030 — Add per-package ESLint overrides (core no-IO, analytics no-IO, etc.)
- [ ] #031 — Configure import boundary rules via @nx/eslint-plugin
- [ ] #032 — Enable TypeScript strict mode in tsconfig.base.json
- [ ] #033 — Add Nx lint targets for all packages and apps

#### [0.6] CI Pipeline — GitHub Actions (3 issues)
- [ ] #034 — Create GitHub Actions CI workflow (lint, test, type-check, build)
- [ ] #035 — Configure pnpm and Nx caching in CI
- [ ] #036 — Configure branch protection rules for main

#### [0.7] packages/core Module Scaffolding (4 issues)
- [ ] #037 — Scaffold packages/core/src/timer/ module with placeholder types
- [ ] #038 — Scaffold packages/core/src/goals/ module with placeholder types
- [ ] #039 — Scaffold packages/core/src/sync/ module with placeholder types
- [ ] #040 — Scaffold packages/core/src/session/ module with placeholder types

---

### Implementation Order

The dependency graph flows as follows:

```
Wave 1 (parallel):  #001 (Nx workspace)    #011 (Supabase init)
                       |                       |
Wave 2 (parallel):  #002-#009 (stubs)       #012 (enums)
                    #023 (Vitest root)
                    #028 (ESLint root)
                    #032 (TS strict)
                       |                       |
Wave 3 (parallel):  #010 (Nx boundaries)    #013 (profiles)
                    #024 (Vitest per-pkg)
                    #030 (ESLint per-pkg)
                    #031 (import boundaries)
                    #033 (lint targets)
                       |                       |
Wave 4:             #025 (example test)     #014-#017 (remaining tables)
                    #026 (coverage)
                    #027 (test targets)
                       |                       |
Wave 5:             #034 (CI workflow)      #018 (RLS policies)
                       |                       |
Wave 6:             #035, #036 (CI cache    #019 (seed data)
                    + branch protection)     #020 (type generation)
                                               |
Wave 7:                                     #021 (barrel exports)
                                               |
Wave 8:                                     #022 (verify imports)
                                            #037-#040 (core modules)
```

### Parallelization Opportunities

**High parallelism available.** The two main tracks are independent:
1. **TS Monorepo Track** (0.1 → 0.4 → 0.5 → 0.6): Nx scaffold → test/lint config → CI
2. **Database Track** (0.2 → 0.3): Supabase init → schema → type generation

These tracks only merge at #020 (type generation needs both the types package and the schema) and #037-#040 (core modules need both the core package and the generated types).

Within each wave, all issues can be picked up by separate agents simultaneously.

### Deferred to Phase 1

The following items from the database design doc are intentionally deferred from Phase 0:

- **`updated_at` triggers** — 6 tables (profiles, user_preferences, long_term_goals, process_goals, devices, friend_requests) need `BEFORE UPDATE` triggers calling `update_updated_at()`. Create early in Phase 1.
- **`create_profile_on_signup` trigger** — `AFTER INSERT ON auth.users` auto-creates a profile row. Needed when Supabase Auth is configured in Phase 2.
- **`create_friendship_pair` trigger** — `AFTER UPDATE ON friend_requests` creates bidirectional friendship rows. Needed in Phase 8 (Social Features).

### Total: 40 issues + this tracking issue
