---
name: finalize
description: Orchestrates the end of a completed implementation. Launches the github-issue-manager subagent to create a descriptive PR and update labels, then launches the code-reviewer subagent to post inline review comments. Loops the review up to 3 times if critical issues are found, auto-fixing before each re-review. Call this after all tests pass. Can also be called manually to finalize any branch.
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
3. Scan recent commit messages for an issue reference (requires GNU grep):
   ```bash
   git log --oneline origin/main..HEAD | grep -oE '#[0-9]+' | grep -oE '[0-9]+' | head -1
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
- Push any new commits so the remote branch is up to date:
  ```bash
  git push -u origin $BRANCH_NAME
  ```
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

## Step 4 — Launch code-reviewer (with auto-fix loop)

Set `REVIEW_PASS = 1` and `MAX_REVIEW_PASSES = 3`.

**Review loop** — repeat until verdict is LGTM or max passes exceeded:

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

Wait for the agent to complete. Parse `Critical` count and `Verdict` from its output.

**After the reviewer returns:**

- **If Verdict = "LGTM"** → proceed to Step 5.

- **If Critical > 0 AND REVIEW_PASS < MAX_REVIEW_PASSES:**
  1. Report to the user: `"Review pass [REVIEW_PASS]: Found [Critical] critical issue(s). Attempting auto-fix..."`
  2. Fetch the critical inline comments via the GitHub API:
     ```bash
     REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
     gh api repos/$REPO/pulls/$PR_NUMBER/comments \
       --jq '.[] | select(.body | startswith("🔴")) | {body, path, original_line}'
     ```
  3. Use the Agent tool with `subagent_type: general-purpose` to fix the critical findings.
     Provide this prompt (substituting real values for bracketed placeholders):
     ```
     You are a code fixer. You have been given the following 🔴 CRITICAL review comments
     from a code review of branch [BRANCH_NAME]. Fix each one. Do not change anything else.

     [paste the JSON output from the gh api command above]

     After fixing all issues:
     - Stage only the changed files by name (do NOT use git add -A)
     - Run: git commit -m "fix: address critical review comments (pass [REVIEW_PASS])"
     - Run: git push -u origin [BRANCH_NAME]
     ```
  4. Increment `REVIEW_PASS`.
  5. Return to the top of the review loop (re-launch code-reviewer).

- **If Critical > 0 AND REVIEW_PASS >= MAX_REVIEW_PASSES:**
  1. If ISSUE_NUMBER is not "none":
     ```bash
     gh issue edit $ISSUE_NUMBER --add-label "needs-human"
     gh issue comment $ISSUE_NUMBER --body "$(cat <<'EOF'
     ## Review Loop Exhausted — Needs Human

     Critical issues found by the code-reviewer persist after 3 auto-fix passes.
     Please review the PR comments and resolve the critical findings manually.
     EOF
     )"
     ```
  2. Stop. Report to user: `"Critical issues persist after 3 review passes. Needs human review. PR: [PR_URL]"`

- **If Critical == 0 (only Warnings/Info)** → proceed to Step 5.
  Warnings are informational — the human reviewer decides whether to fix them before merging.

---

## Step 5 — Final Report

Output a clean summary to the user:

```
[If ISSUE_NUMBER is not "none":]
✅ Finalize complete for issue #[ISSUE_NUMBER]
[If ISSUE_NUMBER is "none":]
✅ Finalize complete — infrastructure branch

📝 PR: [PR_URL]
[If ISSUE_NUMBER is not "none":]
🏷️  Labels: in-progress → in-review
[If ISSUE_NUMBER is "none":]
🏷️  Labels: N/A — no associated issue

🔍 Code Review Results:
   🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N
   Verdict: [verdict]

[If Critical > 0]:
⚠️  Critical issues were found. Review the PR comments before merging.

[If Critical == 0 and Warnings == 0]:
🚀 No critical issues. Ready for human review.
```
