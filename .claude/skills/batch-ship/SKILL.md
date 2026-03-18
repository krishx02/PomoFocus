---
name: batch-ship
description: Ship multiple GitHub issues in parallel using separate Claude sessions with git worktrees. Each issue gets its own isolated worktree and Claude session. Use when user says "ship these issues", "batch ship", or "parallel ship".
user-invocable: true
context: fork
allowed-tools: Bash(gh *), Bash(git *), Bash(claude *), Bash(pnpm *), Bash(ls *), Bash(cat *), Bash(echo *), Bash(test *), Bash(mkdir *), Bash(mktemp*), Bash(rm /tmp/*), Bash(date *), Bash(timeout *), Bash(kill %*), Bash(ps *), Bash(tail *), Bash(wc *), Read, Grep, Glob
argument-hint: "[issue numbers] — e.g. '63 64 65' or '63,64,65'"
metadata:
  author: PomoFocus
  version: 1.0.0
---

Arguments: $ARGUMENTS

You are the batch shipping orchestrator. Your job is to launch multiple `/ship-issue` sessions in parallel, each in its own git worktree, and report the results.

Do NOT implement any code yourself. You coordinate — each Claude session does the actual work.

---

## Step 1 — Parse Issue Numbers

Parse ALL numbers from `$ARGUMENTS` (supports `"63 64 65"`, `"63,64,65"`, `"63, 64, 65"`).

Store as `ISSUE_NUMBERS` list.

If no numbers found, ask: "Which issue numbers should I ship in parallel?"

---

## Step 2 — Validate Issues

For each issue number, check it's ready to ship:

```bash
gh issue view $N --json labels,state,title --jq '{title: .title, labels: [.labels[].name], state: .state}'
```

Categorize each issue:

- **READY**: state is OPEN, no `needs-human` label, no `effort:large` label
- **SKIP (needs-human)**: has `needs-human` label
- **SKIP (effort:large)**: has `effort:large` label — needs `/decompose-issue` first
- **SKIP (closed)**: state is CLOSED

Report the categorization to the user before proceeding:

```
Batch ship: [N] issues ready, [M] skipped

Ready to ship:
  #63: [title]
  #64: [title]

Skipped:
  #65: needs-human
  #66: effort:large — run /decompose-issue first
```

If zero issues are ready, stop.

---

## Step 3 — Launch Parallel Sessions

For each READY issue, launch a Claude session in its own worktree:

```bash
claude --worktree "issue-$N" --yes -p "/ship-issue $N" > /tmp/batch-ship-$N.log 2>&1 &
echo "PID for issue #$N: $!"
```

Store all PIDs. Report: `"Launched [N] parallel sessions."`

---

## Step 4 — Monitor Completion

Wait for all sessions to finish. Use a timeout of 15 minutes per issue:

```bash
for pid in $PIDS; do
  wait $pid 2>/dev/null
done
```

If any session exceeds 15 minutes, report it as a timeout but do not kill it (it may still be running tests).

---

## Step 5 — Collect Results

For each issue, read the log and determine the outcome:

```bash
cat /tmp/batch-ship-$N.log
```

Look for these markers:

- `"Implementation complete for issue #$N"` → **SUCCESS** — extract branch name from the next line
- `"Ralph Loop Exhausted"` → **FAILED** — tests couldn't pass after 5 attempts
- `"Pre-Finalize Test Loop Exhausted"` → **FAILED** — broader tests failed
- `"Rebase Conflict"` → **FAILED** — merge conflicts with main
- `"needs-human"` → **BLOCKED** — ambiguity or decision needed
- None of the above → **ERROR** — unexpected failure, include last 20 lines of log

---

## Step 6 — Report

Output a clean summary:

```
Batch ship complete: [SUCCESS_COUNT]/[TOTAL] issues shipped

[For each issue, in order:]
[SUCCESS:]  Issue #N: Branch [branch-name] — ready for /finalize
[FAILED:]   Issue #N: [failure reason]
[BLOCKED:]  Issue #N: needs-human — [reason from log]
[ERROR:]    Issue #N: Unexpected error — check /tmp/batch-ship-$N.log
[SKIPPED:]  Issue #N: [skip reason]

[If any succeeded:]
Next steps — finalize all successful issues:
  /batch-finalize [space-separated list of successful issue numbers]

[If any failed:]
Failed issues need manual attention:
  [list each with the specific failure reason]
```

---

## Step 7 — Cleanup

Clean up log files for successful issues (keep failed ones for debugging):

```bash
# Only remove logs for successful issues
rm /tmp/batch-ship-$N.log  # for each SUCCESS issue
```

Do NOT remove worktrees — they contain the committed code that `/finalize` needs.
