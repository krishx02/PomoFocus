# GitHub + Agents: PomoFocus Operational Reference

> Comprehensive reference for the agent-first development workflow. Every agent and human working on PomoFocus should read this before picking up a ticket.
>
> **Stack:** Nx + pnpm monorepo · Supabase · Cloudflare Workers · Better Auth · Expo/React Native · SwiftUI · Vercel
> **Status:** Pre-code — setting up agent infrastructure before writing app code.

---

## Table of Contents

1. [The Complete Agent Workflow](#1-the-complete-agent-workflow)
2. [Writing Agent-Ready Issues](#2-writing-agent-ready-issues)
3. [Label Strategy & Project Board](#3-label-strategy--project-board)
4. [Skills Reference](#4-skills-reference)
5. [Platform Subagents](#5-platform-subagents)
6. [GitHub Integrations](#6-github-integrations)
7. [CI/CD Reference](#7-cicd-reference)
8. [Test Baseline Requirements](#8-test-baseline-requirements)
9. [Context Architecture](#9-context-architecture)
10. [Anti-Patterns & Failure Table](#10-anti-patterns--failure-table)
11. [Third-Party Tools](#11-third-party-tools)
12. [Sources](#12-sources)

---

## 1. The Complete Agent Workflow

### Standard Loop

```
GitHub Issue (labeled "agent-ready")
         ↓
/fix-issue N  (Claude Code session)
         ↓
Read issue → check effort:large → if yes: /decompose-issue N, stop
         ↓ (issue is effort:small or unlabeled)
Create branch: feature/issue-N-<slug>
         ↓
Read all Affected Files listed in issue
         ↓
Implement to satisfy Acceptance Criteria
(never touch files listed in Out of Scope)
         ↓
Run Test Plan command — fix failures — repeat until all pass
         ↓
gh pr create "Closes #N"
         ↓
Update labels: in-progress → in-review
         ↓
GitHub Actions: lint + test + preview deploy
         ↓
Human reviews and merges
```

### Quick-Reference Commands

```bash
# Pick up an issue
/fix-issue 42

# Decompose a large issue into sub-issues
/decompose-issue 42

# Read an issue manually
gh issue view 42 --json number,title,body,labels

# Find all agent-ready issues
gh issue list --label "agent-ready" --state open

# Create a feature branch
git checkout -b feature/issue-42-timer-background-fix

# Open a PR
gh pr create --title "fix: timer background persistence (#42)" --body "Closes #42"

# Update labels after PR is open
gh issue edit 42 --remove-label "in-progress" --add-label "in-review"
```

### Definition of Done

Before opening any PR, verify:
1. `pnpm nx affected --target=test` passes (all affected packages)
2. `pnpm nx affected --target=lint` exits clean
3. `pnpm type-check` exits with no errors
4. PR body contains "Closes #N"
5. No files outside the issue's "Affected Files" were modified (unless "Out of Scope" explicitly permits)

---

## 2. Writing Agent-Ready Issues

### The WRAP Framework (GitHub Engineering)

Every agent-ready issue must satisfy WRAP:

- **W — Write effectively:** Describe as if for someone brand new to the codebase. No implicit knowledge.
- **R — Refine instructions:** Repository-level context is in AGENTS.md and CLAUDE.md — don't repeat it; reference it.
- **A — Atomic tasks:** 1–3 sentences, <10 files, one context window. One layer per issue (data OR logic OR UI).
- **P — Pair strengths:** Humans define the goal and verify; agents implement and test.

### Annotated Issue Template

```markdown
## Goal
[One sentence, verifiable assertion. NOT "improve X" — but "X must Y when Z."]

Example: The focus session timer must not reset when the iOS app is backgrounded
for up to 10 minutes on iOS 17+.

## Context & Background
[Why this is needed. Links to related issues, PRs, design docs.]
[Reference commits if this is a regression: "Introduced in commit a3f9d2c (PR #37)"]

## Affected Files
[Exact paths from repo root. Agents waste turns on discovery you can do in 10 seconds.]
- `packages/core/src/timer/TimerMachine.ts` — state machine logic
- `apps/mobile/src/hooks/useTimer.ts` — hook wrapping state machine
- `apps/mobile/src/__tests__/useTimer.test.ts` — add regression test here

## Acceptance Criteria
[Each criterion must be automatable. "UI looks correct" → "snapshot test passes".]
- [ ] `pnpm nx test @pomofocus/core` passes with no new failures
- [ ] New test `TimerMachine.backgroundPersistence` exists and passes
- [ ] Timer continues counting after app backgrounded 30–60s (verified in simulator)
- [ ] `pnpm type-check` exits clean

## Out of Scope
[Mandatory. Agents over-reach. List what must NOT change.]
Do NOT modify `apps/web/` or `native/mac-widget/`.
Do NOT change the TimerState interface in `packages/core/src/types.ts`.

## Test Plan
[Exact commands. Not "run the tests" — the exact invocation.]
1. `pnpm nx test @pomofocus/core`
2. `pnpm nx test @pomofocus/mobile`
3. Manually: start timer → background app → wait 30s → foreground → confirm state

## Platform
[iOS / Android / Web / Shared/Cross-platform / All platforms]
```

### 8 Rules for Agent-Ready Tickets

**Rule 1: The goal is a verifiable assertion**
Bad: "Improve the timer" — Good: "Timer must not drift >1s over 25 minutes when backgrounded"

**Rule 2: Every acceptance criterion must be automatable**
If it requires a human to "look at it," rewrite it as a test. "Looks correct" → "snapshot passes."

**Rule 3: File paths are absolute from repo root**
Not "the timer file" — `packages/core/src/timer/TimerMachine.ts`. No discovery turns wasted.

**Rule 4: Out-of-scope is mandatory**
Agents over-reach. If you don't say "don't touch X," they will touch X.

**Rule 5: Include the exact error message or test ID**
For bugs: paste the full stack trace. For test failures: paste the exact test name.

**Rule 6: Link all related context**
Related issues, the PR that introduced the bug, design docs, API schemas.

**Rule 7: Include the exact test command**
Not "make sure tests pass" — `pnpm nx test @pomofocus/core --testNamePattern=TimerMachine`.

**Rule 8: Specify branch base**
For most issues: `base: main`. For issues building on an in-flight PR: specify that branch.

### "Too Large" Signals

Label `effort:large` and route to `/decompose-issue` if any of:
- Changes to more than ~10 files
- Spans multiple layers (data + logic + UI in the same issue)
- Acceptance criteria list is longer than 8 items
- Issue includes "refactor X," "migrate Y," or "redesign Z" without narrow scope

### Worked Example (PomoFocus Bug Ticket)

```markdown
## Goal
The focus session timer resets to 25:00 when the iOS app is backgrounded for more
than 30 seconds, instead of continuing to count down.

## Context & Background
Reported in #39. Introduced in commit a3f9d2c (PR #37 — timer refactor).
Timer was refactored to use Timer.scheduledTimer without RunLoop.main.add(),
which causes it to stop firing when app enters background.

## Affected Files
- `packages/core/src/timer/TimerMachine.ts` — timer scheduling logic (line ~87)
- `apps/mobile/src/__tests__/TimerMachine.test.ts` — add regression test here

## Acceptance Criteria
- [ ] `pnpm nx test @pomofocus/core` passes with no new failures
- [ ] New test `TimerMachine.continuesInBackground` exists and passes
- [ ] `pnpm type-check` exits clean
- [ ] Commit message starts with "fix:"

## Out of Scope
Do NOT modify `apps/web/`, `native/mac-widget/`, or any Android files.
Do NOT change the TimerState interface in `packages/core/src/types.ts`.

## Test Plan
1. `pnpm nx test @pomofocus/core`
2. Confirm `TimerMachine.continuesInBackground` is listed as passed

## Platform
iOS only
```

This ticket can be executed with `/fix-issue 42` without a single follow-up question.

---

## 3. Label Strategy & Project Board

### Full Label Table

| Label | Color | Meaning |
|-------|-------|---------|
| `agent-ready` | `#0075ca` (blue) | All fields complete — cleared for agent pickup |
| `in-progress` | `#e4e669` (yellow) | Agent or human actively working |
| `in-review` | `#d93f0b` (orange) | PR open, awaiting review |
| `needs-human` | `#ee0701` (red) | Agent flagged a blocker requiring human judgment |
| `decomposed` | `#bfd4f2` (light blue) | Parent issue broken into sub-issues; tracks via task list |
| `effort:small` | `#c5def5` (pale blue) | <1 hour — implement directly |
| `effort:large` | `#e99695` (salmon) | Too large — decompose first |
| `platform:ios` | `#c2e0c6` (green) | iOS-only work |
| `platform:android` | `#c2e0c6` (green) | Android-only work |
| `platform:web` | `#c2e0c6` (green) | Web-only work |
| `platform:shared` | `#c2e0c6` (green) | Affects shared packages |
| `platform:vscode` | `#c2e0c6` (green) | VS Code extension work |
| `platform:mac` | `#c2e0c6` (green) | macOS widget work |

### Issue State Machine

```
Created (draft)
    ↓ [fill all template fields]
Backlog (project column)
    ↓ [verify agent-ready criteria met]
Agent-Ready (column + label)
    ↓ [/fix-issue N or agent pickup]
In Progress (column + label)
    ↓ [PR opened]
In Review (column + label)
    ↓ [human reviews, approves]
Done (column + closed)
```

The `needs-human` label can be applied at any stage — it pauses the agent loop and requires human input before proceeding.

### GitHub Projects v2 — GraphQL Queries

**Find agent-ready items:**
```graphql
query($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 20) {
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              body
              url
            }
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
        }
      }
    }
  }
}
```
Filter where `field.name == "Status"` and `name == "Agent-Ready"`.

**Move item to "In Progress":**
```graphql
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: { singleSelectOptionId: $optionId }
  }) {
    projectV2Item { id }
  }
}
```

**Run via gh CLI:**
```bash
gh api graphql -f query='...' -F projectId=PVT_xxx -F itemId=PVTI_xxx ...
```

---

## 4. Skills Reference

### `/fix-issue [number]`

**File:** `.claude/skills/fix-issue/SKILL.md`

**What it does:** Picks up a GitHub issue by number. Checks for `effort:large` label; if found, delegates to `/decompose-issue` and stops. Otherwise: creates branch, reads affected files, implements, runs tests, opens PR, updates labels.

**Usage:**
```
/fix-issue 42
```

**Key behaviors:**
- Stops immediately if `effort:large` — never attempts to implement oversized issues
- Stops immediately if `needs-human` — comments explaining what decision is needed
- Branch naming: `feature/issue-N-<slug>` or `fix/issue-N-<slug>`
- PR body always includes "Closes #N"
- Respects "Out of Scope" from issue — never touches those files

### `/decompose-issue [number]`

**File:** `.claude/skills/decompose-issue/SKILL.md`

**What it does:** Breaks a large issue into 3–5 sub-issues using the data→logic→UI split pattern. Creates each sub-issue with full agent-ready template fields, comments a task list on the parent, and relabels the parent `decomposed`.

**Usage:**
```
/decompose-issue 42
```

**Split pattern:**
- Sub-issue A: Data/state layer (store, model, types)
- Sub-issue B: Service/logic layer (hooks, utils, API client)
- Sub-issue C: UI layer (component, screen) — depends on A and B
- Sub-issue D: Tests and documentation (if needed)

### `/clarify [description]`

**File:** `.claude/skills/clarify/SKILL.md`

**What it does:** Runs a structured 5-question intake interview before implementing anything. Saves output as a written spec to `.claude/specs/`. Required for any request that would touch >3 files.

### Planned Skills (Not Yet Created)

| Skill | Purpose |
|-------|---------|
| `/create-issue` | Scaffold an agent-ready issue from a description |
| `/triage-issues` | Scan open issues, apply labels, move to correct columns |
| `/standup` | Summarize recent commits and open PRs |

---

## 5. Platform Subagents

### Why Subagents

Each platform has different tools, test commands, file structures, and gotchas. A generic agent might modify iOS Swift files when working on a web issue, or run the wrong test suite. Subagents constrain scope automatically.

### Scope Table

| Agent File | Platform | Root Directory | Test Command |
|------------|----------|---------------|--------------|
| `shared-developer.md` | Cross-platform TypeScript | `packages/` | `pnpm nx affected --target=test` |
| `web-developer.md` | Next.js web app | `apps/web/` | `pnpm nx test @pomofocus/web` |
| `mobile-developer.md` | Expo (iOS + Android) | `apps/mobile/` | `pnpm nx test @pomofocus/mobile` |
| `ios-developer.md` | SwiftUI: macOS widget + iOS widget + watchOS | `native/apple/` | `xcodebuild test -scheme PomoFocus` |
| `vscode-developer.md` | VS Code extension | `apps/vscode-extension/` | `pnpm nx test @pomofocus/vscode-extension` |
| `mcp-developer.md` | MCP server | `apps/mcp-server/` | `pnpm nx test @pomofocus/mcp-server` |

### Boundary Rules (All Subagents)

**Always:**
- Run the platform's test command before declaring done
- Create a branch for every change
- Include "Closes #N" in every PR

**Never:**
- Modify files outside your designated root directory
- Install new dependencies without noting them in the PR
- Push directly to `main`

---

## 6. GitHub Integrations

### GitHub MCP Server

The GitHub MCP server gives Claude Code native access to GitHub APIs as tools.

**Setup:**
```bash
# Using the community MCP server
claude mcp add github -- npx -y @modelcontextprotocol/server-github
# Set GITHUB_TOKEN in environment
```

**Available tools once connected:**
- `get_issue`, `list_issues`, `create_issue`, `update_issue`
- `create_pull_request`, `get_pull_request`, `list_pull_requests`
- `search_code`, `get_file_contents`, `list_commits`

Config in `.claude/settings.json` (already set up — see Section 9).

### Claude Code GitHub Action v1.0 (GA)

**One-command install:**
```bash
claude /install-github-app
```

**Manual workflow** (`.github/workflows/claude.yml`):
```yaml
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "Implement the feature described in this issue"
          claude_args: |
            --append-system-prompt "Follow CLAUDE.md and AGENTS.md conventions"
            --max-turns 10
```

**Trigger in issues/PRs:** Comment `@claude implement this` or `@claude review for security`.

### GitHub Agentic Workflows (Tech Preview, Feb 2026)

Plain Markdown files in `.github/workflows/` that agents execute directly. Available via `gh aw` CLI.

**Issue triage example** (`.github/workflows/triage.md`):
```markdown
---
name: Issue Triage
on:
  issues:
    types: [opened, reopened]
permissions:
  issues: write
outputs:
  - type: comment
  - type: issue_label
---

When a new issue is opened:
1. Analyze the title and description
2. Classify: bug / feature / documentation / performance
3. Apply appropriate labels
4. Apply the platform label (ios / android / web / shared)
5. Post a comment summarizing findings and next steps
```

### Issue Templates

Auto-enforce agent-ready format on every new issue. See `.github/ISSUE_TEMPLATE/`:
- `feature-agent.yml` — feature tickets (auto-labels: `agent-ready`, `enhancement`)
- `bug-agent.yml` — bug reports (auto-labels: `agent-ready`, `bug`)
- `config.yml` — disables blank issues

### Branch Protection Rules

- Protect `main`: require PR + at least 1 review
- Require status checks: `CI / lint-and-test` (Nx affected)
- Claude Code Action pushes to feature branches, never directly to `main`
- Bot/GitHub App user must be allowed to push to feature branches

---

## 7. CI/CD Reference

### Workflow Map

| Workflow File | Trigger | Platforms |
|--------------|---------|-----------|
| `.github/workflows/ci.yml` | PR to main | All (Nx affected) |
| `.github/workflows/claude.yml` | `@claude` comment | Any |
| `.github/workflows/deploy-web.yml` | Push to main, `apps/web/**` changes | Web → Vercel |
| `.github/workflows/mobile.yml` | Push to main, `apps/mobile/**` changes | iOS + Android → EAS |
| `.github/workflows/mac-widget.yml` | Push to main, `native/mac-widget/**` | macOS → Xcode Cloud |
| `.github/workflows/vscode.yml` | Tag push (`v*`) | VS Code Marketplace |

### What Agents Must Know About CI

- Nx affected detection requires `fetch-depth: 0` in checkout
- Path filters prevent cross-platform interference: a web change doesn't trigger mobile CI
- Preview deployments are auto-created on PR open (Vercel)
- Required checks are platform-specific — a failing iOS build doesn't block a web-only PR
- `pnpm nx affected --target=test --base=origin/main --head=HEAD` is the canonical test command for CI

### Nx Affected Detection

```bash
# Find all affected packages (what would be tested in CI)
pnpm nx show projects --affected --base=origin/main --head=HEAD

# Run tests for affected packages only
pnpm nx affected --target=test --base=origin/main --head=HEAD

# Run lint for affected packages only
pnpm nx affected --target=lint --base=origin/main --head=HEAD
```

---

## 8. Test Baseline Requirements

**Critical:** Agents cannot self-correct without tests. The test infrastructure must exist before any app code is written. A codebase without tests is not agent-ready.

### Per-Package Test Requirements

| Package/App | Framework | Test Command | Min Coverage |
|-------------|-----------|-------------|-------------|
| `packages/core` | Vitest | `pnpm nx test @pomofocus/core` | 100% (state machine) |
| `packages/types` | TypeScript (type-level) | `pnpm type-check` | N/A |
| `packages/api-client` | Vitest (mocked) | `pnpm nx test @pomofocus/api-client` | 80% |
| `apps/web` | Vitest + Playwright | `pnpm nx test @pomofocus/web` | 70% |
| `apps/mobile` | Jest + Detox/Maestro | `pnpm nx test @pomofocus/mobile` | 70% |
| `apps/vscode-extension` | Jest | `pnpm nx test @pomofocus/vscode-extension` | 70% |
| `apps/mcp-server` | Vitest | `pnpm nx test @pomofocus/mcp-server` | 80% |
| `native/mac-widget` | XCTest | `xcodebuild test -scheme PomoFocus` | 70% |

### Test-First Rule

The Ralph Loop: every implementation cycle ends with running tests. If tests fail, fix them before proceeding. Never open a PR with failing tests.

```
Implement → Run tests → Fix failures → Run tests → [pass] → Open PR
```

### Verifying Tests Can Fail

After writing any test, verify it can fail by temporarily breaking the code under test. A test that always passes regardless of implementation provides no signal. This is called "test washing" — avoid it.

---

## 9. Context Architecture

### File Hierarchy (Precedence Order)

```
AGENTS.md          ← Cross-agent open standard (Linux Foundation, 60+ agents)
                     Applies to: Claude Code, Copilot, Cursor, VS Code, all
    ↓
CLAUDE.md          ← Claude Code-specific rules
                     Applies to: Claude Code sessions only
    ↓
.claude/agents/    ← Platform subagent definitions
                     Applies to: Subagent sessions (scoped by platform)
    ↓
Issue body         ← Task-specific context (goal, files, criteria)
                     Applies to: The current ticket only
```

### What Goes Where

| Content | File |
|---------|------|
| Monorepo directory map | `AGENTS.md` |
| Exact build/test/lint commands | `AGENTS.md` |
| Code style examples | `AGENTS.md` |
| Three-tier boundaries | `AGENTS.md` |
| Clarification rules | `CLAUDE.md` |
| Destructive operation guards | `CLAUDE.md` |
| Claude-specific behavior | `CLAUDE.md` |
| Agent-first workflow description | `CLAUDE.md` |
| Platform scope + test command | `.claude/agents/<platform>.md` |
| Goal, files, criteria, test plan | GitHub Issue body |
| Do NOT repeat | Cross-file duplication |

### Settings Files

| File | Committed? | Purpose |
|------|-----------|---------|
| `.claude/settings.json` | Yes | Shared MCP server config + base permissions |
| `.claude/settings.local.json` | No (gitignored) | Personal overrides — hooks, local tokens |

### MCP Server Config

In `.claude/settings.json`:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## 10. Anti-Patterns & Failure Table

| Anti-pattern | Result | Fix |
|-------------|--------|-----|
| Vague issue ("improve the timer") | Low-quality code, fails CI | WRAP framework + atomic sizing |
| No tests in repo | Agent can't self-correct, requires hand-holding | Write test baseline before onboarding agents |
| Large feature in one issue | Context explosion, partial implementation | Decompose into data→logic→UI sub-issues |
| "Out of Scope" omitted | Agent modifies files it shouldn't | Make Out of Scope mandatory in every template |
| Test command omitted from issue | Agent runs wrong tests or none | Rule 7: always include exact test command |
| Autonomous agent blocked on approval prompt | Silent hang, wasted CI minutes | Pre-approve in `.claude/settings.json` |
| AI reviewing AI code as final step | Subtle bugs slip through | Human review is always the final gate |
| IaC tasks assigned without tests | High error rate, agent hesitates | Write acceptance tests first, then implement |
| Committing to main directly | Bypasses review, breaks branch protection | Branch per issue, PR per branch, always |
| Context poisoning (many failed attempts in session) | LLM biased toward failed patterns | Start fresh session, summarize what failed |

### Solo Founder Advantage

As a solo founder you don't need consensus — you can make every issue agent-ready immediately and skip the "ticket hygiene" political battles that slow teams down. Use this advantage: write every issue as if you're briefing a capable new contractor who has never seen the codebase.

### Human Boundaries — What Must Stay Human

**Always human:**
- Architectural decisions (tech stack, dependency selection)
- Security-sensitive code (auth, crypto, payment flows, data validation at boundaries)
- Performance-critical paths requiring profiling
- Cross-platform compatibility decisions
- Any change touching payments or user data

**Agent with human review:**
- Writing tests for existing functions
- Generating new components from a spec
- Refactoring within a single file
- Generating TypeScript types from API schemas
- Writing migration scripts

**Agent autonomous:**
- Boilerplate within established patterns
- Documentation for existing code
- Fixing CI failures on agent-created PRs

---

## 11. Third-Party Tools

### Active (Set Up Now)

| Tool | Purpose | Setup |
|------|---------|-------|
| GitHub MCP server | Claude reads/writes GitHub natively | `.claude/settings.json` |
| Claude Code Action v1 | `@claude` comments trigger agent | `claude /install-github-app` |
| Nx Cloud (free tier) | Remote caching, skip unchanged builds | `npx nx connect` |

### Planned (Set Up Before First App Code)

| Tool | Purpose | Cost |
|------|---------|------|
| Sweep AI | Auto-PR from labeled issues | Free ~5/month |
| Langfuse | Agent observability / trace logging | Free tier |
| Playwright MCP | Browser automation for agent UI verification | Free |
| EAS Build (Expo) | iOS/Android cloud builds | Free tier |

### Deferred (Phase 2+)

| Tool | Purpose | Trigger |
|------|---------|---------|
| Railway | BLE gateway daemon, background jobs | Phase 3 |
| Devin | Fully autonomous agent | When budget allows ($500/month) |
| Xcode Cloud | macOS widget CI | When Swift code exists |

### Rejected

| Tool | Reason |
|------|--------|
| Height | Shut down 2024 |
| Linear | No free tier; Nx Issues works for solo |
| Jenkins | Overkill; GitHub Actions covers everything |

---

## 12. Sources

### GitHub + Agent Workflow
- GitHub Docs — Projects v2 API: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- GitHub Docs — Issue Templates (YAML): https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
- GitHub MCP Server: https://github.com/github/github-mcp-server
- GitHub Blog — How to write a great AGENTS.md (2,500+ repo analysis): https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/
- GitHub Blog — WRAP framework: https://github.blog/ai-and-ml/github-copilot/wrap-up-your-backlog-with-github-copilot-coding-agent/
- GitHub Blog — Agentic Workflows (Feb 2026): https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/
- GitHub Blog — What's new with Copilot coding agent (Feb 2026): https://github.blog/ai-and-ml/github-copilot/whats-new-with-github-copilot-coding-agent/
- GitHub Blog — Playwright MCP: https://github.blog/ai-and-ml/github-copilot/how-to-debug-a-web-app-with-playwright-mcp-and-github-copilot/
- AGENTS.md open specification: https://agents.md/

### Claude Code
- Claude Code Docs: https://docs.anthropic.com/en/docs/claude-code/
- Claude Code GitHub Actions v1.0: https://code.claude.com/docs/en/github-actions
- Claude Code — CLAUDE.md: https://docs.anthropic.com/en/docs/claude-code/memory
- Claude Code — Skills: https://docs.anthropic.com/en/docs/claude-code/skills
- Claude Code — Subagents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- Claude Code — MCP: https://docs.anthropic.com/en/docs/claude-code/mcp

### Expert Practitioner Synthesis
- Boris Cherny (Claude Code creator) — Claude Code documentation and Anthropic engineering blog
- Andrej Karpathy — vibe coding: https://x.com/karpathy/status/1886192184808149193
- Simon Willison — LLM-assisted development: https://simonwillison.net
- swyx / Latent Space — AI Engineer patterns: https://www.latent.space
- Hamel Husain — evals: https://hamel.dev
- Ralph Loop (autonomous verification): https://github.com/frankbria/ralph-claude-code
- ATDD for Claude Code: https://github.com/swingerman/atdd

### CI/CD
- GitHub Actions documentation: https://docs.github.com/en/actions
- Nx affected documentation: https://nx.dev/nx-api/nx/documents/affected
- Cloudflare Pages GitHub Action: https://github.com/cloudflare/pages-action
- Fastlane documentation: https://fastlane.tools
