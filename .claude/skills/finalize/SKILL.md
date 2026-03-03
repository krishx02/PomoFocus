---
name: finalize
description: Orchestrates the end of a completed implementation. Launches the github-issue-manager subagent to create a descriptive PR and update labels, then launches the code-reviewer subagent to post inline review comments. Call this after all tests pass. Can also be called manually to finalize any branch.
user-invocable: true
context: fork
allowed-tools: Bash(gh *), Bash(git *), Agent
argument-hint: "[issue number]"
---

Issue number: $ARGUMENTS

You are the finalization orchestrator. The implementation is done and tests pass. Your job is to hand off to two specialized agents — one that creates the PR, one that reviews it — and report the outcome.

Do NOT implement any code. Do NOT read or modify source files. You are a coordinator only.

---

## Step 1 — Detect Issue Number and Branch

Get the current branch:
```bash
git branch --show-current
```

Store as `BRANCH_NAME`.

**Determine `ISSUE_NUMBER` using this priority order:**

1. If `$ARGUMENTS` is provided and is a number, use it.
2. Parse from branch name — format is `feature/issue-N-<slug>` or `fix/issue-N-<slug>`. Extract `N`.
3. Scan recent commit messages for an issue reference:
   ```bash
   git log --oneline origin/main..HEAD | grep -oP '(?<=#)\d+' | head -1
   ```
4. If still unresolved, ask the user:
   ```
   "I'm on branch '[BRANCH_NAME]' and cannot find an issue number in the branch name or recent commits.
   Which GitHub issue number does this branch implement? (type 'none' if there is no associated issue)"
   ```

Store `ISSUE_NUMBER` (a number, or the string `"none"`).

---

## Step 2 — Check for Existing PR

```bash
gh pr list --head $BRANCH_NAME --json number,url,state
```

**If a PR already exists (state: OPEN):**
- Record `PR_URL` and `PR_NUMBER` from this output.
- If `ISSUE_NUMBER` is not "none", run the label update inline (since github-issue-manager will be skipped):
  ```bash
  CURRENT_LABELS=$(gh issue view $ISSUE_NUMBER --json labels --jq '.labels[].name')
  if echo "$CURRENT_LABELS" | grep -q "in-progress"; then
    gh issue edit $ISSUE_NUMBER --remove-label "in-progress"
  fi
  gh issue edit $ISSUE_NUMBER --add-label "in-review"
  ```
- Skip to Step 4.

**If no open PR exists:** proceed to Step 3.

---

## Step 3 — Launch github-issue-manager

Launch the `github-issue-manager` subagent with this context:

```
You are the github-issue-manager subagent.
ISSUE_NUMBER: [issue number or "none"]
BRANCH_NAME: [branch name]

Follow your agent instructions completely.
Your final output line must match exactly:
  PR: [URL] (#[PR_NUMBER]) | Issue #N: in-progress → in-review
  or for no-issue branches:
  PR: [URL] (#[PR_NUMBER]) | No issue — infrastructure branch
```

Wait for the agent to complete.

**Parse the output:**
- Look for a line starting with `PR: https://`
- Extract `PR_URL` (the URL) and `PR_NUMBER` (the integer inside `(#...)`)

**If the output does not contain a line starting with `PR: https://`:**
- Stop immediately
- Report to the user: `"github-issue-manager failed to create the PR. Raw output: [output]"`
- Do not proceed to Step 4.

---

## Step 4 — Launch code-reviewer

Launch the `code-reviewer` subagent with this context:

```
You are the code-reviewer subagent.
PR_NUMBER: [PR number]
ISSUE_NUMBER: [issue number or "none"]
BRANCH_NAME: [branch name]

Follow your agent instructions completely.
Your final output must include:
  Review complete on PR #[N]
  🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N
  Verdict: [LGTM / Needs Changes / Critical Fixes Required]
```

Wait for the agent to complete. Parse the findings summary from its output.

---

## Step 5 — Final Report

Output a clean summary to the user:

```
✅ Finalize complete for issue #[ISSUE_NUMBER]

📝 PR: [PR_URL]
🏷️  Labels: in-progress → in-review

🔍 Code Review Results:
   🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N
   Verdict: [verdict]

[If Critical > 0]:
⚠️  Critical issues were found. Review the PR comments before merging.

[If Critical == 0 and Warnings == 0]:
🚀 No critical issues. Ready for human review.
```
