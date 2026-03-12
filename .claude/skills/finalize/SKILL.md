---
name: finalize
description: Orchestrates the end of a completed implementation. Launches the github-issue-manager subagent to create a descriptive PR and update labels, then launches the code-reviewer subagent to post inline review comments. Loops the review up to 3 times if critical issues are found, auto-fixing before each re-review. Use when user says "create the PR", "finalize this branch", "I'm done implementing", or "ship it".
user-invocable: true
context: fork
allowed-tools: Bash(gh *), Bash(git *), Bash(timeout *), Bash(echo *), Agent
compatibility: "Requires gh CLI, git. Claude Code only."
argument-hint: "[issue number]"
metadata:
  author: PomoFocus
  version: 1.0.0
---

Issue number: $ARGUMENTS

You are the finalization orchestrator. The implementation is done and tests pass (including pre-finalize checks from `/ship-issue`). Your job is to hand off to two specialized agents — one that creates the PR, one that reviews it — and report the outcome.

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
- If `ISSUE_NUMBER` is not "none", run the label update inline (since github-issue-manager will be skipped). `gh issue edit` exits 0 when removing a label that isn't present, so no guard is needed:
  ```bash
  gh issue edit $ISSUE_NUMBER --remove-label "in-progress" --add-label "in-review"
  ```
- Skip to Step 3.5.

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

## Step 3.5 — Wait for CI and Auto-Fix Failures

Set `CI_ATTEMPT = 1` and `MAX_CI_ATTEMPTS = 2`.

**CI loop** — repeat until all checks pass or max attempts exceeded:

Poll until CI checks complete (up to 10 minutes):
```bash
timeout 600 gh pr checks $PR_NUMBER --watch || echo "CI check timed out after 10 minutes"
```

**If all checks pass:** proceed to Step 4.

**If any check fails AND CI_ATTEMPT < MAX_CI_ATTEMPTS:**
1. Report: `"CI failed on attempt [CI_ATTEMPT]. Fetching failure logs..."`
2. Fetch the failed run logs:
   ```bash
   REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
   gh run list --branch $BRANCH_NAME --json databaseId,conclusion --jq '.[] | select(.conclusion == "failure") | .databaseId' | head -1 | xargs gh run view --log-failed
   ```
3. Use the Agent tool with `subagent_type: general-purpose` to fix the failures:
   ```
   You are a CI fixer. The following GitHub Actions logs show failures on branch [BRANCH_NAME].
   Fix the root cause. Do not change anything else.

   [paste log output]

   After fixing:
   - Stage only the changed files by name (do NOT use git add -A)
   - Run: git commit -m "fix: resolve CI failure (attempt [CI_ATTEMPT])"
   - Run: git push -u origin [BRANCH_NAME]
   ```
4. Increment `CI_ATTEMPT`. Return to top of CI loop.

**If any check fails AND CI_ATTEMPT >= MAX_CI_ATTEMPTS:**
1. If ISSUE_NUMBER is not "none":
   ```bash
   gh issue edit $ISSUE_NUMBER --add-label "needs-human"
   gh issue comment $ISSUE_NUMBER --body "CI checks failed after 2 auto-fix attempts. Please resolve the failures manually before merging. PR: [PR_URL]"
   ```
2. Stop. Report to user: `"CI still failing after 2 fix attempts. Needs human. PR: [PR_URL]"`

---

## Step 4 — Code Review with Verify-Then-Fix Loop

### 4a — Determine Fixer Agent Type

Before starting the review loop, detect which platform-specific agent should handle fixes:

```bash
git diff --name-only origin/main..HEAD
```

Map the changed files to a fixer agent type:

- If ALL changed source files are under `packages/` → `shared-developer`
- If ALL under `apps/web/` → `web-developer`
- If ALL under `apps/mobile/` (excluding `targets/ios-widget/`) → `mobile-developer`
- If ALL under `native/apple/` or `apps/mobile/targets/ios-widget/` → `ios-developer`
- If ALL under `apps/vscode-extension/` → `vscode-developer`
- If ALL under `apps/mcp-server/` → `mcp-developer`
- If files span multiple buckets, or only non-source files changed → `general-purpose`

Ignore non-source files (`.md`, `.yml`, `.json` at root) when determining the bucket. Store as `FIXER_AGENT_TYPE`.

Determine the test command from the agent type:

| Agent Type | Test Command |
|-----------|-------------|
| `shared-developer` | `pnpm nx affected --target=test --base=origin/main --head=HEAD && pnpm nx affected --target=type-check --base=origin/main --head=HEAD` |
| `web-developer` | `pnpm nx test @pomofocus/web && pnpm nx type-check @pomofocus/web` |
| `mobile-developer` | `pnpm nx test @pomofocus/mobile && pnpm nx type-check @pomofocus/mobile` |
| `ios-developer` | `xcodebuild test -scheme PomoFocusMac -destination "platform=macOS"` |
| `vscode-developer` | `pnpm nx test @pomofocus/vscode-extension && pnpm nx type-check @pomofocus/vscode-extension` |
| `mcp-developer` | `pnpm nx test @pomofocus/mcp-server && pnpm nx type-check @pomofocus/mcp-server` |
| `general-purpose` | `pnpm nx affected --target=test --base=origin/main --head=HEAD && pnpm nx affected --target=type-check --base=origin/main --head=HEAD` |

Store as `TEST_COMMAND`. If the test infrastructure doesn't exist yet, the fixer will skip gracefully.

### 4b — Review Loop

Set `REVIEW_PASS = 1`, `MAX_REVIEW_PASSES = 3`, and `PREVIOUS_FALSE_POSITIVES = []` (empty list).

**Review loop** — repeat until verdict is LGTM or max passes exceeded:

Record the current UTC timestamp before launching the reviewer:
```bash
REVIEW_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

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

- **If Critical == 0 (only Warnings/Info)** → proceed to Step 5.
  Warnings are informational — the human reviewer decides whether to fix them before merging.

- **If Critical > 0 AND REVIEW_PASS < MAX_REVIEW_PASSES:**

  1. Report to the user: `"Review pass [REVIEW_PASS]: Found [Critical] critical issue(s). Launching independent fixer..."`

  2. Fetch critical inline comments from THIS review pass only (filter by timestamp):
     ```bash
     REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
     gh api repos/$REPO/pulls/$PR_NUMBER/comments \
       --jq '[.[] | select(.body | startswith("🔴")) | select(.created_at > "'"$REVIEW_START"'") | {id, body, path, line, original_line, diff_hunk}]'
     ```

  3. Filter out previously confirmed false positives. For each comment, check if `[path]:[line]` appears in `PREVIOUS_FALSE_POSITIVES`. Remove matches from the list.

  4. **If ALL remaining criticals were filtered out** (all are repeat false positives):
     ```bash
     gh pr comment $PR_NUMBER --body "$(cat <<'FPEOF'
     ## False Positive Assessment

     The independent fixer agent previously verified these critical findings
     and determined they are false positives. No code changes needed.

     [list each false positive: path:line — reason]
     FPEOF
     )"
     ```
     Proceed to Step 5 (skip re-review — no code changed).

  5. **Otherwise**, launch the fixer agent using the Agent tool with `subagent_type: [FIXER_AGENT_TYPE]`:

     ```
     You are an independent code fixer. You have received review findings from a
     code review of branch [BRANCH_NAME]. Your job is to VERIFY each finding
     independently before making any changes.

     ## Protocol

     For EACH finding below, follow these three steps in order:

     ### 1. VERIFY
     - Read the file at the specified path
     - Read at least 20 lines above and below the flagged line to understand
       the code's full intent and context
     - If the finding references interactions with other code, read that code too
     - Determine independently whether the reviewer's finding is a real issue

     ### 2. DECIDE
     - If the finding IS a real issue: fix it. Use the reviewer's suggested fix
       if correct, or implement a better fix if you see one.
     - If the finding is NOT a real issue (false positive): do NOT change the
       code. Record it as a false positive with a clear reason.

     ### 3. TEST
     - After all fixes are applied, run the test command to verify nothing broke:
       [TEST_COMMAND]
     - If the test command fails or the test infrastructure doesn't exist yet,
       note this in your output but do not block on it.

     ## Findings to Review

     [paste the filtered JSON array of critical comments]

     ## Output Format

     After completing all verifications and fixes, output a structured results
     block. This MUST be the last thing you output:

     === FIXER RESULTS ===
     [For each finding, exactly one line:]
     FIXED: [path]:[line] — [what was changed and why]
     or
     FALSE_POSITIVE: [path]:[line] — [why this is not a real issue]
     === END RESULTS ===

     ## Rules
     - Read before fixing — never apply a fix without understanding the context
     - Stage only the changed files by name (do NOT use git add -A)
     - If any fixes were made:
       git commit -m "fix: address review findings (pass [REVIEW_PASS])"
       git push -u origin [BRANCH_NAME]
     - If ALL findings are false positives: do NOT commit or push
     ```

  6. Parse the fixer's output between `=== FIXER RESULTS ===` and `=== END RESULTS ===`:
     - Count lines starting with `FIXED:` → `FIXES_APPLIED`
     - Collect lines starting with `FALSE_POSITIVE:` → add their `[path]:[line]` to `PREVIOUS_FALSE_POSITIVES`

     **If the fixer output does not contain the structured results block:** assume all findings were addressed (`FIXES_APPLIED = number of criticals`). This is the safe default — the re-reviewer will catch anything still broken.

  7. **If `FIXES_APPLIED == 0`** (all false positives this round):
     Post a PR comment summarizing the assessments:
     ```bash
     gh pr comment $PR_NUMBER --body "$(cat <<'FPEOF'
     ## False Positive Assessment (Pass [REVIEW_PASS])

     The independent fixer agent verified each critical finding and determined
     they are false positives:

     [For each FALSE_POSITIVE entry: "- **[path]:[line]** — [reason]"]

     No code changes were made.
     FPEOF
     )"
     ```
     Proceed to Step 5 (skip re-review — no code changed).

  8. **If `FIXES_APPLIED > 0`:**
     Increment `REVIEW_PASS`. Return to the top of the review loop (re-launch code-reviewer).

- **If Critical > 0 AND REVIEW_PASS >= MAX_REVIEW_PASSES:**
  1. If ISSUE_NUMBER is not "none":
     ```bash
     gh issue edit $ISSUE_NUMBER --add-label "needs-human"
     gh issue comment $ISSUE_NUMBER --body "$(cat <<'EOF'
## Review Loop Exhausted — Needs Human

Critical issues found by the code-reviewer persist after 2 auto-fix attempts
(3 total review passes). Please review the PR comments and resolve the
critical findings manually.
EOF
)"
     ```
  2. Stop. Report to user: `"Critical issues persist after 3 review passes. Needs human review. PR: [PR_URL]"`

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

---

## Step 6 — In-Terminal Changelog

After printing the Final Report, output a high-level overview of what changed in the repo so the user doesn't have to open the PR to understand what was done.

Run:
```bash
git log --oneline origin/main..HEAD
```

and:
```bash
git diff --stat origin/main..HEAD
```

Then output a human-readable summary in this format:

```
📋 What changed:
   - [1-sentence summary of the most significant change]
   - [1-sentence summary of second change, if any]
   - [... more bullets as needed, one per logical change — not per commit]

   Files: N changed, N insertions(+), N deletions(-)
```

Guidelines:
- Group related commits into a single bullet (e.g. 3 commits that set up Supabase = one bullet about Supabase init)
- Use plain language, not commit message jargon
- Keep it to 3-7 bullets max — if more changes exist, summarize the tail as "... and N other minor changes"
- The file stats line comes from `git diff --stat` (the last summary line)
