---
name: decompose-issue
description: Break a large GitHub issue (labeled effort:large) into 3-5 smaller, agent-ready sub-issues using the data→logic→UI split pattern. Called automatically by /ship-issue when effort:large is detected, or invoked directly. Use when user says "break down this issue", "split issue", "this is too large", or "decompose issue #N".
user-invocable: true
context: conversation
allowed-tools: Bash(gh *), Bash(git *), Bash(pnpm *), Read, Grep, Glob
compatibility: 'Requires gh CLI, git. Claude Code only.'
argument-hint: '[issue number]'
metadata:
  author: PomoFocus
  version: 1.0.0
---

Issue number: $ARGUMENTS

## Step 1 — Read the Parent Issue

```
gh issue view $ARGUMENTS --json number,title,body,labels,comments
```

Read the full body. Identify:

- The overall Goal
- All Affected Files
- All Acceptance Criteria
- Platform
- Any Out of Scope constraints that apply to ALL sub-issues

## Step 2 — Explore the Codebase

Read the files listed in "Affected Files". Understand the full scope:

- How many layers are involved (data / logic / UI)?
- Which parts are independent vs. which depend on others?
- What is the minimum viable split that makes each piece independently testable?

## Step 3 — Draft Sub-Issues

Break the work into 3–5 sub-issues. Rules:

1. **Each sub-issue must be completable in a single Claude Code session** (roughly <1 hour, <10 files)
2. **Each sub-issue must be independently testable** — has its own passing test as a completion criterion
3. **Sub-issues that depend on each other** must be numbered in order and note their dependency explicitly
4. **Each sub-issue must be fully agent-ready** — goal, context, affected files, acceptance criteria, out of scope, test plan, platform
5. If a sub-issue cannot be fully specified without a human decision, label it `needs-human` instead of `agent-ready`

**The PomoFocus split pattern (default when in doubt):**

- **Sub-issue A — Data/State layer:** Store, model, TypeScript types, Supabase schema changes
- **Sub-issue B — Service/Logic layer:** Hooks, utilities, API client, business logic
- **Sub-issue C — UI layer:** Component, screen, widget — depends on A and B; no business logic in UI
- **Sub-issue D — Tests and documentation** (if testing for A-C is extensive enough to be its own issue)

Never combine data + UI in a single sub-issue.

## Step 4 — Create Sub-Issues

For each sub-issue, create it with the full agent-ready template:

```bash
gh issue create \
  --title "[short descriptive title]" \
  --label "agent-ready,effort:small,[platform-label]" \
  --body "$(cat <<'EOF'
## Goal
[One-sentence verifiable assertion.]

## Context & Background
Part [N] of #$ARGUMENTS — [parent title].
[If depends on a sibling: "Depends on: #[sibling number] — must be merged first."]

## Affected Files
[Specific files for this sub-issue only — not the full parent list]
- `[exact/path/from/repo/root.ts]` — [what this file does]

## Acceptance Criteria
- [ ] [automatable criterion]
- [ ] `pnpm nx test @pomofocus/[package]` passes with no new failures
- [ ] `pnpm type-check` exits clean

## Out of Scope
Do not implement other parts of #$ARGUMENTS in this issue.
[Add any additional constraints specific to this sub-issue]

## Test Plan
[Exact command(s)]

## Platform
[iOS / Android / Web / Shared / etc.]
EOF
)"
```

Record the issue number returned for each sub-issue.

## Step 5 — Update the Parent Issue

Comment a tracking task list on the parent:

```bash
gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
## Decomposed into sub-issues

This issue has been broken into smaller, agent-ready pieces:

- [ ] #[sub1] — [title] (data/state layer)
- [ ] #[sub2] — [title] (service/logic layer)
- [ ] #[sub3] — [title] (UI layer)

**Implementation order:** #[sub1] → #[sub2] → #[sub3]

Each sub-issue is labeled \`agent-ready\` and can be picked up with \`/ship-issue N\`.
This issue will be closed manually when all sub-issues are merged.
EOF
)"
```

Then relabel the parent:

```bash
gh issue edit $ARGUMENTS \
  --remove-label "effort:large,agent-ready" \
  --add-label "decomposed"
```

## Step 6 — Final Report

Output a summary:

- Number of sub-issues created and their GitHub issue numbers
- Titles and brief descriptions
- Dependency order
- Any sub-issues that could not be fully specified and were labeled `needs-human` (and what decision is needed)
- Recommended implementation order

## "Too Large" Signals (for reference)

An issue should be decomposed if ANY of:

- Changes to more than ~10 files
- Spans multiple layers (data + logic + UI in the same issue)
- Acceptance criteria list is longer than 8 items
- Contains "refactor X," "migrate Y," or "redesign Z" without narrow scope
- The implementation would touch multiple platform directories
