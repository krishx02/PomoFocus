---
name: ship-issue
description: Pick up a GitHub issue by number. If effort:large, decomposes it into sub-issues instead of implementing. If needs-human, comments a blocker and stops. Otherwise creates a branch, reads affected files, implements, and runs tests until all pass. Use when user says "implement issue", "pick up issue #N", "work on this issue", or "start issue".
user-invocable: true
context: fork
isolation: worktree
allowed-tools: Bash(gh *), Bash(git *), Bash(pnpm *), Bash(xcodebuild *), Read, Edit, Write, Grep, Glob
compatibility: "Requires gh CLI, git, pnpm. Claude Code only."
argument-hint: "[issue number]"
metadata:
  author: PomoFocus
  version: 1.0.0
---

Issue number: $ARGUMENTS

## Step 1 — Read the Issue

```
gh issue view $ARGUMENTS --json number,title,body,labels,assignees
```

Read the full output. Identify:
- The **Goal** (one-sentence verifiable assertion)
- The **Affected Files** list
- The **Acceptance Criteria** checklist
- The **Out of Scope** list
- The **Test Plan** command(s)
- The **Platform** dropdown value
- All **labels** on the issue

## Step 2 — Check Labels

**If the issue has label `effort:large`:**
- DO NOT implement anything
- Run the `/decompose-issue $ARGUMENTS` skill
- Stop after decomposition — do not proceed

**If the issue has label `needs-human`:**
- DO NOT implement anything
- Read the existing comments to understand what decision is needed
- Post a comment explaining the specific blocker:
  ```bash
  gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
## Blocked — Needs Human Decision

[Explain exactly what decision is needed and why the agent cannot proceed without it]
EOF
)"
  ```
- Stop

**If neither label is present:** proceed to Step 3.

## Step 3 — Ensure Correct Branch

First, check if you're already on a branch for this issue:
```bash
current=$(git branch --show-current)
echo "Current branch: $current"
```

**If the current branch contains `issue-$ARGUMENTS`** (e.g., `feature/issue-34-some-slug`): you're already on the right branch. Skip branch creation and proceed directly to Step 4.

**Otherwise**, create or switch to the issue branch:

Derive the branch slug from the issue title (lowercase, hyphens, max 40 chars).

Determine branch type from the issue labels:
- If the issue has label `bug` → use the `fix/` prefix
- Otherwise → use the `feature/` prefix

For bugs:
```bash
if git checkout -b fix/issue-$ARGUMENTS-<slug>; then
  : # new branch created
elif git checkout fix/issue-$ARGUMENTS-<slug>; then
  : # switched to existing branch — verify below
else
  echo "ERROR: could not create or switch to branch. Run 'git worktree list' — if this branch is checked out in another worktree, remove that worktree first." >&2
  exit 1
fi
```

For features:
```bash
if git checkout -b feature/issue-$ARGUMENTS-<slug>; then
  : # new branch created
elif git checkout feature/issue-$ARGUMENTS-<slug>; then
  : # switched to existing branch — verify below
else
  echo "ERROR: could not create or switch to branch. Run 'git worktree list' — if this branch is checked out in another worktree, remove that worktree first." >&2
  exit 1
fi
```

Verify you are on the correct branch before continuing:
```bash
git branch --show-current
```

Update the issue label to `in-progress`:
```
gh issue edit $ARGUMENTS --add-label "in-progress"
```

## Step 4 — Read All Affected Files

Before writing a single line of code, read every file listed in the issue's "Affected Files" section. Understand what each file does and how they relate. This is not optional.

## Step 5 — Plan Before Acting

Enter Plan Mode mentally: draft an implementation plan before touching any files.

Verify your plan:
- Does it satisfy every acceptance criterion?
- Does it avoid touching every file listed in "Out of Scope"?
- Is the approach consistent with existing code patterns in the affected files?

If any acceptance criterion is ambiguous, or if the plan would require touching out-of-scope files to work correctly: apply `needs-human` label, post a comment explaining, and stop.

## Step 6 — Implement

Make the changes required to satisfy all acceptance criteria.

Rules:
- Do NOT modify files listed in "Out of Scope"
- Do NOT add dependencies without noting them prominently in the PR
- Follow the existing patterns in each file you modify — read before editing
- Write tests for any new business logic (tests go alongside implementation, not after PR)

Do NOT commit yet — the commit happens after tests and type-check pass in Step 7.

## Step 7 — The Ralph Loop (Verify Until Pass)

Run the Test Plan command from the issue.

```
[exact command from issue's Test Plan field]
```

If tests fail:
1. Read the failure output carefully
2. Fix the failure
3. Run tests again
4. Repeat until all tests pass

**Iteration limit:** If tests are still failing after 5 attempts, stop the loop:
```bash
gh issue edit $ARGUMENTS --remove-label "in-progress" --add-label "needs-human"
gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
## Ralph Loop Exhausted — Needs Human

Tests are still failing after 5 fix attempts. The failure may require
infrastructure unavailable in this environment, involve a pre-existing flake,
or need a deeper design decision.

Please review the test failure output and resolve the root cause manually.
EOF
)"
```
Stop — do not open a PR.

Do NOT open a PR with failing tests.

Also run:
```
pnpm type-check
```

If type errors exist, fix them before proceeding.

After tests pass AND type-check is clean, stage and commit:
```bash
# Stage only files from the issue's Affected Files list + any new test files written.
# Do NOT use git add -A — it can accidentally include generated files or debugging artifacts.
git add [each file from Affected Files list, plus any new test files]

# Verify what's staged before committing — unstage anything unexpected:
git status

git commit -m "[type]: [short description] (#$ARGUMENTS)"
```
Use the conventional commit prefix matching the issue type: `feat`, `fix`, `refactor`, `test`, or `docs`.

## Step 8 — Pre-Finalize Verification

Unit tests pass and code is committed. Now run broader verification before pushing.

### 8a — Detect Affected Platforms

```bash
git fetch origin main
git diff --name-only origin/main...HEAD
```

Map changed files to platform buckets:

| Prefix | Bucket |
|--------|--------|
| `packages/core/`, `packages/types/` | `core` |
| `packages/analytics/` | `analytics` |
| `packages/data-access/` | `data-access` |
| `packages/state/` | `state` |
| `packages/ui/` | `ui` |
| `packages/ble-protocol/` | `ble-protocol` |
| `apps/web/` | `web` |
| `apps/mobile/` | `mobile` |
| `apps/vscode-extension/` | `vscode` |
| `apps/mcp-server/` | `mcp-server` |

Files not matching any prefix (docs, CI config, root config) do not trigger platform tests — skip them.

### 8b — Build Verification

Run Nx affected build if configured:
```bash
pnpm nx affected --target=build --base=origin/main --head=HEAD 2>/dev/null || echo "SKIP: Nx build not configured yet"
```

### 8c — Integration & E2E Tests

For each affected platform, check if test infrastructure exists and run it. Skip gracefully if not configured:

```bash
# Nx affected tests (catches downstream failures)
pnpm nx affected --target=test --base=origin/main --head=HEAD 2>/dev/null || echo "SKIP: Nx test not configured"

# Web E2E (Playwright)
if [ -d "apps/web-e2e" ]; then
  pnpm nx e2e @pomofocus/web-e2e
else
  echo "SKIP: apps/web-e2e/ not configured"
fi

# Mobile E2E (Maestro)
if [ -d "apps/mobile/maestro" ] && command -v maestro &>/dev/null; then
  maestro test apps/mobile/maestro/
else
  echo "SKIP: Maestro not configured"
fi
```

### 8d — Fix Loop (if failures)

If any check in 8b-8c fails:
1. Read the failure output carefully
2. Fix the root cause
3. Stage and commit: `git commit -m "fix: address pre-finalize failure (attempt N) (#$ARGUMENTS)"`
4. Re-run only the failing check
5. **Iteration limit: 3 attempts.** If still failing after 3 tries:

```bash
gh issue edit $ARGUMENTS --add-label "needs-human"
gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
## Pre-Finalize Test Loop Exhausted — Needs Human

Integration or build checks are still failing after 3 fix attempts.
Unit tests pass. The failure is in broader verification (build, E2E, cross-package).

Please review the test failure and resolve the root cause manually.
EOF
)"
```
Stop — do not push or open a PR.

## Step 9 — Push and Stop

All checks pass (unit tests, type-check, build, integration/E2E). Push the branch and stop.

```bash
git push -u origin $(git branch --show-current)
```

Then output exactly this message (substituting real values):

```
Implementation complete for issue #$ARGUMENTS.
Branch pushed: [BRANCH_NAME]

All pre-finalize checks passed (or appropriately skipped).

Start a new Claude Code session and run:
  /finalize $ARGUMENTS
```

Do NOT call `/finalize` here. Do NOT create the PR or update labels. Stop completely — `/finalize` runs in a separate context window to keep it clean.
