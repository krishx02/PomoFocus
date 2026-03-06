---
name: pre-finalize
description: Runs build verification, integration tests, E2E tests, and cross-package dependency tests for all platforms affected by the current branch. Sits between /fix-issue and /finalize. Auto-fixes failures up to 3 times, then escalates.
user-invocable: true
context: fork
allowed-tools: Bash(gh *), Bash(git *), Bash(pnpm *), Bash(xcodebuild *), Bash(maestro *), Bash(node *), Bash(npx *), Bash(ls *), Bash(test *), Read, Edit, Write, Grep, Glob
argument-hint: "[issue number]"
---

Issue number: $ARGUMENTS

You are the pre-finalize testing orchestrator. `/fix-issue` has already run: unit tests pass, type-check is clean, code is committed and pushed. Your job is to run broader verification — build, integration tests, E2E tests, cross-package dependency tests — before the PR is created.

Do NOT create a PR. Do NOT update issue labels (beyond `needs-human` on failure). You verify; `/finalize` ships.

---

## Step 1 — Validate Preconditions

Verify that `/fix-issue` has already run.

```bash
git branch --show-current
```

Confirm the branch name starts with `feature/issue-` or `fix/issue-`. If on `main`, stop:
```
ERROR: You are on main. /pre-finalize must run on a feature or fix branch after /fix-issue has completed.
```

Verify there are no uncommitted changes:
```bash
git status --porcelain
```

If there are uncommitted changes, stop:
```
ERROR: Uncommitted changes detected. /fix-issue should have committed all changes. Commit or stash first.
```

Verify the branch has been pushed (push if not):
```bash
git push -u origin $(git branch --show-current) 2>/dev/null || true
```

Fetch latest main for accurate diffing:
```bash
git fetch origin main
```

## Step 2 — Detect Affected Platforms

Get the list of changed files on this branch:
```bash
git diff --name-only origin/main...HEAD
```

Map each changed file to a platform bucket using these path prefixes:

| Prefix | Bucket |
|--------|--------|
| `packages/core/` | `core` |
| `packages/types/` | `core` |
| `packages/api-client/` | `api-client` |
| `packages/ui-components/` | `ui-components` |
| `packages/ble-client/` | `ble-client` |
| `packages/config/` | `config` |
| `apps/web/` | `web` |
| `apps/mobile/` | `mobile` |
| `apps/vscode-extension/` | `vscode` |
| `apps/mcp-server/` | `mcp-server` |
| `native/apple/mac-widget/` | `apple-mac` |
| `native/apple/ios-widget/` | `apple-ios-widget` |
| `native/apple/watchos-app/` | `apple-watchos` |

Files not matching any prefix (docs, CI config, root config) do not trigger platform tests — ignore them.

**Cross-package propagation:** If any `packages/*` bucket is affected, determine downstream consumers. Try Nx first:
```bash
pnpm nx affected --target=build --base=origin/main --head=HEAD --plain 2>/dev/null
```

If Nx is not configured yet, fall back to this manual propagation table:
- `core` or `types` changed → also test: `web`, `mobile`, `vscode`, `mcp-server`
- `api-client` changed → also test: `web`, `mobile`, `vscode`, `mcp-server`
- `ui-components` changed → also test: `web`, `mobile`, `vscode`
- `ble-client` changed → also test: `mobile`
- `config` changed → also test: all TypeScript buckets

Log the results clearly:
```
Affected platforms: [comma-separated list]
Cross-package propagation: [what was added and why, or "none"]
```

If no platform buckets are affected (e.g., only docs changed), skip to Step 6 with all tests marked "N/A".

## Step 3 — Build Verification

Before running E2E or integration tests, verify the build succeeds for affected TypeScript packages.

For each affected Nx-managed bucket, check if the build target exists and run it:
```bash
pnpm nx show project @pomofocus/[package] --json 2>/dev/null
```

Parse the JSON to check if `targets.build` exists. If it does:
```bash
pnpm nx build @pomofocus/[package]
```

For Apple targets, the build is implicit in `xcodebuild test` (Step 4) — skip separate build verification.

**If any build fails:** this is a blocking error. Do NOT proceed to E2E tests. Record the failure and jump to Step 5 (Fix Loop).

If no build targets exist for any affected platform (early project phase), log:
```
Build verification: SKIPPED — no build targets configured yet
```

## Step 4 — Run Integration and E2E Tests

For each affected platform bucket, run the corresponding test command. **Before each command, check that the test infrastructure exists.** If it does not, skip with a clear message.

### web
```bash
if [ -d "apps/web-e2e" ]; then
  pnpm nx e2e @pomofocus/web-e2e
else
  echo "SKIP: apps/web-e2e/ not configured — no Playwright E2E tests to run"
fi
```

### mobile
```bash
if [ -d "apps/mobile/maestro" ] && command -v maestro &>/dev/null; then
  maestro test apps/mobile/maestro/
else
  echo "SKIP: Maestro E2E not configured — no mobile E2E tests to run"
fi
```

### vscode
```bash
if pnpm nx show project @pomofocus/vscode-extension --json 2>/dev/null | grep -q '"test"'; then
  pnpm nx test @pomofocus/vscode-extension
else
  echo "SKIP: vscode-extension test target not configured"
fi
```

### mcp-server
```bash
if pnpm nx show project @pomofocus/mcp-server --json 2>/dev/null | grep -q '"test"'; then
  pnpm nx test @pomofocus/mcp-server
else
  echo "SKIP: mcp-server test target not configured"
fi
```

### api-client
```bash
if pnpm nx show project @pomofocus/api-client --json 2>/dev/null | grep -q '"test"'; then
  pnpm nx test @pomofocus/api-client
else
  echo "SKIP: api-client test target not configured"
fi
```

### apple-mac
```bash
if [ -d "native/apple/mac-widget" ] && ([ -d "native/apple/mac-widget/PomoFocusMac.xcodeproj" ] || [ -d "native/apple/mac-widget/PomoFocusMac.xcworkspace" ]); then
  xcodebuild test \
    -scheme PomoFocusMac \
    -destination "platform=macOS" \
    -resultBundlePath TestResults-Mac.xcresult
else
  echo "SKIP: macOS widget Xcode project not configured"
fi
```

### apple-ios-widget
```bash
if [ -d "native/apple/ios-widget" ] && ([ -d "native/apple/ios-widget/PomoFocusiOSWidget.xcodeproj" ] || [ -d "native/apple/ios-widget/PomoFocusiOSWidget.xcworkspace" ]); then
  xcodebuild test \
    -scheme PomoFocusiOSWidget \
    -destination "platform=iOS Simulator,name=iPhone 16,OS=latest" \
    -resultBundlePath TestResults-iOSWidget.xcresult
else
  echo "SKIP: iOS widget Xcode project not configured"
fi
```

### apple-watchos
```bash
if [ -d "native/apple/watchos-app" ] && ([ -d "native/apple/watchos-app/PomoFocusWatch.xcodeproj" ] || [ -d "native/apple/watchos-app/PomoFocusWatch.xcworkspace" ]); then
  xcodebuild test \
    -scheme PomoFocusWatch \
    -destination "platform=watchOS Simulator,name=Apple Watch Series 10 - 46mm,OS=latest" \
    -resultBundlePath TestResults-Watch.xcresult
else
  echo "SKIP: watchOS Xcode project not configured"
fi
```

### Cross-package affected tests (Nx dependency graph)

If any `packages/*` bucket was affected and Nx is configured:
```bash
pnpm nx affected --target=test --base=origin/main --head=HEAD
```

This catches downstream test failures in consumer packages. If Nx is not configured, skip.

Record all results: which tests ran, which passed, which were skipped, which failed.

## Step 5 — Fix Loop

If ALL tests passed (or were skipped), go to Step 6.

If any test failed, enter the fix loop.

**Iteration limit: 3 attempts.**

Set `FIX_ATTEMPT = 1`.

**Loop:**
1. Read the failure output carefully. Identify the root cause.
2. Fix the failing code. Rules:
   - Do NOT modify files outside the issue's platform scope
   - Follow existing patterns in the files you modify
3. Stage only the changed files by name (do NOT use `git add -A`):
   ```bash
   git add [specific files]
   git commit -m "fix: address integration test failure (attempt $FIX_ATTEMPT) (#$ARGUMENTS)"
   ```
4. Push the fix:
   ```bash
   git push
   ```
5. Re-run ONLY the failing test command(s) — do not re-run tests that already passed.
6. If tests now pass, exit the loop and go to Step 6.
7. Increment `FIX_ATTEMPT`. If `FIX_ATTEMPT > 3`, go to Step 5b.

### Step 5b — Escalate to needs-human

```bash
gh issue edit $ARGUMENTS --add-label "needs-human"
gh issue comment $ARGUMENTS --body "$(cat <<'EOF'
## Integration/E2E Test Loop Exhausted — Needs Human

Integration or E2E tests are still failing after 3 fix attempts in `/pre-finalize`.

**Failing test(s):** [list the specific test command(s) that failed]
**Last failure output:** [summary of the error — the actionable part, not the full log]

Unit tests pass (via `/fix-issue`). The failure is in broader integration or E2E tests,
which may require infrastructure changes, environment setup, or a design decision.

Please review the test failure and resolve the root cause manually.
EOF
)"
```

Stop. Do NOT proceed to `/finalize`. Output:
```
Integration/E2E tests failed after 3 fix attempts for issue #$ARGUMENTS.
Issue labeled needs-human. A comment has been posted with failure details.
```

## Step 6 — Success Report

All tests passed (or were appropriately skipped). Output a clear summary:

```
Pre-finalize testing complete for issue #$ARGUMENTS.
Branch: [BRANCH_NAME]

Build verification:
  [package]: PASS / SKIP (reason)
  ...

Integration / E2E tests:
  [platform]: PASS / SKIP (reason)
  ...

Cross-package (nx affected): PASS / SKIP / N/A

Fix attempts: [0 if clean, or N]

Start a new Claude Code session and run:
  /finalize $ARGUMENTS
```

Do NOT call `/finalize` here. Do NOT create the PR. Stop completely — `/finalize` runs in a separate context window.
