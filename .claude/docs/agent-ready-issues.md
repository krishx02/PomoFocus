# Agent-Ready GitHub Issues — Acceptance Criteria Guide

> How to write GitHub Issues that Claude Code cloud sessions (and any AI agent) can autonomously execute, self-verify, and ship as PRs.

---

## Core Principle

**The agent's feedback loop is: read issue → write code → run test command → check results → fix → repeat.** Without executable acceptance criteria, agents either loop forever, stop prematurely, or require human intervention.

---

## Issue Structure Template

Every agent-ready issue must have these sections:

````markdown
## Goal

[One sentence. What should be true when done?]

## Context

[Why this matters. Links to related issues/PRs/docs.]

## Acceptance Criteria

- [ ] [Testable assertion 1]
- [ ] [Testable assertion 2]
- [ ] All tests pass: `[exact test command]`
- [ ] No lint/type errors: `[exact lint command]`

## Files in Scope

- `/exact/path/from/repo/root.ts` — what changes here

## Out of Scope

- Do NOT modify [specific files/systems]

## Success Test Command

```bash
[exact copy-pasteable command that must pass]
```
````

## Branch Base

`main` (or `feature/other-branch` if building on a PR)

```

### Why Each Section Matters

| Section | Agent behavior without it |
|---------|--------------------------|
| **Acceptance Criteria** | Agent doesn't know when to stop |
| **Files in Scope** | Agent wastes time searching or edits wrong files |
| **Out of Scope** | Agent over-implements, breaks unrelated code |
| **Success Test Command** | Agent can't self-verify. PR will be unreviewed guesswork |

---

## Writing Acceptance Criteria That Agents Can Verify

### The Rules

1. **Every criterion must be automatable.** If it requires a human to "look at it", rewrite as a test.
   - Bad: "The UI looks correct"
   - Good: "The snapshot test `TimerView.1` passes"

2. **Use specific values, not adjectives.**
   - Bad: "Handle errors gracefully"
   - Good: "API returns 400 with `{error: 'name required'}` when name is empty"

3. **Include the exact test command.**
   - Bad: "Make sure tests pass"
   - Good: `pnpm test --filter @pomofocus/core -- --testPathPattern=timer`

4. **File paths are absolute from repo root.**
   - Bad: "the timer file"
   - Good: `packages/core/src/timer.ts`

5. **Include error messages/stack traces verbatim** (for bugs).

6. **Specify the commit message prefix** if you follow conventional commits.
   - "Commit message starts with `fix:` or `feat:`"

### Templates by Type

**API Endpoint:**
```

- [ ] POST /api/sessions accepts { duration, type }
- [ ] Returns 201 with { id, duration, type, created_at }
- [ ] Returns 400 if duration < 1 or > 60
- [ ] Returns 401 if no auth header
- [ ] Test passes: pnpm test -- sessions

```

**UI Component:**
```

- [ ] Component renders timer in MM:SS format
- [ ] Start button begins countdown
- [ ] Timer auto-stops at 0:00
- [ ] Accessible: has aria-label on interactive elements
- [ ] Test passes: pnpm test -- TimerDisplay

```

**Data Layer / Schema:**
```

- [ ] Table `sessions` has columns: id (uuid), user_id (uuid), duration (int), type (text)
- [ ] RLS policy: users can only read/write their own sessions
- [ ] Migration runs cleanly: pnpm db:migrate
- [ ] Test passes: pnpm test -- session-model

```

**Bug Fix:**
```

- [ ] [Exact error message] no longer occurs
- [ ] Regression test `testTimerDoesNotResetOnBackground` exists and passes
- [ ] Original behavior preserved: [specific existing test] still passes
- [ ] Test passes: pnpm test -- timer

```

### Anti-Patterns (Vague Criteria That Break Agents)

| Bad criterion | Why it fails | Rewrite as |
|--------------|-------------|------------|
| "Handle errors gracefully" | Subjective, unmeasurable | "Returns 400 with JSON error body on invalid input" |
| "Improve performance" | No threshold, no exit condition | "Response time < 200ms for GET /api/sessions (measured by test)" |
| "Follow best practices" | Undefined | "Passes ESLint with project config, no `any` types" |
| "Make it user-friendly" | Subjective | "Keyboard navigable, ARIA labels present, tested at 375px viewport" |
| "Add proper validation" | What's proper? | "Rejects empty name, name > 255 chars, non-string name" |
| "Update everywhere X is used" | Unbounded scope | List the 3 specific files to update |

---

## The Ralph Loop: How Agents Self-Verify

The proven autonomous agent pattern:

```

Agent reads issue + acceptance criteria
↓
Writes code + runs test command
↓
Test fails? → Reads error → Fixes code → Re-runs test
↓
Test passes? → Checks each acceptance criterion
↓
All criteria met? → Opens PR → Done
↓
Criteria not met? → Picks next failing one → Loop back

````

**Key insight:** The test command is the loop's feedback signal. Make it:
- **Fast** (<30 seconds) — agents run it repeatedly
- **Exact** — copy-pasteable, no setup steps
- **Comprehensive** — covers all acceptance criteria
- **Deterministic** — same result every time

### Test Command Examples

```bash
# Good: specific, fast, covers the feature
pnpm test --filter @pomofocus/core -- --testPathPattern=timer && pnpm lint

# Good: full validation pipeline
pnpm test --filter @pomofocus/core && pnpm type-check && pnpm lint

# Bad: too slow for loop iteration
pnpm test:all  # 5 minutes

# Bad: vague
npm test

# Bad: requires manual setup
npm test  # (assumes Postgres is running on port 5432)
````

---

## ATDD: Given/When/Then Format

For complex features, structure acceptance criteria as scenarios:

```
GIVEN no sessions exist for the user
WHEN user POSTs to /api/sessions with { duration: 25, type: "focus" }
THEN response is 201 Created
AND response includes { id: <UUID>, duration: 25, type: "focus" }
AND GET /api/sessions returns that session

GIVEN user has an active session
WHEN user POSTs to /api/sessions with { duration: 25, type: "focus" }
THEN response is 409 Conflict
AND response includes { error: "Active session already exists" }
```

Each scenario maps 1:1 to a test case. Agents can translate these directly into test code.

---

## Agent-Ready Checklist

Before labeling an issue `agent-ready`, verify:

- [ ] Title is specific (not "Fix bugs" — "Timer resets on iOS backgrounding")
- [ ] Each acceptance criterion is testable with a command or assertion
- [ ] Test command is exact, fast (<30s), and copy-pasteable
- [ ] Files in scope are listed with repo-root paths
- [ ] Out of scope explicitly states what NOT to touch
- [ ] No vague language: "properly", "gracefully", "best practices" → replaced with specifics
- [ ] One focus area (not "improve performance everywhere")
- [ ] Branch base specified
- [ ] No human-only verification steps (everything automatable)

---

## Cloud Sessions + Issues: The Full Workflow

### Option A: `@claude` in GitHub Issues (most autonomous)

1. Create an agent-ready issue using the template above
2. Label it `agent-ready`
3. Comment: `@claude implement this`
4. Claude Code cloud session:
   - Clones repo from GitHub (your machine doesn't need to be on)
   - Reads CLAUDE.md + issue
   - Creates branch, implements
   - Runs test command in a loop until passing
   - Opens PR with "Closes #N"
5. You review and merge

### Option B: `claude --remote` from CLI

```bash
claude --remote "Fix issue #42 — follow acceptance criteria exactly"
```

### Option C: Web UI at claude.ai/code

Submit the issue URL or paste the acceptance criteria directly.

---

## How This Relates to Existing Research

This doc builds on `research/02-github-for-agents.md` which defines:

- Issue template YAML files (feature-agent.yml, bug-agent.yml)
- 8 writing rules for agent-ready tickets
- Label strategy (agent-ready, needs-human, effort:small/large, etc.)
- `/ship-issue` and `/decompose-issue` skill specs
- Platform subagent configurations

What this doc adds:

- **Ralph Loop pattern** for agent self-verification loops
- **ATDD Given/When/Then** format for complex acceptance criteria
- **Anti-pattern table** with specific rewrites
- **Cloud session integration** (how issues flow into remote execution)
- **Test command best practices** (fast, exact, deterministic)
- **Templates by feature type** (API, UI, data layer, bug fix)
