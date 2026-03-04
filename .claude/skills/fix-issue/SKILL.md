---
name: fix-issue
description: Pick up a GitHub issue by number. If effort:large, decomposes it into sub-issues instead of implementing. If needs-human, comments a blocker and stops. Otherwise: creates a branch, reads affected files, implements, and runs tests until all pass. Calls /finalize when done — does not manage the PR or labels directly.
user-invocable: true
context: fork
isolation: worktree
allowed-tools: Bash(gh *), Bash(git *), Bash(pnpm *), Bash(xcodebuild *), Read, Edit, Write, Grep, Glob
argument-hint: "[issue number]"
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

## Step 3 — Create a Branch

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

## Step 8 — Hand Off to Finalize

Tests pass, type-check is clean, and changes are committed. Your implementation work is done.

Invoke the `/finalize` skill:

```
/finalize $ARGUMENTS
```

Stop here — do not create the PR or update labels directly. The `/finalize` skill handles all GitHub state: PR creation, label transitions, and code review.
