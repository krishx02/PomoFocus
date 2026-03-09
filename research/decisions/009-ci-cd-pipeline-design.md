# ADR-009: CI/CD Pipeline Design

**Status:** Accepted
**Date:** 2026-03-07
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container)
**Platforms:** All (iOS, Android, web, macOS widget, iOS widget, watchOS, VS Code extension, MCP server, Hono API, nRF52840 firmware)

## Context and Problem Statement

PomoFocus targets 9+ platforms from a single Nx monorepo. Each platform has a different build toolchain (Node.js, Xcode, PlatformIO), different deployment target (Vercel, Cloudflare Workers, App Store, Play Store, npm, VS Code Marketplace), and different CI requirements (Linux vs macOS runners). The question is how to structure GitHub Actions workflows to validate and deploy code across all platforms — as a solo developer with minimal setup cost, agent-first local development (Claude Code CLI on Max subscription), and an incremental buildup philosophy (don't configure CI for platforms that don't exist yet).

## Decision Drivers

- **Minimal setup cost** — fewest workflow files, fewest secrets, fastest to productive CI
- **Speed & parallelism** — PRs get fast feedback; Nx affected prevents redundant work
- **Agent compatibility** — CI works seamlessly with the `/ship-issue` → PR → merge workflow; agent work stays local on Max subscription
- **Incremental buildup** — only configure deploy workflows for platforms that have reached a deployable state
- **Cost** — zero/minimal CI costs for a solo developer; avoid expensive macOS runners where possible

## Considered Options

1. **Ultra-Minimal** — single `ci.yml` for TS lint/test; Vercel + EAS handle deploys natively; no deploy workflow files
2. **Platform-Separated** — one workflow file per platform from day one; full automation from merge to production; Claude Code Action for `@claude` mentions
3. **Hybrid Incremental** — shared `ci.yml` from day one; dormant deploy workflow templates with path filters; deploy workflows activate as each platform becomes shippable

## Decision Outcome

Chosen option: **"Hybrid Incremental"**, because it matches the project's current state (pre-code, no apps exist yet) while providing a clear path to full automation. A single `ci.yml` validates all TypeScript from day one. Deploy workflow templates are written now but remain dormant (path filters won't match until apps exist). This avoids premature configuration while preventing the "I'll forget to add CI" failure mode.

### Architecture Overview

**Phase 1 — Foundation (now):**
| Workflow | Purpose | Runner | Trigger |
|----------|---------|--------|---------|
| `ci.yml` | Nx affected lint + test + type-check + build | `ubuntu-latest` | PR to `main`, push to `main` |

- Vercel GitHub integration handles web preview deploys (zero config — no workflow file needed)
- Agent work (implementation) runs locally via Claude Code CLI (Max subscription)
- CI does dumb validation only — no AI, no API costs

**Phase 2 — Deploy workflows (when each app is shippable):**
| Workflow | Purpose | Runner | Trigger | Secrets Required |
|----------|---------|--------|---------|------------------|
| `deploy-api.yml` | Wrangler deploy to CF Workers | `ubuntu-latest` | Push to `main` (path: `apps/api/**`) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| `deploy-web.yml` | Vercel CLI deploy (if native integration insufficient) | `ubuntu-latest` | Push to `main` (path: `apps/web/**`) | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `mobile.yml` | EAS Build trigger (cloud builds, no macOS runner) | `ubuntu-latest` | Push to `main` (path: `apps/mobile/**`) | `EXPO_TOKEN` |
| `supabase.yml` | Migration validation + type drift detection | `ubuntu-latest` | PR (path: `supabase/**`) | None (uses local Supabase) |

**Phase 3 — Post-v1 platforms (when they exist):**
| Workflow | Purpose | Runner | Trigger |
|----------|---------|--------|---------|
| `vscode.yml` | Package + publish to VS Code Marketplace | `ubuntu-latest` | Push to `main` (path: `apps/vscode-extension/**`) |
| `mcp.yml` | Build + publish to npm | `ubuntu-latest` | Tag `mcp-server-v*` |
| `firmware.yml` | PlatformIO compile + test | `ubuntu-latest` | PR (path: `firmware/**`) |

**Deferred entirely:**
- Native Swift CI (macOS widget, iOS widget, watchOS) — build and test from Xcode locally. No GitHub Actions macOS runners. Revisit when native targets ship, potentially using Xcode Cloud (free with Apple Developer Program).
- Claude Code Action (`@claude` in PR comments) — requires Anthropic API key (pay-per-use), incompatible with Max subscription. Agent work stays local. Revisit if official Max OAuth support is added.

### Key Tooling Decisions

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Mobile builds | **Expo EAS Build** (not Fastlane) | EAS manages signing certs, provisioning profiles, and builds in the cloud. No macOS runner needed. Free tier: 15 iOS + 15 Android builds/month. |
| Web deploys | **Vercel GitHub integration** | Zero-config: connect repo, get preview deploys on every PR. No workflow file needed for Phase 1. |
| API deploys | **`cloudflare/wrangler-action@v3`** | Official action. Preview on PR, production on merge. |
| TS CI | **Nx affected** (`lint`, `test`, `type-check`, `build`) | Only runs tasks for packages changed by the PR. `actions/cache` for `.nx/cache`, or Nx Cloud (free for solo devs). |
| Change detection | **`dorny/paths-filter@v3`** or Nx affected | Path filters for deploy workflows; Nx affected for TS validation. |
| Success gate | **`ci-complete` job** with `if: always()` | Single required check in branch protection. Skipped platforms = passing. |
| Firmware CI | **PlatformIO** on `ubuntu-latest` | `pip install platformio` + `platformio run` + `platformio test`. No special hardware. |
| Agent CI | **None for now** | `/ship-issue` runs locally (Max subscription). Claude Code Action deferred. |

### Consequences

- **Good:** Minimal upfront config (1 workflow file). Zero CI cost for mobile builds (EAS free tier). No macOS runner costs. Agent work stays on subscription. Dormant templates prevent forgetting.
- **Bad:** No automated deploys until deploy workflows are activated. No `@claude` in PR comments (agent work is local-only). No CI safety net for native Swift targets.
- **Neutral:** Dormant workflow templates add files to `.github/workflows/` that won't trigger until apps exist. This is harmless but may look odd to someone browsing the repo.

## Pros and Cons of the Options

### Ultra-Minimal

- Good, because fewest files (1 workflow), fastest setup
- Good, because zero secrets needed initially
- Bad, because no deploy automation path — manual deploys forever unless you remember to add workflows
- Bad, because no dormant templates = high risk of "I'll forget"

### Platform-Separated

- Good, because full automation from day one — merge to `main` ships everywhere
- Good, because each platform's CI is independent and debuggable
- Bad, because 6+ workflow files before any app code exists — premature configuration
- Bad, because Claude Code Action requires API key ($) on top of Max subscription
- Bad, because ~18 secrets to configure upfront across all platforms

### Hybrid Incremental

- Good, because only configures what exists — no phantom workflows burning CI minutes
- Good, because `ci.yml` catches real bugs from day one (lint, test, type-check)
- Good, because dormant deploy templates are ready when needed — prevents forgetting
- Good, because EAS Build eliminates Fastlane complexity and macOS runner costs for mobile
- Bad, because manual deploys until each deploy workflow is activated
- Bad, because requires discipline to activate deploy workflows at the right time
- Bad, because no `@claude` in PR comments (but Claude Code CLI covers this locally)

## Research Sources

- [Expo EAS Build on CI](https://docs.expo.dev/build/building-on-ci/) — official docs for triggering EAS from GitHub Actions
- [Expo Pricing](https://expo.dev/pricing) — free tier: 15 iOS + 15 Android builds/month
- [expo/expo-github-action](https://github.com/expo/expo-github-action) — v8, uses `EXPO_TOKEN`
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions) — official docs; requires API key, no Max subscription support
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) — v1 GA
- [Nx CI with GitHub Actions](https://nx.dev/ci/intro/ci-with-github-actions) — affected commands, caching
- [dorny/paths-filter](https://github.com/dorny/paths-filter) — v3, path-based change detection
- [cloudflare/wrangler-action](https://github.com/cloudflare/wrangler-action) — v3, CF Workers deploy
- [ESP32 GitHub Actions Template](https://github.com/mcuw/ESP32-ghbuild-template) — PlatformIO CI pattern
- [GitHub Actions Monorepo CI/CD 2026](https://dev.to/pockit_tools/github-actions-in-2026-the-complete-guide-to-monorepo-cicd-and-self-hosted-runners-1jop) — current best practices

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — defines the package layout that `ci.yml` validates with Nx affected
- [ADR-007: API Architecture](./007-api-architecture.md) — Hono on CF Workers; `deploy-api.yml` uses `wrangler-action` to deploy
- [ADR-008: Long-Lived Processes](./008-long-lived-processes.md) — CF Workers + Cron Triggers only; no additional deploy targets needed
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — BLE syncs through phone; no cloud relay to deploy
- Testing Frameworks (technical-design-decisions.md) — Vitest for TS, Swift Testing for native, Playwright for E2E; `ci.yml` runs Vitest via Nx affected
