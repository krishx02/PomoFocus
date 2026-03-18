---
name: batch-finalize
description: Finalize multiple issues in parallel — creates PRs, runs CI, and reviews each branch independently. Use after /batch-ship completes. Use when user says "finalize all", "batch finalize", or "finalize these issues".
user-invocable: true
context: fork
allowed-tools: Bash(gh *), Bash(git *), Bash(claude *), Bash(pnpm *), Bash(ls *), Bash(cat *), Bash(echo *), Bash(test *), Bash(mkdir *), Bash(mktemp*), Bash(rm /tmp/*), Bash(date *), Bash(timeout *), Bash(kill %*), Bash(ps *), Bash(tail *), Bash(wc *), Read, Grep, Glob
argument-hint: "[issue numbers] — e.g. '63 64 65' or '63,64,65'"
metadata:
  author: PomoFocus
  version: 1.0.0
---

Arguments: $ARGUMENTS

You are the batch finalization orchestrator. Your job is to launch multiple `/finalize` sessions in parallel, each creating a PR and running code review for its branch, and report the aggregate results.

Do NOT implement any code yourself. You coordinate — each Claude session does the actual work.

---

## Step 1 — Parse Issue Numbers

Parse ALL numbers from `$ARGUMENTS` (supports `"63 64 65"`, `"63,64,65"`, `"63, 64, 65"`).

Store as `ISSUE_NUMBERS` list.

If no numbers found, ask: "Which issue numbers should I finalize in parallel?"

---

## Step 2 — Validate Branches Exist

For each issue number, verify a pushed branch exists:

```bash
git fetch origin
git branch -r --list "*issue-$N*"
```

Categorize each issue:

- **READY**: a remote branch matching `*issue-$N*` exists
- **SKIP (no branch)**: no matching branch found — was `/ship-issue` run?
- **SKIP (already has PR)**: check `gh pr list --head [branch] --json number,url` — if PR exists, note it

Report before proceeding:

```
Batch finalize: [N] issues ready, [M] skipped

Ready to finalize:
  #63: branch feature/issue-63-...
  #64: branch feature/issue-64-...

Skipped:
  #65: No branch found — run /ship-issue first
  #66: PR already exists — https://github.com/.../pull/170
```

If zero issues are ready, stop.

---

## Step 3 — Launch Parallel Sessions

For each READY issue, launch a Claude session:

```bash
claude --worktree "finalize-$N" --yes -p "/finalize $N" > /tmp/batch-finalize-$N.log 2>&1 &
echo "PID for issue #$N: $!"
```

Store all PIDs. Report: `"Launched [N] parallel finalize sessions."`

---

## Step 4 — Monitor Completion

Wait for all sessions to finish. Use a timeout of 10 minutes per issue (finalize is mostly waiting on CI):

```bash
for pid in $PIDS; do
  wait $pid 2>/dev/null
done
```

---

## Step 5 — Collect Results

For each issue, read the log and determine the outcome:

```bash
cat /tmp/batch-finalize-$N.log
```

Look for these markers:

- `"PR: https://"` → **SUCCESS** — extract PR URL
- `"Critical:"` line → extract critical/warning/info counts
- `"Verdict:"` line → extract verdict
- `"REVIEW FINDINGS"` block → extract findings text
- `"CI still failing"` → **CI_FAILED**
- `"needs-human"` → **BLOCKED**
- None of the above → **ERROR**

---

## Step 6 — Report

Output a clean aggregate summary:

```
Batch finalize complete: [SUCCESS_COUNT]/[TOTAL] issues finalized

[For each issue, in order:]
[SUCCESS with LGTM:]
  Issue #N: PR [URL]
    Critical: 0 | Warnings: N (M actionable, K deferred) | Info: N
    Verdict: LGTM
    [If findings exist, list each on its own line, indented]

[SUCCESS with issues:]
  Issue #N: PR [URL]
    Critical: N | Warnings: N | Info: N
    Verdict: [verdict] — review PR comments before merging

[CI_FAILED:]
  Issue #N: CI failed after 2 attempts — needs human
    Branch: [branch-name]

[BLOCKED:]
  Issue #N: Blocked — [reason]

[ERROR:]
  Issue #N: Unexpected error — check /tmp/batch-finalize-$N.log

[SKIPPED:]
  Issue #N: [skip reason]

[Summary line:]
PRs ready to merge: [list of LGTM PR URLs]
PRs needing review: [list of non-LGTM PR URLs]
```

---

## Step 7 — Cleanup

Clean up log files for successful issues:

```bash
rm /tmp/batch-finalize-$N.log  # for each SUCCESS issue
```

Clean up finalize worktrees (they don't contain code changes):

```bash
git worktree remove .claude/worktrees/finalize-$N 2>/dev/null  # for each issue
```
