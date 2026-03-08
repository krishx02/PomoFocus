# AGENTS.md — PomoFocus

> Cross-agent context file. Compatible with Claude Code, GitHub Copilot, Cursor, VS Code, and any agent supporting the AGENTS.md open standard (agents.md).
>
> For Claude-specific rules, see CLAUDE.md. For the full agent workflow reference, see GitHub-Agents.md.

---

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (affected only)
pnpm nx affected --target=build --base=origin/main --head=HEAD

# Run all tests (affected only)
pnpm nx affected --target=test --base=origin/main --head=HEAD

# Run tests for a specific package
pnpm nx test @pomofocus/core
pnpm nx test @pomofocus/web
pnpm nx test @pomofocus/mobile
pnpm nx test @pomofocus/vscode-extension
pnpm nx test @pomofocus/mcp-server

# Type-check all packages
pnpm type-check

# Lint all packages (affected only)
pnpm nx affected --target=lint --base=origin/main --head=HEAD

# Run the web dev server
pnpm nx dev @pomofocus/web

# macOS menu bar widget (Swift — outside Nx)
xcodebuild test -scheme PomoFocusMac -destination "platform=macOS"
# iOS home screen widget
xcodebuild test -scheme PomoFocusiOSWidget -destination "platform=iOS Simulator,name=iPhone 16,OS=latest"
# Apple Watch app
xcodebuild test -scheme PomoFocusWatch -destination "platform=watchOS Simulator,name=Apple Watch Series 10 - 46mm,OS=latest"
```

---

## Monorepo Structure

```
pomofocus/
├── apps/
│   ├── web/                  # Next.js web app → Vercel
│   ├── mobile/               # Expo (iOS + Android) → EAS Build
│   ├── vscode-extension/     # VS Code Extension API
│   ├── mcp-server/           # Claude Code MCP server → npm
│   └── ble-gateway/          # BLE/MQTT gateway (Phase 3, Railway)
├── packages/
│   ├── types/                # Auto-generated TS types from Postgres schema
│   ├── core/                 # Pure domain logic (timer, goals, sessions) — 100% tested
│   ├── analytics/            # Focus Score and insights
│   ├── data-access/          # All Supabase interaction (queries, auth, sync)
│   ├── state/                # Zustand stores + TanStack Query hooks
│   ├── ui/                   # Shared React/RN components
│   └── ble-protocol/         # BLE GATT profile (types from Protobuf)
├── native/
│   └── apple/                # SwiftUI Xcode workspace (outside Nx)
│       ├── mac-widget/       # macOS menu bar target (MenuBarExtra + WidgetKit)
│       ├── ios-widget/       # iOS home screen widget target (WidgetKit, iOS 17+)
│       └── watchos-app/      # Apple Watch app target (SwiftUI, watchOS 10+)
├── .github/
│   ├── ISSUE_TEMPLATE/       # Agent-ready issue templates (feature + bug)
│   └── workflows/            # CI/CD (Nx affected + platform-specific)
├── .claude/
│   ├── agents/               # Platform subagent definitions
│   ├── skills/               # /ship-issue, /decompose-issue, /clarify
│   ├── hooks/                # UserPromptSubmit ambiguity check
│   └── specs/                # Written specs from /clarify sessions
├── AGENTS.md                 # This file — cross-agent context
├── CLAUDE.md                 # Claude-specific rules
└── GitHub-Agents.md          # Full agent workflow reference
```

---

## Tech Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Language | TypeScript | 5.x — no JS files |
| Monorepo | Nx + pnpm | Nx 19+, pnpm 9+ |
| Database | Supabase (Postgres + RLS + Realtime) | Latest |
| Sync/Edge | Cloudflare Workers + Durable Objects | Latest |
| Web hosting | Vercel | Latest |
| Auth | Supabase Auth | Latest |
| Mobile | Expo / React Native | SDK 51+ |
| Mac widget | SwiftUI + WidgetKit + MenuBarExtra | macOS 13+ |
| iOS widget | SwiftUI + WidgetKit | iOS 17+ |
| Apple Watch | SwiftUI + WatchKit | watchOS 10+ |
| VS Code extension | VS Code Extension API | Latest |
| BLE | react-native-ble-plx + Web Bluetooth | Latest |
| Test (TS) | Vitest | Latest |
| Test (Swift) | XCTest | Latest |
| Lint | ESLint + Prettier | Latest |

---

## Code Style

```typescript
// ✅ Use const for immutable values
const SESSION_DURATION_MS = 25 * 60 * 1000;

// ✅ Explicit return types on public functions
function startTimer(state: TimerState): TimerState { ... }

// ✅ Named exports over default exports
export { TimerMachine, TimerState };

// ❌ No 'any' type
const data: any = ...; // NEVER

// ❌ No var
var count = 0; // NEVER

// ❌ No implicit returns from async functions without await
async function doThing() { return fetch(...); } // use await

// ✅ Tests must be able to fail — verify by temporarily breaking code under test
```

---

## Branch & Commit Conventions

```
Branch:  feature/issue-{number}-{short-slug}
         fix/issue-{number}-{short-slug}

Commit:  feat: description
         fix: description
         refactor: description
         test: description
         docs: description

PR title: feat: description (#42)
PR body must include: Closes #42
```

---

## Boundaries

**Always do:**
- Run `pnpm nx affected --target=test` before opening any PR
- Run `pnpm type-check` before opening any PR
- Include "Closes #N" in every PR body
- Create a branch for every change — never commit directly to `main`
- Read the issue's "Affected Files" and "Out of Scope" sections before touching anything
- Add a test for every new piece of business logic

**Ask first:**
- Before modifying `package.json` or adding new dependencies
- Before touching authentication code in `packages/data-access/`
- Before changing any TypeScript interfaces in `packages/types/`
- Before any database migration or schema change
- If the task would touch more than 10 files
- If the acceptance criteria are ambiguous

**Never do:**
- Commit secrets, API keys, or tokens
- Commit directly to `main` or `develop`
- Modify files outside the platform scope listed in your current issue
- Skip running tests before opening a PR
- Use `git push --force` or `git reset --hard` without explicit user confirmation
- Add `any` type to TypeScript code
- Modify `*.generated.ts` files — these are auto-generated
- Touch production database migrations without a dry-run step

---

## Workflow Summary

1. Pick up a GitHub Issue labeled `agent-ready` (or run `/ship-issue N`)
2. If labeled `effort:large` → run `/decompose-issue N` instead, stop
3. Create branch: `feature/issue-N-<slug>`
4. Read all files in the issue's "Affected Files" section
5. Implement to satisfy acceptance criteria — respect "Out of Scope"
6. Run tests — fix failures — repeat until all pass
7. Open PR with "Closes #N" in body
8. Update labels: `in-progress` → `in-review`

Full details: see **GitHub-Agents.md**.
