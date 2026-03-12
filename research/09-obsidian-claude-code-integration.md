# Obsidian + Claude Code: Integration Patterns for Agent-Driven Development

> **Note:** This document is synthesized from publicly available writing, blog posts, GitHub repos, and community discussions as of early 2026. Source links point to real, known URLs. Cross-check before treating any quote as verbatim.

---

## TL;DR

Obsidian has emerged as the developer second brain for AI-assisted coding workflows. The core insight: **Claude Code conversations reset, but Obsidian vaults persist.** By writing structured daily notes to a local Obsidian vault, you get a queryable, backlinked history of what was built, when, and how — surviving conversation compaction and session boundaries. No MCP server is needed for basic journaling; Claude Code's native filesystem tools (Read/Write) are sufficient. The `/done-for-the-day` skill auto-generates daily notes from GitHub issues and git history. Dataview queries surface patterns over time (velocity, decisions, blockers).

**Key distinction:** MEMORY.md is for the agent (what it needs to know next session). The Obsidian journal is for the human (what happened, why, and what to do next).

---

## 1. Why Obsidian + Claude Code

### The Problem

Claude Code conversations are ephemeral. Context compaction drops details. Session boundaries reset state. After a productive day shipping 3-4 issues, there's no easy way to answer: "What did I actually do today?" Git log shows commits, GitHub shows closed issues, but neither tells the story — the decisions made, the approaches taken, the things left in progress.

### What Obsidian Adds

| Capability | How It Helps |
|-----------|-------------|
| **Persistence** | Markdown files on disk survive conversation resets, compaction, and tool changes |
| **Backlinks** | Daily notes link to issues, ADRs, and each other — building a knowledge graph over time |
| **Queryability** | Dataview plugin turns frontmatter into queryable databases (issues shipped this week, velocity trends) |
| **Local-first** | No cloud dependency, no API costs, no privacy concerns — just files |
| **Plaintext** | Works with git, grep, any editor — not locked into Obsidian |
| **Human-readable** | Unlike JSONL transcripts or database dumps, daily notes are designed to be read |

### Complementary to Existing Systems

- **MEMORY.md** → Agent context (what the agent needs to know). Auto-loaded, rarely read by humans.
- **Git log** → What changed (commits, diffs). Machine-oriented, chronological.
- **GitHub Issues** → What was planned (tickets, labels, acceptance criteria). Task-oriented.
- **Obsidian journal** → What happened (daily narrative, decisions, reflections). Human-oriented, queryable.

These are four different views of the same work. The journal is the missing human layer.

---

## 2. Integration Approaches

### Option A: Direct Filesystem Access (Recommended for v1)

Claude Code can already read and write local files with its native `Read` and `Write` tools. Since an Obsidian vault is just a folder of Markdown files, no additional infrastructure is needed:

```
Skill (/done-for-the-day)
    ↓ Write tool
~/Documents/Obsidian/PomoFocus/journal/daily/2026-03-11.md
    ↓ Obsidian watches filesystem
Note appears in Obsidian automatically
```

**Pros:** Zero setup, zero dependencies, no running services, works offline.
**Cons:** No semantic search, no tag queries via Obsidian API, no triggering Obsidian actions.

### Option B: MCP Server (Future — when semantic search matters)

MCP servers bridge Claude Code to Obsidian's API, enabling richer interactions:

```
Claude Code
    ↓ MCP protocol
Obsidian MCP Server
    ↓ REST API or filesystem
Obsidian Vault
```

Worth adding when: you want to search across hundreds of notes by content, query tags programmatically, or trigger Obsidian template rendering from Claude Code.

### Decision

**Use direct filesystem access for now.** The `/done-for-the-day` skill only needs to write one Markdown file per day. An MCP server is overhead without benefit at this scale. Revisit when the vault has 100+ notes and semantic search becomes valuable.

---

## 3. MCP Servers for Obsidian (Reference)

When the time comes to add an MCP server, these are the leading options:

| Server | Approach | Dependencies | Best For |
|--------|----------|-------------|----------|
| [bitbonsai/mcp-obsidian](https://github.com/bitbonsai/mcp-obsidian) | Direct filesystem | Zero — no Obsidian plugins | Lightweight read/write, 14 methods |
| [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) | REST API bridge | Obsidian Local REST API plugin | Full-featured: search, tags, frontmatter |
| [iansinnott/obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp) | Claude Code specific | Minimal | Purpose-built for Claude Code workflows |
| [MarkusPfundstein/mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) | REST API bridge | Obsidian Local REST API plugin | List, get, search, patch, append, delete |
| [jacksteamdev/obsidian-mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools) | Semantic search | Obsidian plugin | Semantic search + custom Templater prompts |

**Recommendation when ready:** Start with `bitbonsai/mcp-obsidian` (zero deps). Upgrade to `cyanheads/obsidian-mcp-server` if you need tag queries or semantic search.

### Configuration (for future reference)

Adding an MCP server to `.claude/settings.json`:

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "@bitbonsai/mcp-obsidian"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "~/Documents/Obsidian/PomoFocus"
      }
    }
  }
}
```

---

## 4. Vault Setup Guide

### Location

```
~/Documents/Obsidian/PomoFocus/    ← new separate vault
```

Separate from the existing `~/Documents/Obsidian/Notes/` personal vault. This keeps dev journal concerns isolated from personal notes while using the same parent directory convention.

### Directory Structure

```
~/Documents/Obsidian/PomoFocus/
├── journal/
│   ├── daily/          # 2026-03-11.md — auto-generated by /done-for-the-day
│   ├── weekly/         # 2026-W11.md — future /weekly-review skill
│   └── monthly/        # 2026-03.md — future monthly rollup
├── templates/
│   └── daily-note.md   # Template reference (not used programmatically)
└── .obsidian/          # Auto-created by Obsidian on first open
```

### First-Time Setup

1. The `/done-for-the-day` skill auto-creates the directory structure on first run
2. Open Obsidian → "Open folder as vault" → select `~/Documents/Obsidian/PomoFocus/`
3. Enable core plugins: **Daily Notes**, **Templates**, **Backlinks**, **Tags**

### Recommended Community Plugins

Install these after the vault has some notes:

| Plugin | Purpose | When to Install |
|--------|---------|----------------|
| [Dataview](https://github.com/blacksmithgu/obsidian-dataview) | Query notes with SQL-like syntax | After ~2 weeks of daily notes |
| [Templater](https://github.com/SilentVoid13/Templater) | Dynamic template rendering | When you want to create notes manually with auto-filled fields |
| [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) | Calendar sidebar for navigating daily notes | Immediately — low effort, high value |
| [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) | Weekly/monthly/quarterly note creation | When weekly rollups are added |

**Do not install Dataview, Templater, or Periodic Notes upfront.** They add complexity before there's data to query. The Calendar plugin is the one exception — install it immediately.

### Daily Notes Plugin Configuration

Once the vault is open in Obsidian:

- **Date format:** `YYYY-MM-DD`
- **New file location:** `journal/daily`
- **Template file location:** `templates/daily-note`

This ensures that manually created daily notes (from Obsidian's ribbon icon) land in the same folder as auto-generated ones from `/done-for-the-day`.

---

## 5. Daily Note Template

The `/done-for-the-day` skill generates notes with this structure. The frontmatter is designed to be Dataview-queryable.

### Frontmatter Schema

```yaml
---
date: 2026-03-11           # ISO date — Dataview can sort/filter on this
day: Tuesday                # Human-readable day name
tags: [daily, pomofocus]    # Obsidian tags for filtering
issues_shipped: 3           # Numeric — enables velocity queries
prs_merged: 2               # Numeric — enables throughput queries
---
```

### Sections

| Section | Source | Purpose |
|---------|--------|---------|
| **Issues Shipped** | `gh issue list --state closed` | What was completed, with implementation summary |
| **PRs Merged** | `gh pr list --state merged` | Links to PRs for detailed review |
| **Key Changes** | `git log --oneline` | Grouped commit summary |
| **Files Changed** | `git diff --stat` | Scope indicator |
| **Still In Progress** | `gh issue list --label in-progress` | Carry-forward context |
| **Decisions Made** | Manual (user fills in) | Capture reasoning that git doesn't |
| **Tomorrow** | Manual (user fills in) | Priority planning |
| **Notes** | Manual (user fills in) | Free-form reflection |

The first four sections are auto-populated. The last three are empty placeholders for human input — the most valuable part of the journal over time.

---

## 6. Integration Patterns

### `/done-for-the-day` Skill

The primary integration point. A Claude Code skill that:

1. Queries GitHub for today's closed issues and merged PRs
2. Queries git for today's commits and file changes
3. Generates a structured daily note
4. Writes it to the Obsidian vault
5. Prints a terminal summary

**Relationship to `/finalize`:** The `/finalize` skill generates a per-issue changelog (one branch, one PR). The `/done-for-the-day` skill aggregates across all issues shipped that day. They are complementary — `/finalize` is the microscope, `/done-for-the-day` is the telescope.

### Potential Future Skills

| Skill | Trigger | What It Does |
|-------|---------|-------------|
| `/morning-standup` | Start of day | Reads yesterday's daily note, surfaces "Tomorrow" and "Still In Progress" sections |
| `/weekly-review` | End of week | Aggregates daily notes into weekly summary with velocity metrics |
| `/decision-log` | After `/tech-design` | Appends ADR summary to today's daily note |

These are not built yet. Build them when a real pain point emerges, not speculatively.

---

## 7. Querying the Journal (Dataview)

After installing the Dataview community plugin and accumulating ~2 weeks of daily notes, these queries become useful.

### Issues Shipped This Week

```dataview
TABLE issues_shipped, prs_merged
FROM "journal/daily"
WHERE date >= date(today) - dur(7 days)
SORT date DESC
```

### High-Output Days

```dataview
TABLE date, day, issues_shipped
FROM "journal/daily"
WHERE issues_shipped >= 3
SORT issues_shipped DESC
```

### Weekly Velocity

```dataview
TABLE sum(issues_shipped) AS "Total Issues", sum(prs_merged) AS "Total PRs"
FROM "journal/daily"
WHERE date >= date(today) - dur(7 days)
```

### Days With In-Progress Carry-Forward

```dataview
LIST
FROM "journal/daily"
WHERE contains(file.content, "## Still In Progress")
SORT date DESC
LIMIT 10
```

These queries go in a `dashboard.md` note at the vault root, or inline in weekly review notes.

---

## 8. Weekly and Monthly Rollup Patterns

### Weekly Review (future `/weekly-review` skill)

A weekly note at `journal/weekly/2026-W11.md` that:

1. Aggregates all daily notes from the week
2. Counts total issues shipped, PRs merged
3. Lists decisions made (from "Decisions Made" sections)
4. Identifies patterns: what went well, what blocked progress
5. Carries forward unresolved "Still In Progress" items

### Monthly Trends (future)

A monthly note at `journal/monthly/2026-03.md` that:

1. Summarizes weekly summaries
2. Tracks velocity trends (issues/week over the month)
3. Lists all ADRs created or modified
4. Identifies recurring blockers

### Build Order

1. Daily notes first (now — `/done-for-the-day`)
2. Weekly reviews after 3-4 weeks of daily notes
3. Monthly trends after 2-3 months

Do not build rollup infrastructure before there is data to roll up.

---

## 9. What to Build Now vs Later

### Now

| Item | Why Now |
|------|---------|
| `/done-for-the-day` skill | Solves the immediate pain point — "what did I do today?" |
| Vault directory structure | Auto-created by the skill on first run |
| Daily note template | Defined in the skill, Dataview-ready from day one |

### After 2 Weeks of Daily Notes

| Item | Why Then |
|------|---------|
| Dataview plugin | Need data to query before queries are useful |
| `dashboard.md` | Velocity queries become meaningful with 10+ data points |
| Calendar plugin | Nice-to-have for navigation, but notes are browsable without it |

### After 1 Month

| Item | Why Then |
|------|---------|
| `/weekly-review` skill | Enough weeks to aggregate |
| Periodic Notes plugin | Automates weekly/monthly note creation from Obsidian |

### After 3 Months (or when pain arises)

| Item | Why Then |
|------|---------|
| MCP server integration | Semantic search becomes valuable at 100+ notes |
| `/morning-standup` skill | Only useful if daily journaling is an established habit |
| Monthly trend notes | Need months of data for trends to be meaningful |

---

## Sources

### Obsidian + Claude Code Integration

- [I put Claude Code inside Obsidian, and it was awesome](https://www.xda-developers.com/claude-code-inside-obsidian-and-it-was-eye-opening/) — XDA, integration overview
- [How Claude + Obsidian + MCP Solved My Organizational Problems](https://www.eleanorkonik.com/p/how-claude-obsidian-mcp-solved-my) — Eleanor Konik, practitioner case study
- [I Built an AI-Powered Second Brain with Obsidian + Claude Code](https://sonnyhuynhb.medium.com/i-built-an-ai-powered-second-brain-with-obsidian-claude-code-heres-how-b70e28100099) — Step-by-step walkthrough
- [Obsidian + Claude Code: The Complete Integration Guide](https://blog.starmorph.com/blog/obsidian-claude-code-integration-guide) — Complete reference
- [Obsidian's Official Skills Are Here](https://kurtis-redux.medium.com/obsidians-official-skills-are-here-it-s-time-to-let-ai-plug-into-your-local-vault-6c149aae84f6) — Skills framework overview

### MCP Servers

- [bitbonsai/mcp-obsidian](https://github.com/bitbonsai/mcp-obsidian) — Lightweight, zero dependencies
- [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server) — Full-featured knowledge management
- [iansinnott/obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp) — Claude Code specific
- [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) — Official Obsidian agent skills

### Obsidian Plugins

- [blacksmithgu/obsidian-dataview](https://github.com/blacksmithgu/obsidian-dataview) — Data index and query language
- [SilentVoid13/Templater](https://github.com/SilentVoid13/Templater) — Template engine
- [Vinzent03/obsidian-git](https://github.com/Vinzent03/obsidian-git) — Git integration for vaults
- [liamcain/obsidian-calendar-plugin](https://github.com/liamcain/obsidian-calendar-plugin) — Calendar sidebar

### Developer Journaling

- [A Developer's Logbook](https://jamierubin.net/2021/04/29/a-developers-logbook/) — Logbook patterns
- [How I use Obsidian as an Engineering Manager](https://alanmooiman.com/blog/how-I-use-obsidian-as-an-engineering-manager) — Engineering management workflow
- [Build a Second Brain Using Obsidian — A Practical Guide for Engineers](https://ps11.hashnode.dev/engineers-guide-to-building-a-second-brain-in-obsidian-practical-tips) — Engineer-specific patterns

### Session Tracking Tools

- [claude-code-log](https://github.com/daaain/claude-code-log) — Convert Claude Code JSONL transcripts to readable HTML
- [claude-session-logger](https://github.com/DazzleML/claude-session-logger) — Real-time session logging
