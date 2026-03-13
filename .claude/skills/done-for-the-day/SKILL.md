---
name: done-for-the-day
description: Summarize today's work and write a structured daily note to the Obsidian vault. Gathers closed issues, merged PRs, commits, and files changed, then generates a Markdown daily note at ~/Documents/Obsidian/PomoFocus/journal/daily/. Use when user says "done for the day", "end of day", "wrap up", "daily summary", or "what did I do today".
user-invocable: true
context: conversation
allowed-tools: Bash(gh *), Bash(git *), Bash(date *), Bash(ls *), Bash(mkdir *), Read, Write, Grep, Glob
compatibility: 'Requires gh CLI, git. Claude Code only.'
argument-hint: '[optional: YYYY-MM-DD date, defaults to today]'
metadata:
  author: PomoFocus
  version: 1.0.0
---

## Step 1 — Determine Date

If `$ARGUMENTS` is a valid date in YYYY-MM-DD format, use it as `TARGET_DATE`. Otherwise, get today's date:

```bash
date +%Y-%m-%d
```

Store as `TARGET_DATE`.

Get the day name for display:

```bash
date -j -f "%Y-%m-%d" "$TARGET_DATE" "+%A"
```

Store as `DAY_NAME`. Also compute a human-readable date string:

```bash
date -j -f "%Y-%m-%d" "$TARGET_DATE" "+%B %d, %Y"
```

Store as `DISPLAY_DATE` (e.g., "March 11, 2026").

---

## Step 2 — Bootstrap Vault (First Run Only)

Check if the vault directory exists:

```bash
ls ~/Documents/Obsidian/PomoFocus/journal/daily/ 2>/dev/null
```

If it does not exist, create the directory structure:

```bash
mkdir -p ~/Documents/Obsidian/PomoFocus/journal/daily
mkdir -p ~/Documents/Obsidian/PomoFocus/journal/weekly
mkdir -p ~/Documents/Obsidian/PomoFocus/journal/monthly
mkdir -p ~/Documents/Obsidian/PomoFocus/templates
```

If this is the first time creating the vault, note this — you will print a one-time setup instruction in Step 7.

---

## Step 3 — Gather Data from GitHub

Run these commands to collect today's work. All commands filter by `TARGET_DATE`.

### 3a — Issues Closed Today

```bash
gh issue list --state closed --limit 50 --json number,title,closedAt,labels
```

From the output, filter issues where `closedAt` starts with `TARGET_DATE`. Store matching issues as `CLOSED_ISSUES`.

### 3b — PRs Merged Today

```bash
gh pr list --state merged --limit 50 --json number,title,mergedAt,headRefName,url
```

From the output, filter PRs where `mergedAt` starts with `TARGET_DATE`. Store matching PRs as `MERGED_PRS`.

### 3c — Issues Still In Progress

```bash
gh issue list --label "in-progress" --state open --limit 20 --json number,title,labels
```

Store as `IN_PROGRESS_ISSUES`.

---

## Step 4 — Gather Data from Git

### 4a — Commits Today

```bash
git log main --since="$TARGET_DATE 00:00" --until="$TARGET_DATE 23:59:59" --oneline --all
```

Store as `TODAYS_COMMITS`. If main does not exist or has no commits in range, this may be empty — that's fine.

### 4b — File Change Stats

```bash
git log main --since="$TARGET_DATE 00:00" --until="$TARGET_DATE 23:59:59" --all --stat --format=""
```

Capture the summary line (e.g., "N files changed, N insertions(+), N deletions(-)"). Store as `FILE_STATS`.

If there are no commits today, `FILE_STATS` is "No commits today".

---

## Step 5 — Check for Existing Note

```bash
ls ~/Documents/Obsidian/PomoFocus/journal/daily/$TARGET_DATE.md 2>/dev/null
```

If the file exists, read it. You will **merge** new data into it:

- Add any newly closed issues that are not already listed under "## Issues Shipped"
- Add any newly merged PRs that are not already listed under "## PRs Merged"
- Update the frontmatter counts (`issues_shipped`, `prs_merged`)
- Preserve any manual content the user added to "Decisions Made", "Tomorrow", or "Notes"

If the file does not exist, generate a fresh note from the template in Step 6.

---

## Step 6 — Generate the Daily Note

Build the note with this structure. Replace all placeholders with actual data from Steps 3-4.

```markdown
---
date: $TARGET_DATE
day: $DAY_NAME
tags: [daily, pomofocus]
issues_shipped: [count of CLOSED_ISSUES]
prs_merged: [count of MERGED_PRS]
---

# $DAY_NAME, $DISPLAY_DATE

## Issues Shipped

[For each issue in CLOSED_ISSUES:]

- [x] #[number] — [title] `[label1]` `[label2]`
  - Why: [Read the issue body, labels (especially phase:* labels), and cross-reference with `research/mvp-roadmap.md` or the v1 build order in CLAUDE.md to write a 1-sentence explanation of WHY this issue existed — what phase it belongs to, what capability it unlocks, or what prerequisite it satisfies. Example: "Part of Phase 1 (monorepo scaffold) — establishes the shared type system that all packages depend on."]
  - How: [Read the issue body or PR description to write a 1-2 sentence summary of HOW the issue was implemented — what approach was taken, key files changed. If no detail is available, write "See PR for details."]

[If CLOSED_ISSUES is empty:]
No issues shipped today.

## PRs Merged

[For each PR in MERGED_PRS:]

- [PR #[number]]([url]) — [title]
  - Branch: `[headRefName]`

[If MERGED_PRS is empty:]
No PRs merged today.

## Key Changes

[Group TODAYS_COMMITS by logical change and summarize in 3-5 bullets. Example:]

- Scaffolded data-access package with OpenAPI client stub
- Added Supabase migration for profiles table
- Updated CI workflow for affected detection

[If no commits:]
No commits today.

## Files Changed

[FILE_STATS — e.g., "12 files changed, 340 insertions(+), 25 deletions(-)"]

## Still In Progress

[For each issue in IN_PROGRESS_ISSUES:]

- #[number] — [title]

[If IN_PROGRESS_ISSUES is empty:]
No issues currently in progress.

## Decisions Made

[Leave empty for user to fill in]

## Tomorrow

[Leave empty for user to fill in]

## Notes

[Leave empty for user to fill in]
```

Write the note to:

```
~/Documents/Obsidian/PomoFocus/journal/daily/$TARGET_DATE.md
```

---

## Step 7 — Create Tomorrow's Kickoff Note

Compute tomorrow's date:

```bash
date -j -v+1d -f "%Y-%m-%d" "$TARGET_DATE" "+%Y-%m-%d"
```

Store as `TOMORROW_DATE`. Also compute the day name and display date for tomorrow.

Check if tomorrow's note already exists:

```bash
ls ~/Documents/Obsidian/PomoFocus/journal/daily/$TOMORROW_DATE.md 2>/dev/null
```

If it already exists, skip this step entirely — don't overwrite a note that may already have content.

If it does not exist, gather context for tomorrow:

### 7a — Backlog Issues Ready to Pick Up

```bash
gh issue list --label "agent-ready" --state open --limit 10 --json number,title,labels
```

Store as `READY_ISSUES`.

### 7b — Open PRs Awaiting Review

```bash
gh pr list --state open --limit 10 --json number,title,url,headRefName
```

Store as `OPEN_PRS`.

### 7c — Build Tomorrow's Note

```markdown
---
date: $TOMORROW_DATE
day: $TOMORROW_DAY_NAME
tags: [daily, pomofocus]
issues_shipped: 0
prs_merged: 0
---

# $TOMORROW_DAY_NAME, $TOMORROW_DISPLAY_DATE

## Carry-Forward from [[LINK_TO_TODAY]]

[For each issue in IN_PROGRESS_ISSUES from Step 3c:]

- [ ] #[number] — [title]

[If IN_PROGRESS_ISSUES is empty:]
Nothing carried forward — clean slate.

## PRs to Review

[For each PR in OPEN_PRS:]

- [ ] [PR #[number]]([url]) — [title]
  - Branch: `[headRefName]`

[If OPEN_PRS is empty:]
No open PRs.

## Ready to Pick Up

[For each issue in READY_ISSUES, list up to 5:]

- [ ] #[number] — [title] `[label1]` `[label2]`
  - Start: `/ship-issue [number]`

[If READY_ISSUES is empty:]
No agent-ready issues in backlog.

## Plan for Today

[Leave empty — fill in at start of day]

## Issues Shipped

[Will be filled by /done-for-the-day tomorrow]

## PRs Merged

[Will be filled by /done-for-the-day tomorrow]

## Key Changes

[Will be filled by /done-for-the-day tomorrow]

## Files Changed

[Will be filled by /done-for-the-day tomorrow]

## Still In Progress

[Will be filled by /done-for-the-day tomorrow]

## Decisions Made

[Leave empty for user to fill in]

## Tomorrow

[Leave empty for user to fill in]

## Notes

[Leave empty for user to fill in]
```

The `[[LINK_TO_TODAY]]` is an Obsidian wiki-link to today's note using the format `[[TARGET_DATE]]` (e.g., `[[2026-03-11]]`). This creates a backlink between consecutive days.

Write the note to:

```
~/Documents/Obsidian/PomoFocus/journal/daily/$TOMORROW_DATE.md
```

**Important:** When `/done-for-the-day` runs tomorrow, Step 5 (Check for Existing Note) will detect this pre-populated note and merge actual data into the placeholder sections — replacing "Will be filled" sections with real data while preserving any content the user added to "Plan for Today", "Decisions Made", "Tomorrow", or "Notes".

---

## Step 8 — Terminal Summary

Print a concise summary to the terminal:

```
Done for the day — $DAY_NAME, $DISPLAY_DATE

Issues shipped: [count] ([list of #numbers])
PRs merged: [count] ([list of #numbers])
Still in progress: [count] ([list of #numbers])

Daily note written to:
  ~/Documents/Obsidian/PomoFocus/journal/daily/$TARGET_DATE.md
Tomorrow's kickoff ready at:
  ~/Documents/Obsidian/PomoFocus/journal/daily/$TOMORROW_DATE.md
  → [count] in-progress issues carried forward
  → [count] agent-ready issues to pick up
  → [count] PRs to review
```

**If this was the first run (vault was just created),** also print:

```
First-time setup: Open Obsidian → "Open folder as vault" → select:
  ~/Documents/Obsidian/PomoFocus/

Recommended: Install the Calendar community plugin for easy navigation.
See research/09-obsidian-claude-code-integration.md for full setup guide.
```

**If no issues were shipped and no PRs merged,** still create the note but adjust the terminal summary:

```
Done for the day — $DAY_NAME, $DISPLAY_DATE

Quiet day — no issues shipped or PRs merged.
Still in progress: [count] ([list of #numbers])

Daily note written to:
  ~/Documents/Obsidian/PomoFocus/journal/daily/$TARGET_DATE.md
Tomorrow's kickoff ready at:
  ~/Documents/Obsidian/PomoFocus/journal/daily/$TOMORROW_DATE.md

Open the notes in Obsidian to add decisions, tomorrow's plan, and reflections.
```
