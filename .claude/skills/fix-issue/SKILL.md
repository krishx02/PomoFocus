---
name: fix-issue
description: Pick up a GitHub issue by number. If effort:large, decomposes it into sub-issues instead of implementing. If needs-human, comments a blocker and stops. Otherwise: creates a branch, reads affected files, implements, runs tests until all pass, opens a PR, and updates labels.
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
  ```
  gh issue comment $ARGUMENTS --body "## Blocked — Needs Human Decision\n\n[Explain exactly what decision is needed and why the agent cannot proceed without it]"
  ```
- Stop

**If neither label is present:** proceed to Step 3.

## Step 3 — Create a Branch

Derive the branch slug from the issue title (lowercase, hyphens, max 40 chars).

For bugs:
```
git checkout -b fix/issue-$ARGUMENTS-<slug>
```

For features:
```
git checkout -b feature/issue-$ARGUMENTS-<slug>
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

Do NOT open a PR with failing tests.

Also run:
```
pnpm type-check
```

If type errors exist, fix them before proceeding.

## Step 8 — Open the PR

```
gh pr create \
  --title "[type]: [issue title] (#$ARGUMENTS)" \
  --body "$(cat <<'EOF'
Closes #$ARGUMENTS

## Changes
[Bullet-point summary of what was changed and why]

## Test Results
[Paste the passing test output or describe what was run]

## Out of Scope Respected
[Confirm which files were NOT touched per the issue's Out of Scope]
EOF
)"
```

Where `[type]` is `feat`, `fix`, `refactor`, `test`, or `docs` depending on the issue type.

## Step 9 — Update Labels

```
gh issue edit $ARGUMENTS \
  --remove-label "in-progress" \
  --add-label "in-review"
```

## Final Report

Output a concise summary:
- Branch name created
- Files changed (list)
- Test results (pass/fail counts)
- PR URL
- Any deviations from the issue spec and why
