# GitHub Actions CI/CD Patterns for Multi-Platform App Development
### PomoFocus — Web + iOS + Android + VS Code Extension + Mac Widgets (Supabase + Cloudflare)

> Research compiled: March 2026

---

## TL;DR

Modern GitHub Actions supports the entire PomoFocus platform delivery surface — web (Cloudflare Pages/Workers), iOS (Fastlane + App Store Connect API), Android (Fastlane + Google Play), VS Code extensions (vsce + marketplace), and Mac Widgets (Xcode Cloud or custom runners) — from a single monorepo with path-filtered, matrix-driven, affected-package-aware jobs. Claude Code's `anthropics/claude-code-action@v1` integrates natively as a GitHub Action, enabling AI-assisted auto-fix loops triggered by PR comments or failed lint/test status checks. Branch protection rules work seamlessly with agentic PRs as long as required checks are scoped by platform and Claude pushes to a separate branch rather than directly to `main`.

---

## Key Findings

- **Monorepo path filtering** via `on.push.paths` and `on.pull_request.paths` is the primary mechanism to avoid running all pipelines on every commit. Nx's `nx affected --base=origin/main` finds affected packages and is idiomatic for Nx workspaces.
- **Matrix builds** (`strategy.matrix`) handle multi-platform jobs (iOS/Android/web) in one workflow file with platform-specific runners (`macos-latest` for Apple targets, `ubuntu-latest` for web/Android).
- **Cloudflare Pages** and **Cloudflare Workers** each have official GitHub Actions (`cloudflare/pages-action` and `cloudflare/wrangler-action`) that deploy preview environments on PR open and production on merge to `main`.
- **Fastlane** is the gold-standard for both iOS App Store and Android Google Play automation; it handles code signing, version bumping, changelog generation, and API submission entirely from the CLI, making it GitHub-Actions-friendly.
- **VS Code extension publishing** uses the `vsce` (Visual Studio Code Extensions) CLI via `@vscode/vsce` npm package; the `HaaLeo/publish-vscode-extension@v1` action wraps it cleanly with token management.
- **Claude Code Action** (`anthropics/claude-code-action@v1`) runs Claude as a GitHub Actions step. It responds to `@claude` mentions in PR comments and can be triggered on `workflow_dispatch`, `issue_comment`, or `pull_request` events. It commits fixes back to the PR branch.
- **Branch protection** must allow the GitHub App or bot user that Claude Code operates as to push to protected branches; the cleanest pattern is requiring all checks pass on PRs but letting Claude push to the feature branch, never directly to `main`.
- **Nx Cloud remote caching** (free for solo developers) dramatically reduces CI build times in JS monorepos by skipping tasks whose inputs haven't changed since the last cached run. Set `NX_CLOUD_AUTH_TOKEN` in repo secrets.
- **Required status checks** should be defined per-platform so a failing iOS build doesn't block a web-only change; use `if: contains(github.event.pull_request.labels, 'ios')` or path filters to make checks conditional and required only when their platform changes.

---

## 1. Monorepo Structure & Path Filtering

For PomoFocus with multiple platforms, the recommended monorepo layout is:

```
pomofocus/
  apps/
    web/              # Next.js / React + Cloudflare Pages
    ios/              # Xcode project / Swift
    android/          # Gradle / Kotlin
    vscode-extension/ # VS Code extension
    mac-widget/       # WidgetKit / Swift
  packages/
    shared/           # Shared types, utilities
    supabase/         # Supabase client, schema, migrations
    ui/               # Shared UI components
  .github/
    workflows/
  nx.json
  package.json        # pnpm/npm workspace root
```

Path filtering ensures each platform's workflow only triggers on relevant changes:

```yaml
# .github/workflows/web.yml
on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/shared/**'
      - 'packages/supabase/**'
      - 'packages/ui/**'
  pull_request:
    paths:
      - 'apps/web/**'
      - 'packages/shared/**'
      - 'packages/supabase/**'
      - 'packages/ui/**'
```

```yaml
# .github/workflows/ios.yml
on:
  push:
    branches: [main]
    paths:
      - 'apps/ios/**'
      - 'apps/mac-widget/**'
  pull_request:
    paths:
      - 'apps/ios/**'
      - 'apps/mac-widget/**'
```

---

## 2. Nx Affected Package Detection in GitHub Actions

Nx's `nx affected` command compares the current branch against the base branch and runs tasks only for projects that have changed (including their dependents). `fetch-depth: 0` is required so Nx can compute the full diff.

```yaml
# .github/workflows/ci.yml
name: CI — JS/TS Monorepo

on:
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # Full history needed for Nx affected diff

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Only lint/test/build packages affected by this PR
      - name: Lint affected
        run: pnpm nx affected --target=lint --base=origin/main --head=HEAD

      - name: Test affected
        run: pnpm nx affected --target=test --base=origin/main --head=HEAD

      # Cache Nx local compute cache between runs
      - uses: actions/cache@v4
        with:
          path: .nx/cache
          key: nx-${{ runner.os }}-${{ github.sha }}
          restore-keys: nx-${{ runner.os }}-
```

**List affected projects as JSON** (useful for conditional matrix jobs):

```yaml
      - name: Get affected projects
        id: affected
        run: |
          AFFECTED=$(pnpm nx show projects --affected --base=origin/main --head=HEAD --json)
          echo "projects=$AFFECTED" >> $GITHUB_OUTPUT
```

**Nx Cloud Remote Cache** (free for solo developers — eliminates the need for the local cache action above):

```yaml
      - name: Lint affected (with Nx Cloud cache)
        run: pnpm nx affected --target=lint --base=origin/main --head=HEAD
        env:
          NX_CLOUD_AUTH_TOKEN: ${{ secrets.NX_CLOUD_AUTH_TOKEN }}
```

Set up Nx Cloud once with `npx nx connect` — it configures `nx.json` automatically. The free tier covers solo developers generously.

---

## 3. Cloudflare Pages Deployment

Cloudflare Pages has an official GitHub Action. The pattern is: preview on PR, production on merge to `main`.

```yaml
# .github/workflows/deploy-web.yml
name: Deploy — Cloudflare Pages

on:
  push:
    branches: [main]
    paths: ['apps/web/**', 'packages/**']
  pull_request:
    paths: ['apps/web/**', 'packages/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
      pull-requests: write    # To post preview URL as PR comment

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build web app
        run: pnpm nx run web:build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
          projectName: pomofocus
          directory: apps/web/.next          # Or 'out' for static export
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}  # Posts preview URL to PR
          # branch left unset → auto-detects main vs PR
```

**Cloudflare Workers** (for Supabase Edge Functions proxy, API routes):

```yaml
      - name: Deploy Cloudflare Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/web
          command: deploy --env ${{ github.ref == 'refs/heads/main' && 'production' || 'preview' }}
```

**Required secrets:**
- `CLOUDFLARE_API_TOKEN` — scoped to Pages/Workers edit
- `CLOUDFLARE_ACCOUNT_ID` — from Cloudflare dashboard

---

## 4. iOS App Store Automated Release (Fastlane)

Fastlane is the industry standard for iOS CI. The key pieces are Match (code signing), Gym (build), and Deliver/Pilot (submission).

```ruby
# apps/ios/fastlane/Fastfile
default_platform(:ios)

platform :ios do

  desc "Run tests"
  lane :test do
    run_tests(
      scheme: "PomoFocus",
      devices: ["iPhone 15"]
    )
  end

  desc "Build and submit to TestFlight"
  lane :beta do
    setup_ci                           # Configures keychain for CI
    match(type: "appstore", readonly: true)
    increment_build_number(
      build_number: ENV["BUILD_NUMBER"]
    )
    build_app(
      scheme: "PomoFocus",
      export_method: "app-store"
    )
    upload_to_testflight(
      api_key_path: "fastlane/app_store_connect_api_key.json",
      skip_waiting_for_build_processing: true
    )
  end

  desc "Submit to App Store"
  lane :release do
    setup_ci
    match(type: "appstore", readonly: true)
    build_app(scheme: "PomoFocus", export_method: "app-store")
    upload_to_app_store(
      api_key_path: "fastlane/app_store_connect_api_key.json",
      submit_for_review: true,
      automatic_release: false,
      force: true                      # Skip HTML report
    )
  end
end
```

```yaml
# .github/workflows/ios.yml
name: iOS — Build & Deploy

on:
  push:
    branches: [main]
    paths: ['apps/ios/**']
  workflow_dispatch:
    inputs:
      lane:
        description: 'Fastlane lane (test|beta|release)'
        required: true
        default: beta

jobs:
  build:
    runs-on: macos-latest             # Must be macOS for Xcode
    defaults:
      run:
        working-directory: apps/ios

    steps:
      - uses: actions/checkout@v4

      - name: Set up Ruby + Fastlane
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true          # Caches gems
          working-directory: apps/ios

      - name: Cache Derived Data
        uses: actions/cache@v4
        with:
          path: ~/Library/Developer/Xcode/DerivedData
          key: derived-data-${{ runner.os }}-${{ hashFiles('apps/ios/**/*.xcodeproj/project.pbxproj') }}

      - name: Run Tests
        run: bundle exec fastlane test

      - name: Deploy to TestFlight
        if: github.ref == 'refs/heads/main' || github.event.inputs.lane == 'beta'
        run: bundle exec fastlane beta
        env:
          MATCH_GIT_BASIC_AUTHORIZATION: ${{ secrets.MATCH_GIT_BASIC_AUTHORIZATION }}
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.APP_STORE_CONNECT_API_KEY_ID }}
          APP_STORE_CONNECT_API_ISSUER_ID: ${{ secrets.APP_STORE_CONNECT_API_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY_CONTENT: ${{ secrets.APP_STORE_CONNECT_API_KEY_CONTENT }}
          BUILD_NUMBER: ${{ github.run_number }}
```

**Required secrets:**
- `MATCH_GIT_BASIC_AUTHORIZATION` — base64-encoded `user:token` for Match repo access
- `MATCH_PASSWORD` — passphrase to decrypt Match certificates
- `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_CONTENT` — App Store Connect API key (p8 file content)

---

## 5. Android Google Play Automated Deployment (Fastlane)

```ruby
# apps/android/fastlane/Fastfile
default_platform(:android)

platform :android do

  desc "Run unit tests"
  lane :test do
    gradle(task: "test")
  end

  desc "Build and upload to Google Play Internal track"
  lane :beta do
    gradle(
      task: "bundle",
      build_type: "Release",
      properties: {
        "android.injected.signing.store.file" => ENV["KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["KEY_ALIAS"],
        "android.injected.signing.key.password" => ENV["KEY_PASSWORD"]
      }
    )
    upload_to_play_store(
      track: "internal",
      aab: "app/build/outputs/bundle/release/app-release.aab",
      json_key: ENV["GOOGLE_PLAY_JSON_KEY_PATH"],
      release_status: "draft",
      skip_upload_metadata: true,
      skip_upload_images: true,
      skip_upload_screenshots: true
    )
  end

  desc "Promote internal to production"
  lane :promote_to_production do
    upload_to_play_store(
      track: "internal",
      track_promote_to: "production",
      json_key: ENV["GOOGLE_PLAY_JSON_KEY_PATH"],
      rollout: "0.1"                   # 10% staged rollout
    )
  end
end
```

```yaml
# .github/workflows/android.yml
name: Android — Build & Deploy

on:
  push:
    branches: [main]
    paths: ['apps/android/**']
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/android

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: temurin

      - name: Set up Ruby + Fastlane
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
          working-directory: apps/android

      - name: Cache Gradle
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: gradle-${{ runner.os }}-${{ hashFiles('apps/android/**/*.gradle*', 'apps/android/gradle-wrapper.properties') }}

      - name: Decode keystore
        run: |
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > keystore.jks

      - name: Write Google Play JSON key
        run: |
          echo '${{ secrets.GOOGLE_PLAY_JSON_KEY }}' > google-play-key.json

      - name: Run Tests
        run: bundle exec fastlane test

      - name: Build & Upload to Play Store
        if: github.ref == 'refs/heads/main'
        run: bundle exec fastlane beta
        env:
          KEYSTORE_PATH: ${{ github.workspace }}/apps/android/keystore.jks
          KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
          GOOGLE_PLAY_JSON_KEY_PATH: ${{ github.workspace }}/apps/android/google-play-key.json
```

**Required secrets:**
- `ANDROID_KEYSTORE_BASE64` — base64-encoded `.jks` signing keystore
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_JSON_KEY` — service account JSON from Google Cloud Console

---

## 6. VS Code Extension Publishing

The standard toolchain is `@vscode/vsce` (the `vsce` CLI) for packaging and publishing. The `HaaLeo/publish-vscode-extension` action wraps this cleanly. You need a Personal Access Token (PAT) from the Azure DevOps marketplace with "Marketplace > Manage" scope.

```yaml
# .github/workflows/vscode-extension.yml
name: VS Code Extension — Publish

on:
  push:
    branches: [main]
    paths: ['apps/vscode-extension/**']
  release:
    types: [published]              # Also trigger on GitHub Release creation
  workflow_dispatch:
    inputs:
      pre_release:
        description: 'Publish as pre-release'
        type: boolean
        default: false

jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/vscode-extension

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Run Extension Tests
        uses: coactions/setup-xvfb@v1  # Required for headless VS Code tests
        with:
          run: npm test

      - name: Package Extension
        run: npx @vscode/vsce package --no-dependencies

      - name: Publish to VS Code Marketplace
        if: github.ref == 'refs/heads/main' || github.event_name == 'release'
        uses: HaaLeo/publish-vscode-extension@v1
        with:
          pat: ${{ secrets.VSCE_PAT }}
          registryUrl: https://marketplace.visualstudio.com
          extensionFile: ./apps/vscode-extension/*.vsix
          preRelease: ${{ github.event.inputs.pre_release == 'true' }}

      - name: Upload VSIX as artifact
        uses: actions/upload-artifact@v4
        with:
          name: pomofocus-vscode-${{ github.sha }}
          path: apps/vscode-extension/*.vsix
```

**Key notes:**
- VS Code tests require a display; use `coactions/setup-xvfb` on Linux runners
- The `VSCE_PAT` must have "Marketplace > Manage" scope in Azure DevOps
- Version in `package.json` must be bumped before publishing; use `npm version patch` in a pre-publish step or manage via Git tags
- Open-source extensions can also publish to the **Open VSX Registry** (for non-Microsoft editors): add `registryUrl: https://open-vsx.org` and `pat: ${{ secrets.OPEN_VSX_TOKEN }}`

---

## 7. Claude Code / AI Agent Runs from GitHub Actions

The official integration is `anthropics/claude-code-action@v1`. It runs Claude Code in headless mode inside the GitHub Actions runner and can make commits, open PRs, and respond to review comments.

### Pattern A: Respond to @claude Mentions in PR Comments

```yaml
# .github/workflows/claude-agent.yml
name: Claude Code Agent

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  claude:
    # Only run when @claude is mentioned in a PR comment
    if: |
      (github.event_name == 'issue_comment' || github.event_name == 'pull_request_review_comment') &&
      contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          ref: ${{ github.event.pull_request.head.ref }}

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          # Claude reads the comment, figures out what to do, and commits the result
```

### Pattern B: Auto-Fix Lint Errors After Failed Check

```yaml
# .github/workflows/auto-fix-lint.yml
name: Auto-Fix — Lint Errors

on:
  # Triggered when the lint workflow fails on a PR
  workflow_run:
    workflows: ['CI — JS/TS Monorepo']
    types: [completed]

jobs:
  auto-fix:
    if: |
      github.event.workflow_run.conclusion == 'failure' &&
      github.event.workflow_run.event == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          ref: ${{ github.event.workflow_run.head_sha }}

      - uses: pnpm/action-setup@v3

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Get lint errors
        id: lint
        run: |
          pnpm nx affected --target=lint --base=origin/main --head=HEAD 2>&1 | head -200 > lint-output.txt || true

      - name: Run Claude to fix lint errors
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            The following lint errors were found in this PR. Fix all of them.
            Only fix lint/formatting issues — do not change logic.
            After fixing, confirm which files were changed.

            Lint output:
            $(cat lint-output.txt)
          allowed_tools: 'Read,Edit,Bash(pnpm run lint:fix)'
          max_turns: '10'
```

### Pattern C: Claude on workflow_dispatch (Manual Trigger)

```yaml
# .github/workflows/claude-task.yml
name: Claude — On-Demand Task

on:
  workflow_dispatch:
    inputs:
      task:
        description: 'Describe the task for Claude'
        required: true
      branch:
        description: 'Branch to work on (leave blank for new branch)'
        required: false

jobs:
  run-claude:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          ref: ${{ github.event.inputs.branch || 'main' }}

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: ${{ github.event.inputs.task }}
          max_turns: '20'
```

### Headless Claude CLI in Actions (Without the Action)

If you want finer control, call the `claude` CLI directly:

```yaml
      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code

      - name: Run Claude headless
        run: |
          cat build-errors.txt | claude -p "Fix the build errors shown" \
            --allowedTools "Read,Edit,Bash(npm run build)" \
            --max-turns 10 \
            --output-format json > claude-output.json
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 8. Branch Protection + PR Workflows for Agentic PRs

### Recommended Branch Protection Configuration (main)

```
Required status checks:
  - CI / lint-and-test (JS packages)       [path-filtered: required when JS changes]
  - iOS / build (macos-latest)             [path-filtered: required when iOS changes]
  - Android / build (ubuntu-latest)        [path-filtered: required when Android changes]
  - Cloudflare Pages deploy                [required for web PRs]

Require PR before merging: YES (1 approval)
Dismiss stale reviews on push: YES
Require signed commits: optional
Allow force pushes: NO
Allow deletions: NO
```

### Allowing Claude to Push to Feature Branches

Claude Code Action authenticates as the GitHub Actions bot (`github-actions[bot]`) by default using `GITHUB_TOKEN`. This bot user can push to non-protected branches.

For Claude to push fixes to PR branches:

```yaml
      - uses: actions/checkout@v4
        with:
          # Must use GITHUB_TOKEN (or PAT) that has write access
          token: ${{ secrets.GITHUB_TOKEN }}
          # Check out the PR's head branch so Claude pushes there
          ref: ${{ github.head_ref }}
          # Ensure we can push back
          fetch-depth: 0
```

### Conditional Required Checks with Paths

GitHub does not natively support path-conditional required checks (a known limitation). The common workaround is a "success gate" job:

```yaml
# Every platform workflow ends with this job:
  ci-success:
    name: CI Success Gate
    needs: [lint-and-test]    # The real jobs
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check all required jobs passed
        run: |
          if [[ "${{ needs.lint-and-test.result }}" != "success" && \
                "${{ needs.lint-and-test.result }}" != "skipped" ]]; then
            echo "Required job failed"
            exit 1
          fi
```

Then set "CI Success Gate" as the required check. Skipped = passing (path filter didn't match), success = real pass.

### Handling Agentic PRs in Branch Protection

The recommended setup for agent-generated PRs:

1. Claude Code Action opens PRs from a branch like `claude/fix-lint-errors-abc123`
2. Branch protection on `main` requires the PR + checks
3. Claude's PR gets reviewed (by you, or auto-approved if checks pass via policy)
4. Auto-merge can be enabled: PRs where all checks pass and a label `auto-merge` is applied get merged automatically

```yaml
# Add auto-merge on label
- name: Enable auto-merge for Claude PRs
  if: contains(github.event.pull_request.labels.*.name, 'claude-fix')
  run: gh pr merge --auto --squash "${{ github.event.pull_request.number }}"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 9. Full Multi-Platform CI Matrix Example

```yaml
# .github/workflows/ci-matrix.yml
name: CI — Multi-Platform Matrix

on:
  pull_request:
    branches: [main]

jobs:
  # Detect which platforms changed
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      ios: ${{ steps.filter.outputs.ios }}
      android: ${{ steps.filter.outputs.android }}
      vscode: ${{ steps.filter.outputs.vscode }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'apps/web/**'
              - 'packages/**'
            ios:
              - 'apps/ios/**'
              - 'apps/mac-widget/**'
            android:
              - 'apps/android/**'
            vscode:
              - 'apps/vscode-extension/**'

  # Web: lint, test, preview deploy
  web-ci:
    needs: detect-changes
    if: needs.detect-changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm nx run-many --targets=lint,test,build --projects=web
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
          projectName: pomofocus
          directory: apps/web/.next
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

  # iOS: build and test on macOS
  ios-ci:
    needs: detect-changes
    if: needs.detect-changes.outputs.ios == 'true'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
          working-directory: apps/ios
      - name: Run iOS tests
        working-directory: apps/ios
        run: bundle exec fastlane test

  # Android: build and test
  android-ci:
    needs: detect-changes
    if: needs.detect-changes.outputs.android == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: temurin
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.3'
          bundler-cache: true
          working-directory: apps/android
      - name: Run Android tests
        working-directory: apps/android
        run: bundle exec fastlane test

  # VS Code Extension: test and package
  vscode-ci:
    needs: detect-changes
    if: needs.detect-changes.outputs.vscode == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - working-directory: apps/vscode-extension
        run: npm ci
      - uses: coactions/setup-xvfb@v1
        with:
          run: npm test
          working-directory: apps/vscode-extension
      - working-directory: apps/vscode-extension
        run: npx @vscode/vsce package --no-dependencies

  # Required check gate (always runs, reports overall status)
  ci-complete:
    name: All CI Checks Passed
    needs: [web-ci, ios-ci, android-ci, vscode-ci]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Verify all platform checks
        run: |
          results=("${{ needs.web-ci.result }}" "${{ needs.ios-ci.result }}" "${{ needs.android-ci.result }}" "${{ needs.vscode-ci.result }}")
          for result in "${results[@]}"; do
            if [[ "$result" == "failure" || "$result" == "cancelled" ]]; then
              echo "One or more platform CI jobs failed: $result"
              exit 1
            fi
          done
          echo "All checks passed or were skipped"
```

---

## 10. Supabase CI Integration

Supabase migrations and types should be validated in CI:

```yaml
# .github/workflows/supabase.yml
name: Supabase — Validate Migrations

on:
  pull_request:
    paths:
      - 'packages/supabase/**'
      - 'supabase/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    services:
      supabase:
        image: supabase/postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local
        run: supabase start --ignore-health-check

      - name: Apply migrations
        run: supabase db push --local

      - name: Generate TypeScript types
        run: supabase gen types typescript --local > packages/supabase/types.ts

      - name: Check for type drift
        run: git diff --exit-code packages/supabase/types.ts
        # Fails if committed types don't match generated types
```

---

## 11. Recommended Secrets Strategy

| Secret Name | Scope | Used In |
|---|---|---|
| `ANTHROPIC_API_KEY` | Repo | Claude Code Action |
| `CLOUDFLARE_API_TOKEN` | Repo | Pages/Workers deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Repo var (not secret) | Pages/Workers deploy |
| `SUPABASE_ANON_KEY` | Repo / Environment | Web build |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod environment only | Server-side only |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Repo | iOS signing |
| `MATCH_PASSWORD` | Repo | iOS signing |
| `APP_STORE_CONNECT_API_KEY_*` | Repo | iOS release |
| `ANDROID_KEYSTORE_BASE64` | Repo | Android signing |
| `ANDROID_KEYSTORE_PASSWORD` | Repo | Android signing |
| `ANDROID_KEY_ALIAS` | Repo | Android signing |
| `ANDROID_KEY_PASSWORD` | Repo | Android signing |
| `GOOGLE_PLAY_JSON_KEY` | Repo | Android release |
| `VSCE_PAT` | Repo | VS Code marketplace |
| `OPEN_VSX_TOKEN` | Repo | Open VSX Registry |
| `NX_CLOUD_AUTH_TOKEN` | Repo | Nx Cloud remote cache (free tier) |

Use **GitHub Environments** (`production`, `staging`) with environment-level secrets and required reviewers for App Store and Play Store releases. This creates a manual approval gate before production deployment.

---

## 12. Actionable CI/CD Recommendations for PomoFocus

### Priority 1 — Foundation (Set up first)
1. **Adopt pnpm workspaces + Nx** as the monorepo orchestrator. Add `nx.json` with target defaults for `build`, `test`, `lint` tasks and `project.json` in each app/package.
2. **Create `.github/workflows/detect-changes.yml`** using `dorny/paths-filter@v3` as a reusable step that all other workflows depend on via `needs:`.
3. **Set up Cloudflare Pages** deploy first — it is the fastest win. One action, posts preview URLs to every PR automatically.
4. **Add the `ci-complete` success gate job** to every workflow and configure it as the single required check in branch protection.

### Priority 2 — Mobile (After web CI is solid)
5. **Set up Fastlane Match** for iOS code signing. Store certificates in a private repo. Match eliminates the biggest iOS CI pain point (cert management).
6. **Use GitHub Environments** with required reviewers for App Store and Play Store production deploys — never deploy to stores automatically without a human in the loop.
7. **Use `workflow_dispatch`** for store releases, not automatic triggers. Add a `release_track` input (internal/beta/production) so you choose the target.

### Priority 3 — VS Code + Claude Agent
8. **Publish VS Code extension** on every push to `main` that changes `apps/vscode-extension/`. Use pre-release flag for non-tagged pushes.
9. **Add `claude-agent.yml`** to respond to `@claude` mentions. This is a force multiplier: mention Claude in a PR comment and it self-heals lint errors, writes tests, or refactors code.
10. **Add auto-lint-fix** as a `workflow_run` trigger so failing lint checks on PRs automatically trigger Claude to fix and re-push.

### Priority 4 — Optimization
11. **Connect Nx Cloud** via `npx nx connect` (free for solo developers). JS build times drop dramatically once remote cache warms — `NX_CLOUD_AUTH_TOKEN` in repo secrets is all that's needed.
12. **Add Supabase migration validation** to catch type drift between schema and generated TypeScript types before it reaches `main`.
13. **Create `CLAUDE.md`** at monorepo root with build commands for each platform. Claude Code needs this to understand how to run tasks in each app subdirectory during agentic CI runs.

---

## Source References

The following sources informed this document (based on knowledge through August 2025):

- **GitHub Actions Documentation** — https://docs.github.com/en/actions
- **Cloudflare Pages Action** — https://github.com/cloudflare/pages-action
- **Cloudflare Wrangler Action** — https://github.com/cloudflare/wrangler-action
- **Fastlane iOS Documentation** — https://docs.fastlane.tools/getting-started/ios/
- **Fastlane Android Documentation** — https://docs.fastlane.tools/getting-started/android/
- **Fastlane Match** — https://docs.fastlane.tools/actions/match/
- **VS Code Publishing Extensions** — https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **HaaLeo/publish-vscode-extension Action** — https://github.com/HaaLeo/publish-vscode-extension
- **Nx GitHub Actions Guide** — https://nx.dev/ci/intro/ci-with-github-actions
- **Nx Affected Command** — https://nx.dev/nx-api/nx/documents/affected
- **Nx Cloud** — https://nx.app
- **dorny/paths-filter Action** — https://github.com/dorny/paths-filter
- **Anthropic Claude Code Action** — https://docs.anthropic.com/en/docs/claude-code/github-actions
- **Supabase CLI GitHub Actions** — https://github.com/supabase/setup-cli
- **App Store Connect API** — https://developer.apple.com/documentation/appstoreconnectapi
- **Google Play Developer API** — https://developers.google.com/android-publisher
