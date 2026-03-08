# Design: CI/CD Pipeline

**Date:** 2026-03-07
**Status:** Accepted
**Related ADR:** [ADR-009](../decisions/009-ci-cd-pipeline-design.md)
**Platforms:** All (incrementally)

## Context & Scope

PomoFocus is a multi-platform Nx monorepo targeting 9+ platforms with different build toolchains and deployment targets. As a solo developer using Claude Code CLI locally (Max subscription) for implementation, CI/CD needs to be lightweight, cost-effective, and incrementally expandable. The core challenge is designing a workflow structure that validates all TypeScript from day one, supports automated deploys per-platform when each app becomes shippable, and avoids premature configuration or expensive macOS runners.

## Goals & Non-Goals

**Goals:**
- Validate all TypeScript packages on every PR (lint, test, type-check, build) via Nx affected
- Provide a clear, documented path from "no deploy automation" to "full deploy automation" per platform
- Keep CI costs at zero or near-zero for a solo developer
- Support the `/ship-issue` → PR → merge agent workflow without requiring Claude Code Action (API costs)

**Non-Goals:**
- Full deploy automation from day one (incremental buildup)
- Claude Code Action in CI (agent work stays local on Max subscription)
- Native Swift CI via GitHub Actions macOS runners (build locally from Xcode)
- Firmware OTA update pipeline (deferred until device exists)
- Multi-environment deploys (staging/production) — single environment for v1

## The Design

### Workflow Architecture

```
.github/workflows/
├── ci.yml                 # Phase 1: Active from day one
├── deploy-api.yml         # Phase 2: Dormant until apps/api/ exists
├── deploy-web.yml         # Phase 2: Dormant until apps/web/ needs CLI deploy
├── mobile.yml             # Phase 2: Dormant until apps/mobile/ exists
├── supabase.yml           # Phase 2: Dormant until supabase/ migrations exist
├── vscode.yml             # Phase 3: Dormant until apps/vscode-extension/ exists
├── mcp.yml                # Phase 3: Dormant until apps/mcp-server/ exists
└── firmware.yml           # Phase 3: Dormant until firmware/ exists
```

"Dormant" means the workflow file exists with path filters, but those paths don't contain code yet — so the workflow never triggers. When you create `apps/api/src/index.ts`, the `deploy-api.yml` workflow automatically starts running.

### ci.yml — The Foundation

This is the only workflow that matters from day one. It runs on every PR and every push to `main`.

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # Full history for Nx affected

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint affected
        run: pnpm nx affected --target=lint --base=origin/main --head=HEAD

      - name: Test affected
        run: pnpm nx affected --target=test --base=origin/main --head=HEAD

      - name: Type-check affected
        run: pnpm nx affected --target=type-check --base=origin/main --head=HEAD

      - name: Build affected
        run: pnpm nx affected --target=build --base=origin/main --head=HEAD

      # Nx computation cache
      - uses: actions/cache@v4
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ github.sha }}
          restore-keys: nx-${{ runner.os }}-

  ci-complete:
    name: CI Complete
    needs: [lint-test-build]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check results
        run: |
          if [[ "${{ needs.lint-test-build.result }}" == "failure" || \
                "${{ needs.lint-test-build.result }}" == "cancelled" ]]; then
            echo "CI failed"
            exit 1
          fi
          echo "CI passed"
```

**Branch protection:** Set "CI Complete" as the single required check.

### Deploy Workflows (Dormant Templates)

Each deploy workflow follows the same pattern:
1. Path filter on the relevant app directory + shared packages
2. Build step
3. Deploy step (preview on PR, production on push to `main`)

#### deploy-api.yml

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'packages/core/**', 'packages/types/**']
  pull_request:
    paths: ['apps/api/**', 'packages/core/**', 'packages/types/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm nx run api:build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/api
          command: deploy --env ${{ github.ref == 'refs/heads/main' && 'production' || 'preview' }}
```

#### mobile.yml

```yaml
name: Mobile Build

on:
  push:
    branches: [main]
    paths: ['apps/mobile/**', 'packages/**']
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform (ios|android|all)'
        required: true
        default: all

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: pnpm/action-setup@v4

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - run: pnpm install --frozen-lockfile
        working-directory: apps/mobile

      - name: Build on EAS
        run: eas build --platform ${{ github.event.inputs.platform || 'all' }} --non-interactive --no-wait
        working-directory: apps/mobile
```

Key: `--no-wait` exits immediately after triggering the build on Expo's servers. GitHub Actions doesn't sit idle waiting for the build — EAS handles it in the cloud.

#### supabase.yml

```yaml
name: Supabase Validation

on:
  pull_request:
    paths: ['supabase/**', 'packages/types/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start local Supabase
        run: supabase start --ignore-health-check

      - name: Apply migrations
        run: supabase db push --local

      - name: Check for type drift
        run: |
          supabase gen types typescript --local > /tmp/generated-types.ts
          diff packages/types/src/database.types.ts /tmp/generated-types.ts || \
            (echo "Type drift detected! Run 'supabase gen types' locally." && exit 1)
```

### Web Deployment Strategy

For Phase 1, the **Vercel GitHub integration** handles web deploys with zero configuration:
- Connect the repo to Vercel via their dashboard
- Vercel automatically deploys preview URLs on every PR
- Vercel automatically deploys to production on merge to `main`
- No workflow file, no secrets, no YAML

The `deploy-web.yml` template exists as a fallback if the native Vercel integration proves insufficient (e.g., if you need custom build steps or environment-specific config).

### Nx Cache Strategy

Two options, pick one:

| Strategy | Setup | Cost | Best For |
|----------|-------|------|----------|
| **`actions/cache`** (local) | Add cache step to `ci.yml` (shown above) | Free | Solo dev, simple setup |
| **Nx Cloud** (remote) | Run `npx nx connect`, add `NX_CLOUD_AUTH_TOKEN` secret | Free for solo devs | Faster CI when cache is warm, shared across PRs |

Start with `actions/cache`. Switch to Nx Cloud if CI times become painful.

### Secrets Inventory

| Secret | Required When | Used By |
|--------|---------------|---------|
| `CLOUDFLARE_API_TOKEN` | `apps/api/` is shippable | `deploy-api.yml` |
| `CLOUDFLARE_ACCOUNT_ID` | `apps/api/` is shippable | `deploy-api.yml` (as repo variable, not secret) |
| `EXPO_TOKEN` | `apps/mobile/` is shippable | `mobile.yml` |
| `VERCEL_TOKEN` | Only if Vercel native integration is insufficient | `deploy-web.yml` |
| `VERCEL_ORG_ID` | Only if Vercel native integration is insufficient | `deploy-web.yml` |
| `VERCEL_PROJECT_ID` | Only if Vercel native integration is insufficient | `deploy-web.yml` |
| `VSCE_PAT` | `apps/vscode-extension/` is shippable (post-v1) | `vscode.yml` |
| `NPM_TOKEN` | `apps/mcp-server/` is shippable (post-v1) | `mcp.yml` |
| `NX_CLOUD_AUTH_TOKEN` | If Nx Cloud is adopted | `ci.yml` |

Secrets are added incrementally — only when the corresponding deploy workflow is activated.

### Agent Workflow Integration

The CI/CD pipeline is designed around the local-agent workflow:

```
Developer runs /ship-issue N locally (Max subscription)
  → Claude creates branch, implements, runs tests locally
  → Claude pushes branch, opens PR via gh CLI
  → GitHub Actions runs ci.yml (lint, test, type-check, build)
  → Deploy workflows trigger if path filters match
  → Developer reviews PR, merges
  → Production deploy runs on push to main
```

Claude Code Action (`@claude` in PR comments) is intentionally excluded because:
1. It requires an Anthropic API key (pay-per-use), incompatible with Max subscription
2. Agent work is more effective locally where Claude has full system access
3. CI should be deterministic (lint/test/build), not AI-driven

If Anthropic adds official Max OAuth support for GitHub Actions, Claude Code Action can be added as a lightweight auto-fix layer (e.g., fix lint errors on failed checks).

### Post-v1 Platform Workflows

These are documented but not written as templates yet (they depend on toolchains that aren't set up):

**VS Code Extension (`vscode.yml`):**
- Trigger: push to `main` with changes in `apps/vscode-extension/`
- Steps: `npm ci` → test with `@vscode/test-electron` + `coactions/setup-xvfb` → `vsce package` → publish
- Secret: `VSCE_PAT`

**MCP Server (`mcp.yml`):**
- Trigger: tag `mcp-server-v*`
- Steps: `pnpm install` → build → `npm publish --access public`
- Secret: `NPM_TOKEN`

**Firmware (`firmware.yml`):**
- Trigger: PR with changes in `firmware/`
- Steps: `pip install platformio` → `platformio run` → `platformio test`
- No secrets needed (compile + test only)

**Native Swift (deferred entirely):**
- macOS widget, iOS widget, watchOS app
- Build and test locally from Xcode
- No GitHub Actions workflow — revisit when native targets ship
- Potential future option: Xcode Cloud (free 25 hrs/month with Apple Developer Program)

## Alternatives Considered

### Ultra-Minimal (single ci.yml, no deploy templates)
Rejected because the "I'll forget to add deploy workflows" failure mode is real. Writing dormant templates now costs nothing and prevents this.

### Platform-Separated (full automation from day one)
Rejected because it requires configuring 6+ workflow files and ~18 secrets before any app code exists. Premature configuration for a solo developer in pre-code phase.

### Claude Code Action for CI
Rejected for v1 because it requires Anthropic API key (pay-per-use), adding cost on top of the Max subscription. Agent work is more effective locally. May be reconsidered if official Max OAuth support is added.

### Fastlane for mobile builds
Rejected because PomoFocus uses Expo, and EAS Build eliminates the need for Fastlane's cert management (Match), macOS runners, and Ruby toolchain. Fastlane is only needed for native Swift targets (which are deferred and will be built locally from Xcode).

## Cross-Cutting Concerns

- **Security:** Secrets are GitHub-encrypted. No secrets committed to repo. `CLOUDFLARE_ACCOUNT_ID` is a repo variable (not secret) because it's not sensitive. EAS manages iOS signing certs — they never touch GitHub.
- **Cost:** `ci.yml` runs on `ubuntu-latest` (free tier: 2,000 min/month). EAS Build free tier: 15 iOS + 15 Android builds/month. Vercel free tier handles web deploys. Total v1 CI cost: $0/month.
- **Observability:** GitHub Actions provides built-in logs and status checks. Nx affected output shows exactly which packages were validated. EAS Build has its own dashboard at expo.dev.
- **Migration path:** If CI costs increase or needs change: Nx Cloud for faster caching, Xcode Cloud for native Swift, GitHub larger runners for parallelism. All are additive — no existing workflows need to change.

## Open Questions

1. **Nx Cloud vs `actions/cache`** — start with `actions/cache`, measure CI times, switch to Nx Cloud if needed. Both are free.
2. **Claude Code Action Max OAuth** — monitor Anthropic's official docs for Max subscription support in GitHub Actions. If added, create a lightweight `claude-agent.yml` for auto-fix patterns.
3. **EAS Workflows** — Expo launched EAS Workflows as a higher-level CI/CD abstraction that integrates with GitHub Actions. Evaluate when mobile app reaches beta stage.
4. **Branch protection rules** — configure when first PR workflow is needed. Set "CI Complete" as required check, require 1 approval (from yourself), dismiss stale reviews on push.
