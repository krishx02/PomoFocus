# Claude Code — Advanced / Power User Guide

> Everything beyond the basics for becoming a Claude Code pro.

---

## 1. Subagents & Parallel Work

Subagents run in their own context windows with custom prompts, tool restrictions, and permissions.

**When to use:**
- Isolate high-volume operations (tests, logs) — only summaries return to main context
- Run parallel research across multiple modules simultaneously
- Enforce tool restrictions (read-only reviewers, domain-specific agents)

**Create subagents** by adding markdown files to `.claude/agents/`:

```yaml
---
name: code-reviewer
description: Expert code reviewer for security and quality
tools: Read, Grep, Glob, Bash
model: sonnet
permissionMode: plan
---

You are a senior code reviewer. Focus on security vulnerabilities,
performance issues, and maintainability.
```

**Scopes (priority order):**
1. `--agents` CLI flag (session only)
2. `.claude/agents/` (project — commit to git for team sharing)
3. `~/.claude/agents/` (personal — all projects)

**Invoke:** Just ask Claude: *"Use code-reviewer to check this PR"*

---

## 2. Agent Teams (Experimental)

Coordinated multi-agent work with shared task lists and inter-agent communication.

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

- **Lead**: Main session coordinating work
- **Teammates**: Independent sessions with own context windows
- **Shared task list**: Automatic work distribution
- Token cost ~7x normal — keep teams small (3–5 teammates)

Display modes: `in-process` (default) or `tmux` (split panes, requires tmux/iTerm2)

---

## 3. Skills (Custom Slash Commands)

Skills are `.md` files in `.claude/skills/<name>/SKILL.md` with YAML frontmatter.

```yaml
---
name: pr-summary
description: Summarize pull request changes
user-invocable: true
context: fork
allowed-tools: Bash(gh *)
---

## PR Context
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

Summarize the changes, intent, and risks.
```

Commands wrapped in `` !`...` `` execute before Claude sees the content (dynamic context injection).

**Frontmatter options:**
- `user-invocable: false` — only Claude loads it, not user-invoked
- `disable-model-invocation: true` — only you can trigger, not Claude
- `context: fork` — runs in subagent (isolates context)
- `agent: Explore` — use a specific subagent type
- `isolation: worktree` — run in isolated git worktree

**Invoke:** `/skill-name` or `/skill-name arguments`

**Bundled skills:**
- `/simplify` — reviews changed files for quality/efficiency, spawns 3 parallel agents
- `/batch` — orchestrates large-scale changes across codebase in parallel worktrees
- `/debug` — troubleshoots current Claude Code session via debug logs

---

## 4. Worktrees for Parallel Development

Git worktrees let Claude work on multiple features simultaneously without conflicts.

```bash
# Create a named worktree session
claude --worktree feature-auth

# Auto-generate name
claude --worktree
```

- Created at `<repo>/.claude/worktrees/<name>/`
- Branch named `worktree-<name>`
- Auto-cleaned up if no changes; prompted to keep if changes exist

Add to `.gitignore`:
```
.claude/worktrees/
```

Subagents can run in their own worktrees:
```yaml
---
name: parallel-worker
isolation: worktree
---
```

---

## 5. Extended Thinking & High Effort Mode

Extended thinking gives Claude dedicated reasoning space before responding.

**Best for:**
- Complex architectural decisions
- Challenging bugs requiring deep analysis
- Multi-step implementation planning
- Evaluating tradeoffs

**Configure:**
```bash
# In /model picker, adjust the effort slider
# Or set globally:
export CLAUDE_CODE_EFFORT_LEVEL=high
```

```json
// settings.json
{ "effortLevel": "high" }
```

- `Option+T` / `Alt+T` — toggle thinking on/off
- `Ctrl+O` — verbose mode to see reasoning (shown as gray italic text)
- `MAX_THINKING_TOKENS=8000` — set budget limit
- High effort only on Opus 4.6 (adaptive reasoning)

---

## 6. CI/CD Integration

### GitHub Actions

```bash
/install-github-app  # Quick setup
```

```yaml
# Manual GitHub Actions
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    # Responds to @claude mentions in PR comments
```

### Headless / Print Mode

```bash
# Non-interactive query
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"

# Pipe data
cat build-error.txt | claude -p "explain the root cause" > output.txt

# Structured JSON output
claude -p "Extract function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}}}' \
  | jq '.structured_output'

# Continue conversations across script invocations
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue the review" --resume "$session_id"

# With max turns (useful in CI to prevent runaway)
claude -p "Run tests and fix failures" --max-turns 5
```

---

## 7. Cost Management

```bash
/cost   # Current session usage
/stats  # Per-session stats
```

**Strategies:**
1. `/clear` between unrelated tasks
2. Use Sonnet for most tasks, Opus only for complex architecture
3. Use Haiku for subagents doing simple research
4. Disable unused MCP servers (`/mcp`) — each adds overhead per request
5. Move verbose CLAUDE.md instructions to skills (skills load on-demand)
6. Reduce `MAX_THINKING_TOKENS` for simple tasks
7. Delegate verbose operations (logs, tests) to subagents — only summaries return
8. Use plan mode before implementation — prevents expensive re-work

**Add compaction hints to CLAUDE.md:**
```markdown
# Compact Instructions
When you compact, focus on test output and code changes.
```

---

## 8. Debugging Claude Code

```bash
/debug             # Read session debug log, troubleshoot session
/debug "description of issue"

# CLI flags
claude --debug     # Enable debug output
claude --verbose   # More detailed output
Ctrl+O             # Toggle verbose mode in session
```

**Session logs:** `~/.claude/projects/{project}/{sessionId}/`

**Common issues:**
- Skill not triggering → description doesn't match; try `/skill-name` directly
- Claude not seeing files → check `/context` and `/permissions`
- High token usage → run `/context`, look for large CLAUDE.md or many MCP tools

---

## 9. Advanced CLAUDE.md Patterns

**Keep main file under 200 lines.** Use imports for detailed docs.

```markdown
# CLAUDE.md
See @docs/architecture.md for design decisions
See @docs/api-standards.md for API conventions
@~/.claude/my-preferences.md
```

**Path-specific rules** via `.claude/rules/`:
```yaml
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules
- Include input validation
- Use standard error response format
```

**Exclude irrelevant CLAUDE.md files** in settings.json:
```json
{
  "claudeMdExcludes": [
    "**/other-team/CLAUDE.md"
  ]
}
```

---

## 10. Session Management

```bash
/rename auth-refactor     # Name current session
/rewind                   # Go back to a checkpoint

claude --resume           # Open session picker
claude --continue         # Continue most recent
claude --from-pr 123      # Start session from a PR
```

**Session picker shortcuts:**
- `P` — preview session
- `R` — rename
- `/` — search
- `B` — filter by git branch

Sessions stored at: `~/.claude/projects/{project}/`

---

## 11. Status Line

```bash
/statusline  # Configure interactive
```

Or in `settings.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.claude/statusline.sh"
  }
}
```

Available data: `context_usage_percent`, `tokens_used`, git status, cost, duration.

---

## 12. Multi-Agent Orchestration

**Claude Code as an MCP server** (use it from Claude Desktop or other tools):
```bash
claude mcp serve
```

**Coordination patterns:**
- Sequential: `Use code-reviewer to find issues` → `Use optimizer to fix them`
- Parallel: `Research auth, database, and API modules in parallel`
- Teams: Spawn specialists (security, performance, test coverage) to review a PR simultaneously

---

## 13. IDE Integrations

- **VS Code extension** — resume past conversations, run multiple conversations, full worktree support
- **JetBrains** — IntelliJ, PyCharm, WebStorm; supports WSL and SSH remote dev

Best use: IDE extension for in-editor context + CLI for complex agentic work.

---

## Power User Workflow Patterns

### Pattern 1: TDD with Claude
```bash
claude --permission-mode plan
> Design tests for this feature

# Review, refine → Shift+Tab to exit plan mode

> Implement to make those tests pass
```

### Pattern 2: Large-Scale Refactoring
```bash
/batch migrate src/ from old-library to new-library
# Claude decomposes into 5–30 units, spawns parallel agents in worktrees
# Each opens a PR with tests passing
```

### Pattern 3: Subagent Specialization
```
.claude/agents/code-reviewer.md    # Read-only, plan mode
.claude/agents/api-developer.md    # API implementation
.claude/agents/data-scientist.md   # SQL and analysis
```

### Pattern 4: Skills as Team Workflows
```bash
/ship-issue 123       # Fix a GitHub issue by number
/deploy production   # Deploy with all checks
/pr-review           # Review and suggest improvements
```

---

## Quick Reference

```bash
# Context & Cost
/context        # What's consuming tokens
/cost           # Token usage and cost
/compact        # Compress context (optionally with hints)
/clear          # Clear conversation, keep code changes

# Agents & Skills
/agents         # Create/manage subagents
/skills         # Browse available skills

# Session
/resume         # Pick session to continue
/rename name    # Name current session
/rewind         # Go back to checkpoint

# Model & Thinking
/model          # Switch models or adjust effort
Ctrl+O          # Toggle verbose/thinking display
Option+T        # Toggle extended thinking (macOS)
Shift+Tab       # Cycle permission modes

# Reference Files in Prompts
@file.ts        # Reference specific file
@~/path         # Reference home directory file
@dir/           # Reference directory structure
```
