# PomoFocus Research — Agent-Optimized Dev Workflow

> **Purpose:** Set up the entire PomoFocus development workflow — optimized for AI agents to work as autonomously as possible — before writing any app code.
>
> **Context:** PomoFocus is a multi-platform Pomodoro productivity app targeting iOS, iOS home screen widget, Apple Watch (watchOS), macOS menu bar widget, Android, web, VS Code extension, Claude Code extension, and a physical BLE device. Cloud sync is a paid subscription feature. Stack: Supabase + Cloudflare + Supabase Auth + Nx monorepo + Vercel.

---

## Index

| File                                                                               | Title                                                 | TL;DR                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [01-agent-workflow-experts.md](./01-agent-workflow-experts.md)                     | AI-Assisted Development: Expert Synthesis             | Five universal patterns from Boris Cherny, Karpathy, Simon Willison, swyx, and others. CLAUDE.md is the single highest-leverage investment. Tests are the agent's feedback loop.                                                                                                                                                                       |
| [02-github-for-agents.md](./02-github-for-agents.md)                               | GitHub Issues & Projects for AI Agent Workflows       | How to write tickets that agents can execute without hand-holding. GitHub MCP server, Projects v2 API, issue templates, `ship-issue` skill, and label strategy. **Updated Mar 2026:** AGENTS.md convention, GitHub Agentic Workflows, WRAP framework, Claude Code Action v1.0 GA, Copilot coding agent updates, Playwright MCP, failure patterns.      |
| [03-github-actions-ci-cd.md](./03-github-actions-ci-cd.md)                         | GitHub Actions CI/CD for Multi-Platform Apps          | Full delivery surface (web, iOS, iOS widget, watchOS, Android, VS Code, Mac widget) from one monorepo. Claude Code Action for AI-assisted auto-fix loops. Cloudflare, App Store, and Play Store pipelines.                                                                                                                                             |
| [04-stack-recommendations.md](./04-stack-recommendations.md)                       | Tech Stack Recommendations 2025-2026                  | Supabase + Hono API on CF Workers + Supabase Auth + Expo + SwiftUI widget + Nx + Vercel + MCP server. MVP cost: $0/month. See [ADR-007](./decisions/007-api-architecture.md).                                                                                                                                                                          |
| [05-startups-and-oss-solving-this.md](./05-startups-and-oss-solving-this.md)       | Startups & OSS Solving Agent Dev Workflows            | Landscape of tools for "agent picks up Issue and ships PR." Aider + Sweep AI + OpenHands are the install-today picks. Devin is powerful but $500/month. Height is shut down.                                                                                                                                                                           |
| [06-product-research-methodology.md](./06-product-research-methodology.md)         | Product Research & Discovery Methodologies            | Survey of BMAD, GitHub Spec Kit, Osmani's spec-first approach, Shape Up, Torres' Continuous Discovery, Wondel.ai skills, and more. Recommends a `/discover` Claude Code skill for interactive product research.                                                                                                                                        |
| [07-design-decision-frameworks.md](./07-design-decision-frameworks.md)             | Technical Design Decision Frameworks                  | Synthesis of Google Design Docs (Malte Ubl), MADR 4.0, C4 Model (Simon Brown), Osmani's spec-first workflow, and Cherny's CLAUDE.md pattern. Informs the `/tech-design` skill for structured architecture decisions.                                                                                                                                   |
| [07-design-philosophy.md](./07-design-philosophy.md)                               | Design Philosophy — Grounded Principles for PomoFocus | Cross-disciplinary design philosophy synthesized from Ryo Lu, Dieter Rams, Naoto Fukasawa, Kenya Hara, Jasper Morrison, Jony Ive, Don Norman, Teenage Engineering, Playdate, and design movements (wabi-sabi, Shaker, Scandinavian, Calm Technology, quiet luxury). 10 principles + decision framework. Powers the `/design-review` skill.             |
| [08-testing-frameworks.md](./08-testing-frameworks.md)                             | Testing Framework Recommendations                     | Playwright (web E2E), Maestro (mobile E2E), @vscode/test-electron (VS Code), Swift Testing + XCTest (Apple), Vitest (all TypeScript). Expert-sourced from State of JS 2025, Expo docs, Apple WWDC 2024, ThoughtWorks Radar. Powers the `/pre-finalize` skill.                                                                                          |
| [09-obsidian-claude-code-integration.md](./09-obsidian-claude-code-integration.md) | Obsidian + Claude Code Integration Patterns           | Obsidian as persistent developer second brain. Direct filesystem access for daily journaling (no MCP needed for v1). `/done-for-the-day` skill auto-generates daily notes from GitHub issues and git history. Dataview queries for velocity tracking. Phased adoption: daily notes now, weekly rollups later, MCP server when semantic search matters. |

---

## Recommended Stack (Summary)

| Layer                | Choice                                                           | Why                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Database             | **Supabase** (Postgres + RLS)                                    | TypeScript SDK, self-hostable, row-level security                                                                                                                                    |
| API                  | **Hono on Cloudflare Workers** (REST + OpenAPI 3.1)              | Hides Supabase from clients, validates input, rate limits, generates TS + Swift clients. See [ADR-007](./decisions/007-api-architecture.md).                                         |
| Long-lived processes | **CF Workers + Cron Triggers** (v1); Railway deferred to post-v1 | BLE syncs through phone (ADR-006); Railway only if batch cross-user analytics at scale requires it (ADR-008)                                                                         |
| Web hosting          | **Vercel**                                                       | Next.js deployment                                                                                                                                                                   |
| Auth                 | **Supabase Auth** (sole provider, long-term)                     | Seamless RLS integration, zero cost at MVP scale. See [ADR-002](./decisions/002-auth-architecture.md).                                                                               |
| Mobile               | **Expo / React Native**                                          | Code sharing with web + VS Code, BLE via react-native-ble-plx                                                                                                                        |
| Mac widget           | **SwiftUI + WidgetKit + MenuBarExtra**                           | Only real option for a native menu bar widget                                                                                                                                        |
| iOS widget           | **SwiftUI + WidgetKit** (iOS 17+) via `@bacons/apple-targets`    | Home screen + Lock Screen. App Group UserDefaults for data sharing. `AppIntentConfiguration` for user-customizable stats. See [ADR-017](./decisions/017-ios-widget-architecture.md). |
| Apple Watch          | **SwiftUI + WatchKit** (watchOS 10+)                             | Companion app + Complications; `WKExtendedRuntimeSession` for background timer                                                                                                       |
| VS Code extension    | **VS Code Extension API** + shared `@pomofocus/core`             | WebView renders same React UI as web                                                                                                                                                 |
| BLE                  | **react-native-ble-plx** + Web Bluetooth                         | Platform-appropriate, mature libraries                                                                                                                                               |
| Monorepo             | **Nx + pnpm**                                                    | Generators, affected detection, prior experience                                                                                                                                     |
| Claude Code ext      | **MCP Server**                                                   | Official extension mechanism for Claude Code                                                                                                                                         |

---

## Recommended Agent Workflow (Summary)

```
GitHub Issues (labeled "agent-ready")
         ↓ (webhook or manual /ship-issue N)
Claude Code reads issue via GitHub MCP server
         ↓
Creates feature branch, enters plan mode
         ↓
Implements, runs tests, fixes failures
         ↓
Opens PR — "Closes #N"
         ↓
GitHub Actions: lint + test + deploy to preview
         ↓
Human reviews and merges
```

**Install-today tools to augment this:**

- [Sweep AI](https://sweep.dev) — GitHub App that turns labeled issues into draft PRs automatically (free for ~5/month)
- [Aider](https://aider.chat) — CLI pair programmer, deeply git-integrated, pennies per task
- [OpenHands](https://github.com/All-Hands-AI/OpenHands) — open-source full agent, self-hostable
- [Langfuse](https://langfuse.com) — free LLM observability (deferred until MCP server is built — see [ADR-011](./decisions/011-monitoring-observability.md))

---

## Key Patterns (Cross-File Synthesis)

### 1. CLAUDE.md is the highest-leverage file you will write

Every expert (Cherny, Willison, swyx, Karpathy) and every tool (Sweep, Aider, OpenHands) depends on some form of persistent project context. Write a CLAUDE.md that covers:

- Tech stack with version constraints
- Critical commands (build, test, lint, dev)
- Filesystem conventions
- Rules the agent MUST follow
- What to do when uncertain (stop and ask)

### 2. Agent-ready issues ≠ human-readable issues

An issue an agent can pick up must have: a verifiable goal, exact file paths, checkboxable acceptance criteria, an "out of scope" list, and the exact test command to run. See `02-github-for-agents.md` for templates.

### 3. Tests first, always

Without tests, agents cannot self-correct. Every agent workflow breaks down on codebases without tests. Establish a test baseline before writing app code.

### 4. Task size is the critical variable

Tasks that succeed: 1-3 sentence description, clear completion criterion, < 10 files touched, fits in one context window. Split features into data layer → business logic → UI — never combine in one ticket.

### 5. Platform-specific agents reduce accidents

Create separate agent configurations (`.claude/agents/`) for iOS, Android, shared TypeScript, and web — each scoped to its platform and knowing which tests to run.

---

## What to Do First (Implementation Order)

1. **Write `CLAUDE.md`** at repo root — this is the briefing document for every agent session
2. **Create GitHub Issue templates** (`.github/ISSUE_TEMPLATE/feature-agent.yml`) so every ticket is agent-ready by default
3. **Set up GitHub Projects v2** with 5 columns: Backlog → Agent-Ready → In Progress → In Review → Done
4. **Create the `/ship-issue` skill** (`.claude/skills/ship-issue/SKILL.md`) for one-command issue pickup
5. **Install GitHub MCP server** in `.claude/settings.json`
6. **Add Sweep AI** as a GitHub App for automatic issue → PR on labeled tickets
7. **Set up GitHub Actions** for CI (lint + test + deploy to preview per platform)
8. **Add Langfuse** for agent run observability (deferred — see [ADR-011](./decisions/011-monitoring-observability.md))
9. **Then write code** — every ticket picked up by an agent

---

## Research Notes

- All research synthesized from training knowledge through August 2025 (web search unavailable during generation)
- Source links in each file point to real, known URLs — cross-check before citing as current
- Stack recommendations reflect community consensus as of early 2026
- Pricing data (Sweep, Devin, E2B, Linear) should be verified before budget decisions
