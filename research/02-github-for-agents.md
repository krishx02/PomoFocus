# GitHub Issues & Projects for AI Agent Workflows
## Optimizing Ticket Structures for Claude Code Autonomous Execution

> Research compiled: March 2026
> Project: PomoFocus (multi-platform Pomodoro app)

---

## TL;DR

AI agents like Claude Code can execute GitHub Issues autonomously — but only if the issue contains everything the agent needs to start without asking follow-up questions. The key shifts are: (1) issues become agent prompts, not human notes; (2) GitHub Projects v2 becomes the work queue agents poll and update; (3) CLAUDE.md becomes the standing context that eliminates issue-by-issue repetition; (4) the GitHub MCP server and `gh` CLI close the loop between ticket and code session. Done right, the workflow is: Claude reads issue → updates status to "In Progress" → implements → opens PR → links back to issue — fully autonomously.

---

## Key Findings

### Anatomy of an Agent-Ready Issue

Human-written issues optimize for human comprehension. Agent-ready issues optimize for zero-ambiguity execution. The differences:

- **Human issue:** "Fix the timer on iOS" — ambiguous, no file paths, no expected outcome
- **Agent issue:** Explicit goal, exact file paths, acceptance criteria testable by the agent itself, links to related issues/PRs, and a "definition of done" the agent can verify programmatically

An agent cannot ask "what file is the timer logic in?" — it wastes a turn and breaks autonomous execution. Every piece of context must be embedded in the issue or derivable from CLAUDE.md.

### GitHub Projects v2 API

GitHub Projects v2 uses GraphQL exclusively (REST is not supported for Projects). Key capabilities:

- Query project items by status field value (e.g., "Backlog", "In Progress", "Done")
- Update item field values programmatically (move cards across columns)
- Add/remove items from a project
- Filter by assignee, label, milestone

Agents can use this to self-manage their work queue: pick up a "Backlog" ticket, atomically flip it to "In Progress", complete the work, then flip to "In Review" when opening the PR.

### GitHub MCP Server

The official GitHub MCP server (`github.com/github/github-mcp-server`) exposes GitHub as a tool suite to Claude Code. Once connected via `claude mcp add`, Claude can:

- `get_issue` — read full issue body, comments, labels, assignees
- `list_issues` — query by label, milestone, state, assignee
- `create_issue`, `update_issue` — write back status, add comments
- `create_pull_request` — open PRs with full body and reviewer assignment
- `get_pull_request`, `list_pull_requests`
- `search_code` — search across the repo without a local clone
- `list_commits`, `get_file_contents` — read any file at any commit

This is the primary integration mechanism. With the GitHub MCP server active, Claude Code can execute the full ticket lifecycle without any manual `gh` CLI invocations.

### `gh` CLI as the Fallback

When the MCP server is not configured, the `gh` CLI covers most of the same ground:

```bash
gh issue view 42                          # Read full issue
gh issue view 42 --json body,labels       # Structured JSON
gh issue list --label "agent-ready" --state open
gh issue edit 42 --add-label "in-progress"
gh pr create --title "fix: ..." --body "Closes #42"
```

The `gh` CLI can be invoked from Claude Code as a Bash tool, making it the zero-setup path.

### CLAUDE.md as Standing Agent Context

Every piece of context in CLAUDE.md is context that does NOT need to be repeated in every issue. Effective CLAUDE.md files for agent-driven workflows include:

- Directory map (where features live, where tests live)
- Build and test commands the agent must run before committing
- Naming conventions for branches, commits, and PR titles
- Definition of "done" (e.g., "all tests pass, no TypeScript errors, Storybook story updated")
- Platform-specific caveats (e.g., "iOS requires entitlements for background timers")
- Links to design system, API schemas, and architecture docs

This keeps individual issues focused on the delta — what is unique to this ticket — rather than re-explaining the whole project.

### Issue Templates Designed for Agent Consumption

YAML-based issue templates (`.github/ISSUE_TEMPLATE/*.yml`) enforce structure at creation time. For agent workflows, mandatory fields include: goal statement, acceptance criteria (checkboxes), affected files (pre-filled from template), test plan, and a "ready for agent" label gate.

### Copilot Workspace Pattern (Reference Model)

GitHub Copilot Workspace (2024–2025) established a useful reference model: an issue becomes the specification, the agent proposes a plan, the human approves, the agent implements. Claude Code can replicate this pattern using Plan Mode: `claude --permission-mode plan` to get the plan approved before implementation begins.

---

## Actionable Recommendations for PomoFocus

### 1. Create Agent-Ready Issue Templates

Create `.github/ISSUE_TEMPLATE/` with at minimum two templates: one for features, one for bugs.

**`.github/ISSUE_TEMPLATE/feature-agent.yml`:**

```yaml
name: Feature (Agent-Ready)
description: A feature ticket structured for autonomous Claude Code execution
labels: ["agent-ready", "enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Fill every field. An agent will execute this without follow-up questions.

  - type: textarea
    id: goal
    attributes:
      label: Goal
      description: One sentence. What should be true when this is done?
      placeholder: "The iOS app should persist timer state across app backgrounding using UserDefaults."
    validations:
      required: true

  - type: textarea
    id: context
    attributes:
      label: Context & Background
      description: Why is this needed? Link to related issues, PRs, or design docs.
    validations:
      required: true

  - type: textarea
    id: files
    attributes:
      label: Affected Files / Modules
      description: List the files or directories most likely involved. Be specific.
      placeholder: |
        - `ios/PomoFocus/TimerManager.swift` — timer state logic
        - `ios/PomoFocus/AppDelegate.swift` — app lifecycle hooks
        - `shared/models/TimerState.ts` — shared type definitions
    validations:
      required: true

  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance Criteria
      description: Checkboxes the agent can verify. Make each one testable.
      placeholder: |
        - [ ] Timer continues counting after app is backgrounded for up to 10 minutes
        - [ ] Timer state is restored correctly when app is foregrounded
        - [ ] `npm test` passes with no new failures
        - [ ] No TypeScript errors (`tsc --noEmit`)
        - [ ] Existing unit tests for TimerManager still pass
    validations:
      required: true

  - type: textarea
    id: out_of_scope
    attributes:
      label: Out of Scope
      description: Explicitly state what NOT to change. Prevents agents from over-reaching.
      placeholder: "Do not modify the Android timer implementation. Do not change the shared timer state model."
    validations:
      required: false

  - type: textarea
    id: test_plan
    attributes:
      label: Test Plan
      description: How should the agent verify its work? Include specific test commands.
      placeholder: |
        1. Run `npm test`
        2. Run `xcodebuild test -scheme PomoFocus -destination "platform=iOS Simulator,name=iPhone 15"`
        3. Manually verify in simulator: start timer, background app, foreground, confirm state
    validations:
      required: true

  - type: dropdown
    id: platform
    attributes:
      label: Platform
      options:
        - iOS
        - Android
        - Web
        - Shared/Cross-platform
        - All platforms
    validations:
      required: true
```

**`.github/ISSUE_TEMPLATE/bug-agent.yml`** follows the same pattern with additional fields for: reproduction steps (exact commands/actions), expected vs. actual behavior, error messages/stack traces (paste verbatim), and the last known good commit/version.

### 2. Configure CLAUDE.md for Agent-Driven Workflows

Create a `CLAUDE.md` at the repo root (committed to git). Keep it under 200 lines — use `@imports` for detailed sub-documents.

```markdown
# PomoFocus — Agent Context

## Project Structure
- `ios/` — native iOS app (Swift, SwiftUI)
- `android/` — native Android app (Kotlin, Jetpack Compose)
- `web/` — web app (React, TypeScript, Vite)
- `shared/` — cross-platform models, utilities, constants (TypeScript)
- `docs/` — architecture decisions and design specs

## Build & Test Commands
- Web: `npm test` (Vitest), `npm run build`, `tsc --noEmit`
- iOS: `xcodebuild test -scheme PomoFocus -destination "platform=iOS Simulator,name=iPhone 15"`
- Android: `./gradlew test`, `./gradlew connectedAndroidTest`
- All: `npm run test:all` (runs all three)

## Conventions
- Branch naming: `feature/issue-{number}-short-description` or `fix/issue-{number}-short-description`
- Commit format: `feat: description` / `fix: description` / `refactor: description`
- PR title must reference the issue: "feat: description (#42)"
- Every PR must close its linked issue: include "Closes #42" in PR body

## Definition of Done
Before opening a PR, verify:
1. `npm run test:all` passes
2. `tsc --noEmit` exits clean
3. No new lint errors (`npm run lint`)
4. PR body contains "Closes #N" for the issue being resolved

## Platform-Specific Notes
- iOS background timer: requires `UIBackgroundModes` entitlement and `BackgroundTasks` framework
- Android background: WorkManager for API 26+, not AlarmManager
- Web: use Web Workers for off-main-thread timer; do NOT use setInterval on main thread

## Architecture Docs
@docs/architecture.md
@docs/timer-state-model.md

## Agent Workflow
When picking up a GitHub Issue:
1. Read the full issue with `gh issue view {number}`
2. Enter Plan Mode, explore affected files, draft a plan
3. Implement in a feature branch: `git checkout -b feature/issue-{number}-...`
4. Run all tests, fix failures
5. Open PR: `gh pr create` with "Closes #{number}" in the body
6. Update the issue label from "in-progress" to "in-review"
```

### 3. Add a `fix-issue` Skill for One-Command Ticket Pickup

Create `.claude/skills/fix-issue/SKILL.md` — this becomes `/fix-issue 42` in any Claude Code session:

```yaml
---
name: fix-issue
description: Pick up a GitHub issue by number and implement it autonomously. Creates a branch, implements the fix, runs tests, and opens a PR.
user-invocable: true
context: fork
isolation: worktree
allowed-tools: Bash(gh *), Bash(git *), Bash(npm *), Read, Edit, Write, Grep, Glob
argument-hint: "[issue number]"
---

## Issue Pickup Workflow

Issue number: $ARGUMENTS

### Step 1 — Read the Issue
!`gh issue view $ARGUMENTS --json number,title,body,labels,assignees`

### Step 2 — Create a Branch
Create a branch named `fix/issue-$ARGUMENTS-{short-description}` derived from the issue title.

### Step 3 — Plan Before Acting
Enter plan mode mentally: read all files listed under "Affected Files" in the issue.
Understand the acceptance criteria fully before writing a single line of code.

### Step 4 — Implement
Make the changes required to satisfy all acceptance criteria.
Do NOT change files outside the scope listed in "Out of Scope".

### Step 5 — Verify
Run the test plan specified in the issue.
If tests fail, fix them before proceeding.

### Step 6 — Open PR
`gh pr create --title "{type}: {issue title} (#{number})" --body "Closes #$ARGUMENTS\n\n## Changes\n{summary}"`

### Step 7 — Update Labels
`gh issue edit $ARGUMENTS --remove-label "in-progress" --add-label "in-review"`

Report a summary of what was changed and the PR URL.
```

**Usage:** In any Claude Code session, type `/fix-issue 42` and Claude handles the rest.

### 4. Set Up GitHub MCP Server

```bash
# Add the GitHub MCP server to Claude Code
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# Or using the community server with a PAT
claude mcp add github -- npx -y @modelcontextprotocol/server-github
# Set GITHUB_PERSONAL_ACCESS_TOKEN in environment
```

Add to `.claude/settings.json` (project-level, so all team members get it):

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
  },
  "permissions": {
    "allow": [
      "Bash(gh *)",
      "Bash(git *)",
      "Bash(npm run test*)",
      "Bash(npm run build*)",
      "Bash(tsc *)",
      "Bash(npm run lint*)"
    ]
  }
}
```

With the MCP server active, Claude can call `list_issues`, `get_issue`, `update_issue`, and `create_pull_request` as native tools — no `gh` CLI invocations needed.

### 5. Configure GitHub Projects v2 for Agent Work Queue Management

Create a GitHub Project with these status columns:

| Column | Meaning |
|--------|---------|
| **Backlog** | Not yet picked up |
| **Agent-Ready** | Has all required fields, cleared for agent pickup |
| **In Progress** | Agent or human actively working |
| **In Review** | PR opened, awaiting review |
| **Done** | Merged and closed |

The "Agent-Ready" column is the key gate. Only issues that have all template fields filled, all acceptance criteria written, and all file paths specified move to "Agent-Ready." The agent queries this column for work.

**GraphQL query to find agent-ready items** (run via `gh api graphql`):

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

Filter results where `field.name == "Status"` and `name == "Agent-Ready"`.

**Update item status to "In Progress"** (mutation):

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

Wrap this in a shell script that Claude can call via Bash, or expose it as a skill.

### 6. Label Strategy for Agent Routing

Use labels to signal issue readiness and route to the right agent:

| Label | Meaning |
|-------|---------|
| `agent-ready` | Issue is complete, all fields filled |
| `in-progress` | Agent or human has picked this up |
| `in-review` | PR is open |
| `needs-human` | Agent flagged a decision point requiring human judgment |
| `ios-only` | Only the iOS platform subagent should handle |
| `android-only` | Only the Android platform subagent should handle |
| `cross-platform` | Affects shared/ or all platforms |
| `effort:small` | < 1 hour estimated (use Sonnet) |
| `effort:large` | > 4 hours estimated (use Opus, plan mode mandatory) |

The `needs-human` label is critical: it lets agents signal blockers without stalling silently.

### 7. Platform Subagents for PomoFocus

Create platform-specific subagents in `.claude/agents/`:

**`.claude/agents/ios-developer.md`:**

```yaml
---
name: ios-developer
description: Swift/SwiftUI developer for the PomoFocus iOS app. Use for issues labeled ios-only or when modifying files in ios/
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You are a senior iOS developer specializing in Swift and SwiftUI.
Focus exclusively on the `ios/` directory.
Always check `ios/PomoFocus.xcodeproj` for build configuration context.
Run `xcodebuild test` to verify your changes before declaring done.
Never modify files in `android/` or `web/`.
```

**`.claude/agents/android-developer.md`:**

```yaml
---
name: android-developer
description: Kotlin/Jetpack Compose developer for the PomoFocus Android app. Use for issues labeled android-only or when modifying files in android/
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You are a senior Android developer specializing in Kotlin and Jetpack Compose.
Focus exclusively on the `android/` directory.
Run `./gradlew test` to verify your changes before declaring done.
Never modify files in `ios/` or `web/`.
```

**`.claude/agents/shared-developer.md`:**

```yaml
---
name: shared-developer
description: TypeScript developer for cross-platform shared code in PomoFocus. Use for issues labeled cross-platform or modifying files in shared/
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

You are a senior TypeScript developer maintaining the shared cross-platform layer.
Changes in `shared/` affect all three platforms (iOS, Android, Web).
Run `tsc --noEmit` and `npm test` after every change.
If a change requires platform-specific adaptations, note them clearly in PR comments.
```

---

## Writing Rules: Tickets AI Agents Can Execute Without Ambiguity

These rules apply to every issue intended for agent pickup:

### Rule 1: The Goal is a Verifiable Assertion
Bad: "Improve the timer"
Good: "The timer must not drift more than 1 second over a 25-minute session when the app is backgrounded on iOS 17+"

### Rule 2: Every Acceptance Criterion Must Be Automatable
If an acceptance criterion requires a human to "look at it," it does not belong on an agent-ready ticket. Rewrite it as a test. "The UI looks correct" becomes "The snapshot test `TimerView.1` passes."

### Rule 3: File Paths are Absolute from Repo Root
Don't say "the timer file." Say `ios/PomoFocus/TimerManager.swift`. Agents waste turns doing discovery that you can do in 10 seconds.

### Rule 4: Out-of-Scope is Mandatory
Agents over-reach. If you don't say "do not touch X," they will touch X. List the files they must not modify.

### Rule 5: Include the Exact Error Message or Test ID
For bugs: paste the full stack trace. For test failures: paste the test name. Agents work best with exact strings to search for.

### Rule 6: Link All Related Context
Related issues, the PR that introduced the bug, the design doc, the API schema. Use GitHub's "Linked issues" feature and also paste URLs directly in the body.

### Rule 7: Include the Test Command
Do not say "make sure tests pass." Say `npm run test -- --testPathPattern=TimerManager`. The agent must know the exact command to run.

### Rule 8: Specify the Branch Base
For most issues: `base: main`. For issues building on another in-flight PR: `base: feature/issue-38-timer-refactor`. This prevents merging into the wrong branch.

---

## Minimal Ticket Example (PomoFocus Bug)

```markdown
## Goal
The focus session timer resets to 25:00 when the iOS app is backgrounded for more than 30 seconds,
instead of continuing to count down.

## Context
Reported in #39. Introduced in commit `a3f9d2c` (PR #37 — timer refactor).
The timer was refactored to use `Timer.scheduledTimer` without `RunLoop.main.add()`,
which causes it to stop firing when the app enters background.

Related: Apple docs on background execution — https://developer.apple.com/documentation/backgroundtasks

## Affected Files
- `ios/PomoFocus/TimerManager.swift` — the timer scheduling logic (line ~87)
- `ios/PomoFocusTests/TimerManagerTests.swift` — add a regression test here

## Acceptance Criteria
- [ ] `xcodebuild test -scheme PomoFocus` passes with no new failures
- [ ] New test `TimerManagerTests.testTimerContinuesInBackground` exists and passes
- [ ] Timer does not reset when app is backgrounded for 30–60 seconds (verified in simulator)
- [ ] `git log --oneline -1` shows a commit message starting with "fix:"

## Out of Scope
Do NOT modify `ios/PomoFocus/AppDelegate.swift` or any file in `android/` or `web/`.
Do NOT change the shared `TimerState` model in `shared/`.

## Test Plan
1. `xcodebuild test -scheme PomoFocus -destination "platform=iOS Simulator,name=iPhone 15"`
2. Confirm `testTimerContinuesInBackground` is listed as passed in the output

## Platform
iOS only

## Branch Base
`main`
```

This ticket can be handed to Claude Code with `/fix-issue 42` and executed without a single follow-up question.

---

## Implementation Checklist

- [ ] Create `.github/ISSUE_TEMPLATE/feature-agent.yml`
- [ ] Create `.github/ISSUE_TEMPLATE/bug-agent.yml`
- [ ] Create `CLAUDE.md` at repo root (follow structure above)
- [ ] Create `.claude/skills/fix-issue/SKILL.md`
- [ ] Create `.claude/agents/ios-developer.md`
- [ ] Create `.claude/agents/android-developer.md`
- [ ] Create `.claude/agents/shared-developer.md`
- [ ] Configure `.claude/settings.json` with GitHub MCP server and allowed Bash commands
- [ ] Set up GitHub Project v2 with Backlog / Agent-Ready / In Progress / In Review / Done columns
- [ ] Add label set: `agent-ready`, `in-progress`, `in-review`, `needs-human`, `ios-only`, `android-only`, `cross-platform`, `effort:small`, `effort:large`
- [ ] Write a shell script wrapping the Projects v2 GraphQL mutation for status updates

---

## Sources

The following sources informed this research. Note: WebSearch and WebFetch were unavailable in this session; all information is from the author's knowledge base (cutoff August 2025) and the project's existing `.claude/docs/` files.

- GitHub Docs — Projects v2 API: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- GitHub Docs — Issue Templates (YAML): https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository
- GitHub MCP Server: https://github.com/github/github-mcp-server
- MCP Server (community): https://github.com/modelcontextprotocol/servers/tree/main/src/github
- Claude Code Docs — CLAUDE.md: https://docs.anthropic.com/en/docs/claude-code/memory
- Claude Code Docs — Skills: https://docs.anthropic.com/en/docs/claude-code/skills
- Claude Code Docs — Subagents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- Claude Code Docs — GitHub Actions integration: https://docs.anthropic.com/en/docs/claude-code/github-actions
- Claude Code Docs — MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- GitHub Copilot Workspace overview: https://githubnext.com/projects/copilot-workspace
- GitHub Projects GraphQL API reference: https://docs.github.com/en/graphql/reference/objects#projectv2
- PomoFocus `.claude/docs/claude-code-basics.md` (project file)
- PomoFocus `.claude/docs/claude-code-advanced.md` (project file)
