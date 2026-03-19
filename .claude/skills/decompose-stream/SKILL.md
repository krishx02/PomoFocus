---
name: decompose-stream
description: Decompose a parallel execution stream into agent-ready GitHub issues. Streams cut across phase boundaries based on actual dependency — Stream B pulls pure domain logic from Phases 2, 3, and 5. Creates issues with batch-ship groupings for maximum parallelization. Use when user says "decompose stream", "create issues for stream", "break down stream B", or "parallel decompose".
user-invocable: true
context: conversation
allowed-tools: Bash(gh *), Bash(git *), Read, Grep, Glob, Agent
compatibility: 'Requires gh CLI, git. Claude Code only.'
argument-hint: '[stream letter: A, B, C, D, E, F, G, H, or Z]'
metadata:
  author: PomoFocus
  version: 1.0.0
---

Stream: $ARGUMENTS

## Stream Definitions

Streams are parallel execution tracks that cut across phase boundaries. Unlike phases (sequential), streams group work by actual dependency — allowing maximum parallelization.

| Stream | Name | Phase Sub-Items Included | Depends On |
|--------|------|-------------------------|------------|
| A | Auth Foundation | 1.5 (web UI remainder), 1.6 (deployment), 2.1 (Supabase Auth), 2.2 (JWT middleware), 2.3 (RLS policies) | Phase 1 done |
| B | Pure Domain Logic | 2.4 (goals core logic), 2.5 (sync FSM), 3.2 (focus/break cycling logic), 3.4 (abandonment logic), 3.5 (timer rehydration pure logic), 5.1 (analytics pure functions) | types + core only (can start Day 1 after Phase 1) |
| C | API + Sync Wiring | 2.4 (goals API endpoints + state hooks), 2.6 (sync drivers), 5.2-5.4 (analytics API endpoints), 3.5 (timer persistence wiring), 9.2 (GDPR endpoints), 9.3 (user preferences API) | Stream A (auth must be done) |
| D | Web Session Experience | 3.1 (pre-session flow UI), 3.2 (focus/break cycling UI), 3.3 (post-session reflection UI), 3.4 (abandonment UI), 4.1 (packages/ui shared components), 9.5 (web refactor + onboarding) | Streams A + B |
| E | Mobile + iOS Widget | 4.2 (Expo scaffold), 4.3 (mobile auth), 4.4 (notifications), 4.5 (push tokens), 4.6 (mobile sync), 6.1-6.3 (iOS widget), 9.1 (mobile onboarding) | Streams A + D |
| F | Social Features | 8.1-8.5 (all social: friends, library mode, taps, quiet feed, invite links) | Stream A only |
| G | Firmware | 7A.1-7A.8 (all firmware sub-items) | INDEPENDENT -- zero TypeScript dependency |
| H | BLE Integration | 7B.1-7B.5 (all BLE client sub-items) | Streams E + G |
| Z | Polish + Ship | 9.1 (onboarding finalization), 9.4 (Sentry), 9.5 (final polish), integration testing | All streams |

### Split Sub-Items (appear in multiple streams)

Some phase sub-items are intentionally split across streams. The logic/data portion goes to one stream; the API/UI portion goes to another:

| Sub-Item | Stream B (Pure Logic) | Stream C (API Wiring) | Stream D (Web UI) |
|----------|----------------------|----------------------|-------------------|
| 2.4 Goals | Goal types, streak calculation, grace period logic in `packages/core/goals/` | Goals API endpoints (CRUD), state hooks in `packages/state/`, `packages/data-access/` | -- |
| 3.2 Focus/Break Cycles | Cycle logic, short/long break calculation in `packages/core/timer/` | -- | Break timer UI, skip break button, cycle counter, break usefulness rating in `apps/web/` |
| 3.4 Abandonment | Abandoned state transition, partial duration calculation in `packages/core/timer/` | -- | Abandon button, reason prompt UI, confirmation dialog in `apps/web/` |
| 3.5 Timer Persistence | Pure rehydration logic, timestamp math, auto-abandon on expiry in `packages/core/timer/rehydrate.ts` | Persistence wiring (localStorage driver, state-change hooks) in `packages/state/`, `packages/data-access/` | -- |

## Step 0 -- Validate Input

The valid stream identifiers are: `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `Z`.

If `$ARGUMENTS` is empty or not one of these (case-insensitive), stop and ask the user which stream they want to decompose. List the streams with their names:

| Stream | Name | Depends On |
|--------|------|------------|
| A | Auth Foundation | Phase 1 done |
| B | Pure Domain Logic | types + core only |
| C | API + Sync Wiring | Stream A |
| D | Web Session Experience | Streams A + B |
| E | Mobile + iOS Widget | Streams A + D |
| F | Social Features | Stream A only |
| G | Firmware | INDEPENDENT |
| H | BLE Integration | Streams E + G |
| Z | Polish + Ship | All streams |

Normalize the input to uppercase before proceeding.

## Step 1 -- Read the Stream Definition

Using the mapping table above, identify ALL phase sub-items that belong to this stream. For each sub-item, note:

- **Phase number** — the original phase it comes from (for labeling)
- **Sub-item number** — e.g., 2.4, 3.2, 5.1
- **Stream scope** — what portion of this sub-item belongs in THIS stream (important for split sub-items)

For split sub-items, be precise:
- Stream B gets ONLY the pure logic portion (types, core functions, tests in `packages/core/` or `packages/analytics/`)
- Stream C gets ONLY the API endpoints, data-access wiring, and state hooks
- Stream D gets ONLY the web UI components and screens

## Step 2 -- Read the Roadmap

Read `research/mvp-roadmap.md` and extract the FULL description for each phase sub-item identified in Step 1. For each sub-item, capture:

- **What** -- the description of work
- **Why here** -- the sequencing rationale
- **Packages/files** -- exact directories and files
- **ADR(s)** -- referenced ADR numbers and links
- **Acceptance signal** -- what "done" looks like
- **Est. issues** -- the estimated issue count range

**IMPORTANT:** For split sub-items, you still read the FULL sub-item description, but you will only create issues for the portion scoped to this stream. The roadmap's "Est. issues" count covers the ENTIRE sub-item -- your stream will use a subset of that count.

## Step 3 -- Read ALL Referenced ADRs and Design Docs

For each unique ADR referenced by any sub-item in this stream:

1. Read the ADR file at `research/decisions/NNN-*.md`
2. If a design doc exists at `research/designs/*.md` for that ADR, read it too

This is NOT optional. The ADRs and design docs contain:

- Exact TypeScript/Swift/C++ type names and interfaces
- Exact file path conventions
- State enums, transition tables, API route definitions
- Acceptance criteria details beyond what the roadmap summarizes

You need this information to write issues with specific enough file paths, type names, and test assertions.

Additionally, ALWAYS read these files regardless of which stream:

- `research/coding-standards-eslint-nx.md` -- Exact Nx tag names (Section 4), depConstraints (Section 5), bannedExternalImports (Section 5), tsconfig settings (Section 1), Vitest config (Section 6). Use ONLY tag names defined here.
- `research/coding-standards.md` -- Universal rules (U-001 through U-013) and package-level rules (PKG-\*).

These files contain exact configuration details that ADRs and design docs reference but don't fully reproduce.

## Step 4 -- Check for Existing Issues

Before creating any issues, check what already exists for this stream:

```bash
gh issue list --label "stream:$ARGUMENTS" --state all --limit 100 --json number,title,state
```

Also check for issues from the original phases that overlap with this stream:

```bash
# For each phase that contributes sub-items to this stream
gh issue list --label "phase:N" --state all --limit 100 --json number,title,state
```

If issues already exist for this stream or for overlapping phase sub-items, report them to the user and ask how to proceed:

- Skip already-created sub-items?
- Recreate everything (will create duplicates)?
- Stop and let the user clean up first?

## Step 5 -- Plan the Issue Decomposition

For each sub-item scoped to this stream, plan how to split it into individual issues. Use these rules:

### Splitting Rules

1. **One issue = one independently testable unit of work.** If you can't write a single test command for it, it's too big or too vague.

2. **Respect the stream's scope.** If this is Stream B (Pure Domain Logic), every issue must be in `packages/core/` or `packages/analytics/`. If this is Stream D (Web UI), every issue must be in `apps/web/` or `packages/ui/`. Do not let scope creep across stream boundaries.

3. **Never combine layers in one issue.** Separate:
   - Schema/migration issues (SQL)
   - Pure logic issues (TypeScript in `packages/core/` or `packages/analytics/`)
   - API route issues (Hono in `apps/api/`)
   - Client/state issues (`packages/data-access/`, `packages/state/`)
   - UI issues (`apps/web/`, `apps/mobile/`, `packages/ui/`)
   - Infrastructure issues (CI, config, tooling)
   - Firmware issues (C++ in `firmware/device/`)

4. **Use the data->logic->UI dependency order.** Within a sub-item, issues should flow: types/schema -> core logic -> API -> client SDK -> state -> UI.

5. **Each issue must have a test command.** For TypeScript: `pnpm nx test @pomofocus/[package]`. For firmware: `pio test` or serial verification. For CI: "push a branch and verify CI passes." For SQL: `supabase db push` or integration test.

6. **Group by natural boundaries, not by arbitrary line counts.** "Timer idle->focusing transition + test" is one issue. "Lines 1-50 of transition.ts" is NOT an issue.

7. **Use exact Nx tag names from coding-standards-eslint-nx.md Section 4.** Do NOT invent tag names. The canonical tags are: `type:types`, `type:domain`, `type:infra`, `type:ble`, `type:state`, `type:ui`, `type:app` (plus scope tags). If you use `type:core` or `type:analytics`, you are wrong -- both map to `type:domain`.

8. **Count against design doc DDL, not ADR summaries.** ADR summary text may round or include managed tables. Count the actual `CREATE TABLE` statements in the design doc for the real number.

9. **Include indexes with their tables.** If the design doc defines indexes for a table, add them to that table's migration issue acceptance criteria. Do not silently omit indexes.

10. **Include exact SQL function signatures.** For SQL function issues, specify: return type, `LANGUAGE`, volatility (`STABLE`/`VOLATILE`/`IMMUTABLE`), and security context (`SECURITY DEFINER`/`INVOKER`).

11. **Flag source doc conflicts.** If the roadmap, product brief, ADRs, or design docs contradict each other on a point relevant to an issue, add a visible note in the issue's Context section flagging the conflict. Do not silently pick one source.

12. **Plan batch-ship groups.** As you plan issues, identify sibling issues that have no dependency on each other and can be `/batch-ship`ped together. These will be surfaced in the tracking issue (Step 9).

### Issue Sizing Guidelines

- **effort:small** -- < 1 hour, < 10 files, single concern. This is the DEFAULT for decomposed issues.
- **effort:large** -- Only if a sub-item is so complex it needs its own decomposition pass. Rare.
- **needs-human** -- If a sub-item requires a decision not captured in any ADR or design doc.

## Step 6 -- Determine Labels for Each Issue

Every issue gets these labels:

- `agent-ready` (unless `needs-human`)
- `effort:small` (unless explicitly large)
- `stream:$ARGUMENTS` (e.g., `stream:A`, `stream:B`)
- `phase:N` (the ORIGINAL phase the sub-item comes from, e.g., `phase:2`, `phase:3`, `phase:5`)

Plus ONE platform label based on the affected files:

- `platform:shared` -- `packages/` (anything cross-platform)
- `platform:web` -- `apps/web/`
- `platform:api` -- `apps/api/`
- `platform:mobile` -- `apps/mobile/`
- `platform:ios-widget` -- `apps/mobile/targets/ios-widget/`
- `platform:firmware` -- `firmware/device/`
- `platform:infra` -- `.github/`, `supabase/`, root config files

Plus a type label:

- `enhancement` -- new feature or capability
- `chore` -- scaffolding, config, infrastructure (no user-facing change)

When specifying Nx project tags in issue body (Affected Files or Acceptance Criteria), always include BOTH dimensions from `coding-standards-eslint-nx.md` Section 4:

- Type tag: `type:domain`, `type:types`, `type:infra`, `type:ble`, `type:state`, `type:ui`, `type:app`
- Scope tag: `scope:shared`, `scope:web`, `scope:mobile`, `scope:vscode`, `scope:mcp`

## Step 7 -- Ensure Labels Exist

Before creating issues, ensure all required labels exist. Run:

```bash
gh label list --limit 100 --json name
```

For any label that doesn't exist yet, create it:

```bash
# Stream labels (color: purple tones to distinguish from phase labels)
gh label create "stream:A" --color "7B68EE" --description "Stream A: Auth Foundation" 2>/dev/null || true
gh label create "stream:B" --color "9370DB" --description "Stream B: Pure Domain Logic" 2>/dev/null || true
gh label create "stream:C" --color "8A2BE2" --description "Stream C: API + Sync Wiring" 2>/dev/null || true
gh label create "stream:D" --color "6A5ACD" --description "Stream D: Web Session Experience" 2>/dev/null || true
gh label create "stream:E" --color "483D8B" --description "Stream E: Mobile + iOS Widget" 2>/dev/null || true
gh label create "stream:F" --color "5F4B8B" --description "Stream F: Social Features" 2>/dev/null || true
gh label create "stream:G" --color "4B0082" --description "Stream G: Firmware" 2>/dev/null || true
gh label create "stream:H" --color "663399" --description "Stream H: BLE Integration" 2>/dev/null || true
gh label create "stream:Z" --color "800080" --description "Stream Z: Polish + Ship" 2>/dev/null || true

# Phase labels (if not already created)
gh label create "phase:1" --color "0E8A16" --description "Phase 1: Walking Skeleton" 2>/dev/null || true
gh label create "phase:2" --color "0E8A16" --description "Phase 2: Auth + Sync + Goals" 2>/dev/null || true
gh label create "phase:3" --color "0E8A16" --description "Phase 3: Session Lifecycle + Reflection" 2>/dev/null || true
gh label create "phase:4" --color "0E8A16" --description "Phase 4: Mobile App" 2>/dev/null || true
gh label create "phase:5" --color "0E8A16" --description "Phase 5: Analytics" 2>/dev/null || true
gh label create "phase:6" --color "0E8A16" --description "Phase 6: iOS Widget" 2>/dev/null || true
gh label create "phase:7A" --color "0E8A16" --description "Phase 7A: Device Firmware" 2>/dev/null || true
gh label create "phase:7B" --color "0E8A16" --description "Phase 7B: BLE Protocol + Client Integration" 2>/dev/null || true
gh label create "phase:8" --color "0E8A16" --description "Phase 8: Social Features" 2>/dev/null || true
gh label create "phase:9" --color "0E8A16" --description "Phase 9: Polish + Ship" 2>/dev/null || true

# Platform labels (if not already created)
gh label create "platform:shared" --color "1D76DB" --description "packages/ (cross-platform)" 2>/dev/null || true
gh label create "platform:api" --color "D93F0B" --description "apps/api/ (Hono on CF Workers)" 2>/dev/null || true
gh label create "platform:web" --color "0075CA" --description "apps/web/ (Expo web on Vercel)" 2>/dev/null || true
gh label create "platform:mobile" --color "E4E669" --description "apps/mobile/ (Expo iOS + Android)" 2>/dev/null || true
gh label create "platform:ios-widget" --color "F9D0C4" --description "apps/mobile/targets/ios-widget/" 2>/dev/null || true
gh label create "platform:firmware" --color "B60205" --description "firmware/device/ (PlatformIO/C++)" 2>/dev/null || true
gh label create "platform:infra" --color "666666" --description "CI, config, tooling" 2>/dev/null || true

# Other labels
gh label create "tracking" --color "C5DEF5" --description "Tracking issue (parent of sub-issues)" 2>/dev/null || true
```

Use `2>/dev/null || true` so existing labels don't cause errors.

## Step 8 -- Create Issues (Batch)

For each issue, create it using `gh issue create`. Use the **exact template below** -- do not deviate from this structure:

````bash
gh issue create \
  --title "[Sub-item number] [Short descriptive title]" \
  --label "agent-ready,effort:small,stream:$ARGUMENTS,phase:$PHASE,[platform-label],[type-label]" \
  --body "$(cat <<'EOF'
## Goal

[One-sentence verifiable assertion. What must be true when this is done?]

## Context & Background

Stream $ARGUMENTS ([Stream Name]), phase sub-item [N.M] of the [MVP Roadmap](../research/mvp-roadmap.md).
[If depends on another issue: "**Depends on:** #[number] -- must be merged first."]

**Stream scope:** [Explain what portion of this sub-item belongs to this stream. For split sub-items, be explicit about what is IN scope and what belongs to another stream.]

**Referenced ADRs:**
- [ADR-NNN](../research/decisions/NNN-*.md) -- [one-line summary of what's relevant]

**Referenced design docs:**
- [Design doc](../research/designs/*.md) -- [one-line summary of what's relevant]

## Affected Files

- `[exact/path/from/repo/root.ext]` -- [what to create or modify]
- `[exact/path/to/test/file.test.ts]` -- [test file to create]

## Acceptance Criteria

- [ ] [Specific, automatable criterion]
- [ ] [Another criterion]
- [ ] `[test command]` passes with no failures
- [ ] `pnpm type-check` exits clean (for TS issues)

## Out of Scope

- Do NOT implement portions of this sub-item that belong to other streams
- [Stream-specific boundary: e.g., "API endpoints for goals belong to Stream C, not this issue"]
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
> **Depends on:** #[A's number] -- must be merged first.

Create issues in dependency order (upstream first) so you have the issue numbers to reference.

## Step 9 -- Create Stream Tracking Issue

After all sub-issues are created, create a single tracking issue for the stream:

```bash
gh issue create \
  --title "Stream $ARGUMENTS: [Stream Name]" \
  --label "stream:$ARGUMENTS,tracking" \
  --body "$(cat <<'EOF'
## Stream $ARGUMENTS: [Stream Name]

### Stream Dependencies

[Draw the stream dependency graph -- what must complete before this stream can start]

```
[ASCII dependency diagram showing which streams/phases must be done first]
```

### Phase Sub-Items in This Stream

[List every phase sub-item included, with the stream scope noted for split sub-items]

- **[N.M] [Sub-item name]** (from Phase N) [-- stream scope if split]

### Issues by Sub-Item

#### [N.M] [Sub-item name]
- [ ] #[issue1] -- [title]
- [ ] #[issue2] -- [title]
- [ ] #[issue3] -- [title]

#### [N.M] [Sub-item name]
- [ ] #[issue4] -- [title]
- [ ] #[issue5] -- [title]

[... for all sub-items]

### Implementation Order

[Describe the dependency graph within this stream -- which issues can be parallelized, which must be sequential. Use a numbered list for sequential steps, with parallel items grouped.]

### Batch-Ship Groups

Issues within each group have NO dependency on each other and CAN be `/batch-ship`ped together for maximum parallelism. Run the exact command shown.

**Group 1: [descriptive name]**
Issues: #[a], #[b], #[c]
```bash
/batch-ship #[a] #[b] #[c]
```

**Group 2: [descriptive name]**
Depends on: Group 1 complete
Issues: #[d], #[e]
```bash
/batch-ship #[d] #[e]
```

[... for all groups. Every issue must appear in exactly one group.]

### Total: [N] issues created
EOF
)"
````

## Step 10 -- Final Report

Output a summary to the user:

1. **Stream decomposed:** Stream $ARGUMENTS -- [name]
2. **Issues created:** [total count]
3. **Tracking issue:** #[number]
4. **Issue breakdown by sub-item:**
   - [N.M] [name] (Phase N): #[x], #[y], #[z] ([count] issues)
   - [N.M] [name] (Phase N): #[a], #[b] ([count] issues)
   - ...
5. **Stream dependencies:** [what must complete before this stream starts]
6. **Internal dependency chain:** [describe which issues must go first within this stream]
7. **Batch-ship groups:** [summary of groups with commands]
8. **`needs-human` issues (if any):** #[n] -- [what decision is needed]
9. **Recommended first pick:** "Start with Group 1 -- run `/batch-ship #[a] #[b] #[c]`"

## Guidelines

- **Read before writing.** Do not create issues from the roadmap alone. The ADRs and design docs have the details you need for specific file paths, type names, and interface definitions.
- **Be specific.** "Implement goals core logic" is too vague. "Implement long-term goal types, process goal types, and streak calculation with 1-day grace period in `packages/core/src/goals/`" is specific.
- **Include the WHY.** The Context section should explain why this issue matters and what it unblocks -- agents that understand the purpose make better decisions.
- **Test commands are mandatory.** Every issue must have a runnable test command. If the work is infrastructure (CI, config), the test is "push a branch and verify."
- **Respect stream boundaries.** The whole point of streams is parallel execution. If an issue in Stream B depends on something in Stream C, it is in the WRONG stream. Re-examine the split.
- **Split sub-items correctly.** When a sub-item appears in multiple streams, each stream's issues must be independently testable WITHOUT the other stream's work being done. Stream B issues test with pure function calls. Stream C issues test with API integration tests (mocking core if needed). Stream D issues test with component renders (mocking state if needed).
- **Batch-ship groups are mandatory.** Every issue must appear in exactly one batch-ship group in the tracking issue. Groups should maximize parallelism -- siblings with no dependency on each other go in the same group.
- **Don't over-decompose.** Respect the roadmap's estimated issue counts (pro-rated for the stream's portion of split sub-items).
- **Don't under-decompose.** If a sub-item has 8-10 estimated issues and this stream owns half the scope, create 4-5 issues, not 1-2.
- **Cross-reference other streams.** In "Out of Scope" sections, explicitly name which stream owns the excluded work. For example: "API endpoints for goals belong to Stream C (#[tracking-issue-number])."
