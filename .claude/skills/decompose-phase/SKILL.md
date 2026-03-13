---
name: decompose-phase
description: Decompose a single phase from research/mvp-roadmap.md into agent-ready GitHub issues. Reads the phase, reads all referenced ADRs and design docs for context, then creates issues with exact file paths, test commands, acceptance criteria, and dependency order. Use when user says "decompose phase", "create issues for phase", "break down phase N", or "generate issues for phase".
user-invocable: true
context: conversation
allowed-tools: Bash(gh *), Bash(git *), Read, Grep, Glob, Agent
compatibility: 'Requires gh CLI, git. Claude Code only.'
argument-hint: '[phase number, e.g. 0, 1, 2, 3, 4, 5, 6, 7A, 7B, 8, 9]'
metadata:
  author: PomoFocus
  version: 1.0.0
---

Phase: $ARGUMENTS

## Step 0 — Validate Input

The valid phase identifiers are: `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7A`, `7B`, `8`, `9`.

If `$ARGUMENTS` is empty or not one of these, stop and ask the user which phase they want to decompose. List the phases with their names:

| Phase | Name                                         |
| ----- | -------------------------------------------- |
| 0     | Foundation — "Make the Change Easy"          |
| 1     | Walking Skeleton — Thinnest Vertical Slice   |
| 2     | Auth + Sync + Goals                          |
| 3     | Session Lifecycle + Reflection               |
| 4     | Mobile App                                   |
| 5     | Analytics                                    |
| 6     | iOS Widget                                   |
| 7A    | Device Firmware — Independent Hardware Track |
| 7B    | BLE Protocol + Client Integration            |
| 8     | Social Features                              |
| 9     | Polish + Ship                                |

## Step 1 — Read the Roadmap Phase

Read `research/mvp-roadmap.md` and extract ONLY the section for the requested phase.

For each **sub-item** in the phase (e.g., 0.1, 0.2, ...), capture:

- **What** — the description of work
- **Why here** — the sequencing rationale
- **Packages/files** — exact directories and files
- **ADR(s)** — referenced ADR numbers and links
- **Acceptance signal** — what "done" looks like
- **Est. issues** — the estimated issue count range (this is your target)

Also capture the phase-level metadata:

- **Appetite** — the time budget
- **Done milestone** — the phase completion criteria
- **Circuit breaker** — if one exists (Phases 7A and 7B have these)

## Step 2 — Read ALL Referenced ADRs and Design Docs

For each unique ADR referenced by any sub-item in this phase:

1. Read the ADR file at `research/decisions/NNN-*.md`
2. If a design doc exists at `research/designs/*.md` for that ADR, read it too

This is NOT optional. The ADRs and design docs contain:

- Exact TypeScript/Swift/C++ type names and interfaces
- Exact file path conventions
- State enums, transition tables, API route definitions
- Acceptance criteria details beyond what the roadmap summarizes

You need this information to write issues with specific enough file paths, type names, and test assertions.

Additionally, ALWAYS read these files regardless of which phase:

- `research/coding-standards-eslint-nx.md` — Exact Nx tag names (Section 4), depConstraints (Section 5), bannedExternalImports (Section 5), tsconfig settings (Section 1), Vitest config (Section 6). Use ONLY tag names defined here.
- `research/coding-standards.md` — Universal rules (U-001 through U-013) and package-level rules (PKG-\*).

These files contain exact configuration details that ADRs and design docs reference but don't fully reproduce.

## Step 3 — Check for Existing Issues

Before creating any issues, check what already exists:

```bash
gh issue list --label "phase:$ARGUMENTS" --state all --limit 100 --json number,title,state
```

If issues already exist for this phase, report them to the user and ask how to proceed:

- Skip already-created sub-items?
- Recreate everything (will create duplicates)?
- Stop and let the user clean up first?

## Step 4 — Plan the Issue Decomposition

For each sub-item (e.g., 0.1, 0.2, ...), plan how to split it into individual issues. Use these rules:

### Splitting Rules

1. **One issue = one independently testable unit of work.** If you can't write a single test command for it, it's too big or too vague.

2. **Target the estimated issue count.** The roadmap says "Est. issues: 8-12" — aim for the middle of that range. Don't create 3 issues where 10 are expected, and don't create 20 where 8-12 are expected.

3. **Never combine layers in one issue.** Separate:
   - Schema/migration issues (SQL)
   - Pure logic issues (TypeScript in `packages/core/` or `packages/analytics/`)
   - API route issues (Hono in `apps/api/`)
   - Client/state issues (`packages/data-access/`, `packages/state/`)
   - UI issues (`apps/web/`, `apps/mobile/`, `packages/ui/`)
   - Infrastructure issues (CI, config, tooling)
   - Firmware issues (C++ in `firmware/device/`)

4. **Use the data→logic→UI dependency order.** Within a sub-item, issues should flow: types/schema → core logic → API → client SDK → state → UI.

5. **Each issue must have a test command.** For TypeScript: `pnpm nx test @pomofocus/[package]`. For firmware: `pio test` or serial verification. For CI: "push a branch and verify CI passes." For SQL: `supabase db push` or integration test.

6. **Group by natural boundaries, not by arbitrary line counts.** "Timer idle→focusing transition + test" is one issue. "Lines 1-50 of transition.ts" is NOT an issue.

7. **Use exact Nx tag names from coding-standards-eslint-nx.md Section 4.** Do NOT invent tag names. The canonical tags are: `type:types`, `type:domain`, `type:infra`, `type:ble`, `type:state`, `type:ui`, `type:app` (plus scope tags). If you use `type:core` or `type:analytics`, you are wrong — both map to `type:domain`.

8. **Count against design doc DDL, not ADR summaries.** ADR summary text may round or include managed tables. Count the actual `CREATE TABLE` statements in the design doc for the real number.

9. **Include indexes with their tables.** If the design doc defines indexes for a table, add them to that table's migration issue acceptance criteria. Do not silently omit indexes.

10. **Include exact SQL function signatures.** For SQL function issues, specify: return type, `LANGUAGE`, volatility (`STABLE`/`VOLATILE`/`IMMUTABLE`), and security context (`SECURITY DEFINER`/`INVOKER`).

11. **Flag source doc conflicts.** If the roadmap, product brief, ADRs, or design docs contradict each other on a point relevant to an issue, add a visible note in the issue's Context section flagging the conflict. Do not silently pick one source.

### Issue Sizing Guidelines

- **effort:small** — < 1 hour, < 10 files, single concern. This is the DEFAULT for decomposed issues.
- **effort:large** — Only if a sub-item is so complex it needs its own decomposition pass. Rare.
- **needs-human** — If a sub-item requires a decision not captured in any ADR or design doc.

## Step 5 — Determine Labels for Each Issue

Every issue gets these labels:

- `agent-ready` (unless `needs-human`)
- `effort:small` (unless explicitly large)
- `phase:$ARGUMENTS` (e.g., `phase:0`, `phase:7A`)

Plus ONE platform label based on the affected files:

- `platform:shared` — `packages/` (anything cross-platform)
- `platform:web` — `apps/web/`
- `platform:api` — `apps/api/`
- `platform:mobile` — `apps/mobile/`
- `platform:ios-widget` — `apps/mobile/targets/ios-widget/`
- `platform:firmware` — `firmware/device/`
- `platform:infra` — `.github/`, `supabase/`, root config files

Plus a type label:

- `enhancement` — new feature or capability
- `chore` — scaffolding, config, infrastructure (no user-facing change)

When specifying Nx project tags in issue body (Affected Files or Acceptance Criteria), always include BOTH dimensions from `coding-standards-eslint-nx.md` Section 4:

- Type tag: `type:domain`, `type:types`, `type:infra`, `type:ble`, `type:state`, `type:ui`, `type:app`
- Scope tag: `scope:shared`, `scope:web`, `scope:mobile`, `scope:vscode`, `scope:mcp`

## Step 6 — Create Labels (if needed)

Before creating issues, ensure all required labels exist. Run:

```bash
gh label list --limit 100 --json name
```

For any label that doesn't exist yet, create it:

```bash
# Phase labels
gh label create "phase:0" --color "0E8A16" --description "Phase 0: Foundation" 2>/dev/null || true
# ... etc for the specific phase

# Platform labels (if not already created)
gh label create "platform:shared" --color "1D76DB" --description "packages/ (cross-platform)" 2>/dev/null || true
gh label create "platform:api" --color "D93F0B" --description "apps/api/ (Hono on CF Workers)" 2>/dev/null || true
gh label create "platform:infra" --color "666666" --description "CI, config, tooling" 2>/dev/null || true
gh label create "platform:firmware" --color "B60205" --description "firmware/device/ (PlatformIO/C++)" 2>/dev/null || true
# ... etc for any other labels needed
```

Use `2>/dev/null || true` so existing labels don't cause errors.

## Step 7 — Create Issues (Batch)

For each issue, create it using `gh issue create`. Use the **exact template below** — do not deviate from this structure:

````bash
gh issue create \
  --title "[Sub-item number] [Short descriptive title]" \
  --label "agent-ready,effort:small,phase:$ARGUMENTS,[platform-label],[type-label]" \
  --body "$(cat <<'EOF'
## Goal

[One-sentence verifiable assertion. What must be true when this is done?]

## Context & Background

Phase $ARGUMENTS, sub-item [N.M] of the [MVP Roadmap](../research/mvp-roadmap.md).
[If depends on another issue: "**Depends on:** #[number] — must be merged first."]

**Referenced ADRs:**
- [ADR-NNN](../research/decisions/NNN-*.md) — [one-line summary of what's relevant]

**Referenced design docs:**
- [Design doc](../research/designs/*.md) — [one-line summary of what's relevant]

## Affected Files

- `[exact/path/from/repo/root.ext]` — [what to create or modify]
- `[exact/path/to/test/file.test.ts]` — [test file to create]

## Acceptance Criteria

- [ ] [Specific, automatable criterion]
- [ ] [Another criterion]
- [ ] `[test command]` passes with no failures
- [ ] `pnpm type-check` exits clean (for TS issues)

## Out of Scope

- Do NOT implement other sub-items from Phase $ARGUMENTS in this issue
- [Any additional constraints]

## Test Plan

```bash
[exact command(s) to run]
````

## Platform

[Platform from the dropdown: Shared/Cross-platform, Web, iOS, etc.]
EOF
)"

````

**IMPORTANT:** Record the issue number returned by each `gh issue create` command. You need these for dependency references in subsequent issues.

**Dependency handling:** If Issue B depends on Issue A, add to Issue B's Context section:
> **Depends on:** #[A's number] — must be merged first.

Create issues in dependency order (upstream first) so you have the issue numbers to reference.

## Step 8 — Create a Phase Tracking Issue

After all sub-issues are created, create a single tracking issue for the phase:

```bash
gh issue create \
  --title "Phase $ARGUMENTS: [Phase Name]" \
  --label "phase:$ARGUMENTS,tracking" \
  --body "$(cat <<'EOF'
## Phase $ARGUMENTS: [Phase Name]

**Appetite:** [from roadmap]
**Done milestone:** [from roadmap]
[If circuit breaker exists: **Circuit breaker:** [from roadmap]]

### Sub-items and Issues

#### [N.1] [Sub-item name]
- [ ] #[issue1] — [title]
- [ ] #[issue2] — [title]
- [ ] #[issue3] — [title]

#### [N.2] [Sub-item name]
- [ ] #[issue4] — [title]
- [ ] #[issue5] — [title]

[... for all sub-items]

### Implementation Order

[Describe the dependency graph — which sub-items can be parallelized, which must be sequential]

### Parallelization Opportunities

[List which issues can be worked on simultaneously by separate agents]

### Total: [N] issues created
EOF
)"
````

## Step 9 — Final Report

Output a summary to the user:

1. **Phase decomposed:** Phase $ARGUMENTS — [name]
2. **Issues created:** [total count]
3. **Tracking issue:** #[number]
4. **Issue breakdown by sub-item:**
   - [N.1] [name]: #[x], #[y], #[z] ([count] issues)
   - [N.2] [name]: #[a], #[b] ([count] issues)
   - ...
5. **Dependency chain:** [describe which must go first]
6. **Parallel opportunities:** [which can run simultaneously]
7. **`needs-human` issues (if any):** #[n] — [what decision is needed]
8. **Recommended first pick:** "Start with #[lowest dependency issue] — run `/ship-issue [number]`"

## Guidelines

- **Read before writing.** Do not create issues from the roadmap alone. The ADRs and design docs have the details you need for specific file paths, type names, and interface definitions.
- **Be specific.** "Set up Vitest" is too vague. "Configure Vitest with root config at `vitest.config.ts`, workspace mode for 7 packages, and `pnpm nx test` target for each package" is specific.
- **Include the WHY.** The Context section should explain why this issue matters and what it unblocks — agents that understand the purpose make better decisions.
- **Test commands are mandatory.** Every issue must have a runnable test command. If the work is infrastructure (CI, config), the test is "push a branch and verify."
- **Don't over-decompose.** If a sub-item says "Est. issues: 3-4", creating 12 issues means each one is too small to be meaningful. Respect the estimates.
- **Don't under-decompose.** If a sub-item says "Est. issues: 8-12", creating 3 issues means each one is too large for a single agent session. Respect the estimates.
