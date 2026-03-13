---
paths:
  - 'supabase/**'
---

# Database Migration Standards

Source: research/coding-standards.md Section 6

DB-001 through DB-005, DB-007, DB-008 are already in CLAUDE.md. These are the additional rules:

- **DB-006:** RLS policies must include `TO authenticated` (blocks anon access) and wrap `get_user_id()` in `(SELECT ...)` for performance — without the subquery, Postgres evaluates per-row instead of once per query.
- **DB-009:** Index every column referenced in RLS policy conditions. Use BRIN indexes for `created_at` columns (10x smaller than B-tree for append-only data).
- **DB-010:** Never reference `auth.jwt() -> 'user_metadata'` in RLS policies — `user_metadata` is writable by the user and can be exploited to bypass policies.
- **DB-011:** Always add explicit `WHERE` filters in queries even though RLS exists. RLS is defense-in-depth, not a query optimizer — without filters, Postgres does a full table scan through the policy.
