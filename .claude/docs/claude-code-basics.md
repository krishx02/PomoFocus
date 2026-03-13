# Claude Code — Basics Guide

> Reference for Claude Code fundamentals. Coming from Cursor.

---

## Core Mindset Shift

In Cursor you **write code and ask Claude to review/assist**.
In Claude Code you **describe the goal and Claude explores, plans, then implements** autonomously. Think less "copilot" and more "delegated engineer."

---

## Plan Mode

Press **Shift+Tab** twice to cycle into Plan Mode — Claude reads files but makes zero changes.

- Get a detailed implementation plan you can approve
- Verify Claude understands the problem before acting
- Start a session directly in plan mode: `claude --permission-mode plan`

Once satisfied, press Shift+Tab back to normal mode to implement.

---

## CLAUDE.md — Persistent Project Brain

Claude reads `CLAUDE.md` at the start of **every session**. It survives context compaction (re-read from disk).

```markdown
# Build & Test

- Run `npm test` before committing
- Build: `npm run build`

# Architecture

- API handlers in `src/api/handlers/`
- Use async/await, not raw promises

# Conventions

- Feature branches: `feature/description`
- Commit format: "feat: description"
```

Run `/init` and Claude will auto-generate a starter CLAUDE.md from your codebase.

**File locations (most → least specific):**

- `./.claude/CLAUDE.md` — project-specific, committed to git
- `~/.claude/CLAUDE.md` — personal rules, all projects
- `.claude/CLAUDE.md.local` — local overrides, gitignored

**Import other files:**

```markdown
See @README.md for project overview
@docs/architecture.md
@~/.claude/my-preferences.md
```

---

## Key Slash Commands

| Command    | What It Does                                      |
| ---------- | ------------------------------------------------- |
| `/init`    | Generate CLAUDE.md from your codebase             |
| `/memory`  | View/edit CLAUDE.md and auto-memory files         |
| `/clear`   | Clear context between unrelated tasks             |
| `/compact` | Manually compress context (optionally with hints) |
| `/commit`  | AI-assisted git commit                            |
| `/hooks`   | Configure automation hooks                        |
| `/mcp`     | Manage MCP servers                                |
| `/context` | See what's consuming context tokens               |
| `/help`    | Show all available commands                       |

---

## Permissions & Auto-Approve

**Shift+Tab** cycles through permission modes:

- **Default** — prompts on every file edit/command
- **Accept Edits** — auto-approves file changes, prompts for commands
- **Plan Mode** — read-only

To auto-approve safe commands permanently, create `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["Bash(npm run test)", "Bash(npm run build)", "Bash(git commit *)", "Read", "Edit"]
  }
}
```

---

## Memory — Three Layers

| Layer           | Who Writes | Where                                        | Loaded When                      |
| --------------- | ---------- | -------------------------------------------- | -------------------------------- |
| **CLAUDE.md**   | You        | `./CLAUDE.md` or `~/.claude/CLAUDE.md`       | Every session, in full           |
| **Auto Memory** | Claude     | `~/.claude/projects/<proj>/memory/MEMORY.md` | First 200 lines at session start |
| **Topic files** | Claude     | `~/.claude/projects/<proj>/memory/*.md`      | On-demand                        |

- Auto memory = things Claude learns: build commands, debugging patterns, style preferences
- `/memory` opens an interactive menu to view/edit both
- Ask Claude: _"Add this to CLAUDE.md"_ or _"Remember that..."_ to save explicitly

---

## Context Window

- **No built-in meter by default**
- `/context` — shows what's consuming tokens
- `/statusline` — configure a status bar with `context_usage_percent`
- MCP servers add tool definitions to every request — check cost with `/mcp`

**Context fills up → Claude auto-compacts** (clears old tool outputs first, then summarizes conversation). CLAUDE.md survives; conversation context may not. Put persistent rules in CLAUDE.md.

`/compact focus on the API changes` — manually trigger with hints.

---

## Hooks — Deterministic Automation

Hooks run shell commands at lifecycle points. Unlike CLAUDE.md (advisory), hooks **guarantee** actions happen.

**Most valuable hooks:**

1. Notification when Claude needs input (biggest QoL win)
2. Auto-format after edits (PostToolUse on `Edit|Write`)
3. Block dangerous commands (PreToolUse rejecting `rm -rf`, `sudo`)
4. Protect sensitive files (block edits to `.env`, lock files)

**Anti-patterns:**

- Don't use hooks for things that need judgment — use CLAUDE.md
- Don't write to stdout unconditionally in shell profiles (corrupts JSON) — wrap with `if [[ $- == *i* ]]`
- Don't make hooks slow — they're in Claude's critical path
- Don't forget `chmod +x` on hook scripts

Configure via `/hooks` interactively.

---

## MCP Servers — External Tool Integration

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
claude mcp add --transport http notion https://mcp.notion.com/mcp
claude mcp list
```

---

## Keyboard Shortcuts

| Shortcut    | Action                              |
| ----------- | ----------------------------------- |
| `Shift+Tab` | Cycle permission modes              |
| `Esc`       | Stop Claude mid-action              |
| `Esc+Esc`   | Rewind/undo recent changes          |
| `Ctrl+C`    | Interrupt                           |
| `Ctrl+D`    | Exit Claude Code                    |
| `Ctrl+O`    | Toggle verbose mode (see reasoning) |

---

## Cursor Habits to Unlearn

1. Don't specify which files to edit — tell Claude the goal, let it find the files
2. Don't review changes in isolation — give Claude test criteria so it self-verifies
3. Don't think file-scope — Claude works across the whole codebase
4. Don't re-explain context each session — use CLAUDE.md and `/memory`

---

## Ideal Workflow Pattern

```
1. Enter Plan Mode → describe goal → Claude explores codebase
2. Review the plan → refine
3. Switch to normal mode → Claude implements
4. Claude runs tests, iterates, verifies
5. /commit when done
```
