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

If `$ARGUMENTS` is provided, use it as the issue number.

If `$ARGUMENTS` is empty, parse the issue number from the current branch name:

```bash
git branch --show-current
```

Branch format is `feature/issue-N-<slug>` or `fix/issue-N-<slug>`. Extract `N`.

If no issue number can be determined, stop and ask the user: "Which issue number should I finalize?"

Store: `ISSUE_NUMBER`, `BRANCH_NAME`.

---

## Step 2 — Check for Existing PR

```bash
gh pr list --head $BRANCH_NAME --json number,url,state
```

If a PR already exists (state: OPEN): record `PR_URL` and `PR_NUMBER`, skip Step 3.
If no PR exists: proceed to Step 3.

---

## Step 3 — Launch github-issue-manager

Launch the `github-issue-manager` subagent with this context:

```
You are the github-issue-manager subagent.
ISSUE_NUMBER: [issue number]
BRANCH_NAME: [branch name]

Follow your agent instructions completely.
Return the PR URL and PR number on the last line in the format:
  PR created: [URL] | Issue #N updated: in-progress → in-review
```

Wait for the agent to complete. Parse `PR_URL` and `PR_NUMBER` from its output.

---

## Step 4 — Launch code-reviewer

Launch the `code-reviewer` subagent with this context:

```
You are the code-reviewer subagent.
PR_NUMBER: [PR number]
ISSUE_NUMBER: [issue number]
BRANCH_NAME: [branch name]

Follow your agent instructions completely.
Return your findings summary on the last line in the format:
  Review complete on PR #N
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
