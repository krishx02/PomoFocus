---
name: finalize
description: Orchestrates the end of a completed implementation. Launches the github-issue-manager subagent to create a descriptive PR and update labels, then launches code-reviewer subagent(s) to post inline review comments. Supports multiple issues on one branch — spawns parallel scoped reviewers (one per issue). Loops the review up to 3 times if critical issues are found, auto-fixing before each re-review. Use when user says "create the PR", "finalize this branch", "I'm done implementing", or "ship it".
user-invocable: true
context: fork
allowed-tools: Bash(gh *), Bash(git *), Bash(timeout *), Bash(echo *), Bash(pnpm *), Bash(npx *), Bash(node *), Bash(ls *), Bash(cat *), Bash(test *), Bash(mkdir *), Bash(command *), Bash(which *), Bash(mktemp*), Bash(rm /tmp/*), Bash(date *), Agent
compatibility: 'Requires gh CLI, git. Claude Code only.'
argument-hint: "[issue number(s)] — e.g. '28' or '28 29 36 37' or '28,29,36,37'"
metadata:
  author: PomoFocus
  version: 1.0.0
---

Arguments: $ARGUMENTS

You are the finalization orchestrator. The implementation is done and tests pass (including pre-finalize checks from `/ship-issue`). Your job is to hand off to specialized agents — one that creates the PR, one per issue that reviews it — and report the outcome.

Do NOT implement any code. Do NOT read or modify source files. You are a coordinator only.

---

## Step 1 — Detect Issue Numbers and Branch

Get the current branch:

```bash
git branch --show-current
```

Store as `BRANCH_NAME`.

**Determine `ISSUE_NUMBERS` (a list) using this priority order:**

1. If `$ARGUMENTS` is provided, parse ALL numbers from it (e.g. `"28 29 36 37"`, `"28,29,36,37"`, `"28, 29, 36, 37"`). This supports both single and multi-issue invocations.
2. If no arguments, parse from branch name — format is `feature/issue-N-<slug>` or `fix/issue-N-<slug>`. Extract `N` (single issue).
3. If no arguments and branch name doesn't match, scan ALL recent commit messages for issue references:
   ```bash
   git log --oneline origin/main..HEAD | grep -oE '#[0-9]+' | grep -oE '[0-9]+' | sort -un
   ```
   This captures all unique issue numbers referenced across all commits on the branch.
4. If still unresolved, ask the user:
   ```
   "I'm on branch '[BRANCH_NAME]' and cannot find issue numbers in the branch name or recent commits.
   Which GitHub issue number(s) does this branch implement? (space or comma separated, or 'none' if no associated issues)"
   ```

Store `ISSUE_NUMBERS` as a list (e.g. `[28, 29, 36, 37]`), or the string `"none"` if no issues.

For convenience, also store:

- `PRIMARY_ISSUE` — the first number in the list (used when a single reference is needed)
- `IS_MULTI_ISSUE` — true if `ISSUE_NUMBERS` has more than one entry

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
- If `ISSUE_NUMBERS` is not "none", run the label update for ALL issues. `gh issue edit` exits 0 when removing a label that isn't present, so no guard is needed:
  ```bash
  # Run for EACH issue number in ISSUE_NUMBERS:
  gh issue edit $N --remove-label "in-progress" --add-label "in-review"
  ```
- Skip to Step 3.5.

**If no open PR exists:** proceed to Step 3.

---

## Step 3 — Launch github-issue-manager

Launch the `github-issue-manager` subagent with this context:

```
You are the github-issue-manager subagent.
ISSUE_NUMBERS: [list of issue numbers, or "none"]
BRANCH_NAME: [branch name]

This branch implements [single issue / multiple issues].

Follow your agent instructions completely.
- The PR title should summarize ALL issues, not just one.
- The PR body must include "Closes #N" for EACH issue number.
- Update labels (in-progress → in-review) on ALL issues.

Your final output line must match exactly:
  PR: [URL] (#[PR_NUMBER]) | Issues #N, #M, ...: in-progress → in-review
  or for single issue:
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

1. If ISSUE_NUMBERS is not "none", run for EACH issue number:
   ```bash
   gh issue edit $N --add-label "needs-human"
   gh issue comment $N --body "CI checks failed after 2 auto-fix attempts. Please resolve the failures manually before merging. PR: [PR_URL]"
   ```
2. Stop. Report to user: `"CI still failing after 2 fix attempts. Needs human. PR: [PR_URL]"`

---

## Step 3.75 — Diff Scope Check

Before code review, verify that the diff only contains files relevant to the issue(s).

```bash
git diff --name-only origin/main..HEAD
```

Store as `CHANGED_FILES`.

If `ISSUE_NUMBERS` is not "none", fetch the issue body for each issue and extract the **Affected Files** list:

```bash
gh issue view $N --json body --jq '.body'
```

Compare `CHANGED_FILES` against the union of all issues' Affected Files. Identify any **out-of-scope files** — files in the diff that don't appear in any issue's Affected Files list.

**Ignore these when checking scope** (they're expected noise):
- Lock files (`pnpm-lock.yaml`)
- Generated files (`openapi.json`, files in `dist/`)
- Config files touched by lint/build fixes (`.eslintrc`, `tsconfig.*.json`)

**If out-of-scope source files exist** (`.ts`, `.tsx`, `.swift`, `.cpp` files outside the issue's scope):

1. Report: `"Found [N] files outside issue scope: [list]. Attempting rebase to clean up branch divergence..."`
2. Auto-rebase:
   ```bash
   git rebase origin/main
   git push --force-with-lease origin $BRANCH_NAME
   ```
3. Re-check `git diff --name-only origin/main..HEAD`. If out-of-scope files are gone: wait for CI to re-run, then proceed to Step 4.
4. If out-of-scope files persist after rebase: include this note in the code-reviewer prompt:
   ```
   NOTE: The following files are outside the issue's stated scope and may be
   from a separate change bundled into this branch. Flag them but do not
   treat them as critical unless they introduce bugs:
   [list of out-of-scope files]
   ```

**If no out-of-scope source files:** proceed to Step 4.

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

| Agent Type         | Test Command                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-developer` | `pnpm nx affected --target=test --base=origin/main --head=HEAD && pnpm nx affected --target=type-check --base=origin/main --head=HEAD` |
| `web-developer`    | `pnpm nx test @pomofocus/web && pnpm nx type-check @pomofocus/web`                                                                     |
| `mobile-developer` | `pnpm nx test @pomofocus/mobile && pnpm nx type-check @pomofocus/mobile`                                                               |
| `ios-developer`    | `xcodebuild test -scheme PomoFocusMac -destination "platform=macOS"`                                                                   |
| `vscode-developer` | `pnpm nx test @pomofocus/vscode-extension && pnpm nx type-check @pomofocus/vscode-extension`                                           |
| `mcp-developer`    | `pnpm nx test @pomofocus/mcp-server && pnpm nx type-check @pomofocus/mcp-server`                                                       |
| `general-purpose`  | `pnpm nx affected --target=test --base=origin/main --head=HEAD && pnpm nx affected --target=type-check --base=origin/main --head=HEAD` |

Store as `TEST_COMMAND`. If the test infrastructure doesn't exist yet, the fixer will skip gracefully.

### 4b — Multi-Issue Scoped Review (when IS_MULTI_ISSUE is true)

When the branch solves multiple issues, launch **one code-reviewer per issue IN PARALLEL** instead of a single reviewer for the whole PR. Each reviewer is scoped to the files relevant to its issue.

**Build per-issue file scopes:**

For each issue number in `ISSUE_NUMBERS`:

1. Read the issue body from GitHub: `gh issue view $N --json body,title`
2. Extract the file paths mentioned in the issue (acceptance criteria, file paths section, etc.)
3. Cross-reference with the actual changed files on the branch (`git diff --name-only origin/main..HEAD`)
4. Assign each changed file to the issue that most closely owns it. Files not clearly owned by any single issue get assigned to the issue whose scope is broadest.

Store as `ISSUE_FILE_SCOPES` — a map of issue number → list of file paths.

**Launch parallel reviewers:**

For EACH issue in `ISSUE_NUMBERS`, launch a `code-reviewer` subagent **in parallel** (all in a single message with multiple Agent tool calls, using `run_in_background: true`):

```
You are the code-reviewer subagent.
PR_NUMBER: [PR number]
ISSUE_NUMBER: [this specific issue number]
BRANCH_NAME: [branch name]

This PR covers multiple issues. You are reviewing ONLY the scope of issue #[N]: "[issue title]".

Focus your review on these files:
[list of files from ISSUE_FILE_SCOPES for this issue]

Follow your agent instructions completely.
Your final output must include:
  Review complete on PR #[PR] (scope: issue #[N])
  🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N
  Verdict: [LGTM / Needs Changes / Critical Fixes Required]
```

Wait for ALL reviewers to complete. Collect results from each.

**Aggregate results:**

- `TOTAL_CRITICAL` = sum of Critical counts across all reviewers
- `TOTAL_WARNINGS` = sum of Warning counts
- `TOTAL_INFO` = sum of Info counts
- `AGGREGATE_VERDICT`:
  - If any reviewer returned "Critical Fixes Required" → "Critical Fixes Required"
  - Else if any returned "Needs Changes" → "Needs Changes"
  - Else → "LGTM"

**Then proceed to the fix loop below using the aggregated results.** When fetching critical comments for the fixer, fetch from ALL reviewers (they all posted to the same PR).

### 4b-alt — Single-Issue Review (when IS_MULTI_ISSUE is false)

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

For each warning, classify it as:
- ACTIONABLE: should be fixed before merge (incorrect behavior, security risk, data loss, schema mismatch)
- DEFERRED: noted but not blocking (style preference, future concern, minor inconsistency, YAGNI)

Your final output must include:
  Review complete on PR #[N]
  🔴 Critical: N  |  🟡 Warnings: N (M actionable, K deferred)  |  ℹ️ Info: N
  Verdict: [LGTM / Needs Changes / Critical Fixes Required]
```

Wait for the agent to complete. Parse `Critical` count, `Verdict`, and warning breakdown from its output.

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
  1. If ISSUE_NUMBERS is not "none", run for EACH issue number:
     ```bash
     gh issue edit $N --add-label "needs-human"
     gh issue comment $N --body "$(cat <<'EOF'
     ```

## Review Loop Exhausted — Needs Human

Critical issues found by the code-reviewer persist after 2 auto-fix attempts
(3 total review passes). Please review the PR comments and resolve the
critical findings manually.
EOF
)"
```  2. Stop. Report to user:`"Critical issues persist after 3 review passes. Needs human review. PR: [PR_URL]"`

---

## Step 5 — Final Report

Output a clean summary to the user:

```
[If ISSUE_NUMBERS is not "none" and IS_MULTI_ISSUE:]
✅ Finalize complete for issues #N, #M, #P, #Q
[If ISSUE_NUMBERS is not "none" and not IS_MULTI_ISSUE:]
✅ Finalize complete for issue #[PRIMARY_ISSUE]
[If ISSUE_NUMBERS is "none":]
✅ Finalize complete — infrastructure branch

📝 PR: [PR_URL]
[If ISSUE_NUMBERS is not "none":]
🏷️  Labels: in-progress → in-review (all issues)
[If ISSUE_NUMBERS is "none":]
🏷️  Labels: N/A — no associated issue

🔍 Code Review Results:
[If IS_MULTI_ISSUE, show per-issue breakdown:]
   Issue #N: 🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N  — [verdict]
   Issue #M: 🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N  — [verdict]
   ...
   ─────────
   Overall:  🔴 Critical: N  |  🟡 Warnings: N  |  ℹ️ Info: N
   Verdict: [aggregate verdict]
[If not IS_MULTI_ISSUE:]
   🔴 Critical: N  |  🟡 Warnings: N (M actionable, K deferred)  |  ℹ️ Info: N
   Verdict: [verdict]

[If Critical > 0]:
⚠️  Critical issues were found. Review the PR comments before merging.

[If Critical == 0 and actionable warnings > 0]:
🟡 No critical issues, but [M] actionable warning(s) found. Review before merging.

[If Critical == 0 and actionable warnings == 0]:
🚀 No critical or actionable issues. Ready for human review.
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
