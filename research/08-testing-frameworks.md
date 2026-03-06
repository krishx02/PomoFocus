# Testing Framework Recommendations: Expert Synthesis

> **Note:** This document synthesizes expert recommendations, official documentation, survey data, and community consensus for testing frameworks across all PomoFocus target platforms as of early 2026. Source links point to real, known URLs — cross-check before citing as current.

---

## TL;DR

The testing tool landscape has shifted significantly in 2024-2026. **Playwright** has overtaken Cypress as the dominant web E2E framework. **Maestro** has emerged as the Expo-recommended mobile E2E tool, displacing Detox. Apple's **Swift Testing** framework (WWDC 2024) is the new standard for Swift unit/integration tests, though **XCTest** remains required for UI automation. **Vitest** has become the preferred test runner for modern TypeScript projects, outperforming Jest by 4-20x. VS Code extension testing remains standardized on Microsoft's **@vscode/test-electron**.

Beyond the core E2E/integration layer: **Playwright screenshots** handle visual regression for web (with Percy available for team review workflows). **axe-core** (via `@axe-core/playwright`) is the industry standard for automated accessibility testing with zero false positives. **Pact** is the ThoughtWorks "Adopt"-tier tool for API contract testing between clients and backend. Code coverage should use **Vitest's v8 provider** with a ratchet pattern starting at 75%.

**Summary table:**

| Platform | E2E / Integration Tool | Unit Test Runner | Key Evidence |
|----------|----------------------|------------------|--------------|
| Next.js / React web | Playwright | Vitest | State of JS 2025: 45% adoption, 94% retention |
| Expo / React Native | Maestro | Vitest (via Expo) | Expo official docs recommend Maestro |
| VS Code extension | @vscode/test-electron | Vitest | Microsoft official standard |
| macOS menu bar widget | XCUITest (via xcodebuild) | Swift Testing | Apple WWDC 2024 direction |
| iOS home screen widget | XCUITest (via xcodebuild) | Swift Testing | Apple WWDC 2024 direction |
| watchOS app | XCUITest (via xcodebuild) | Swift Testing | Apple WWDC 2024 direction |
| MCP server (Node.js) | Vitest (integration) | Vitest | 4-20x faster than Jest, native ESM |
| Shared packages | Vitest | Vitest | Consistent with all TS consumers |

---

## 1. Next.js / React Web — Playwright

### Contenders

1. **Playwright** (Microsoft) — cross-browser, auto-wait, native TypeScript
2. **Cypress** (Cypress.io) — developer-friendly, Chrome-focused, declining
3. **WebdriverIO** — W3C WebDriver protocol, enterprise use cases

### Expert Recommendations

**Next.js Official Docs:** Next.js documents both Playwright and Cypress as supported E2E options, but Playwright is more prominently featured in current documentation and examples.

**State of JavaScript 2025 Survey:** Playwright has overtaken Cypress as the most-used E2E framework. Playwright shows 45.1% adoption among QA professionals with 94% retention (satisfaction). Cypress has experienced what the survey describes as a "steep decline in popularity" and is now the slowest of all E2E testing frameworks in JavaScript, resulting in longer CI runtimes.

**ThoughtWorks Technology Radar (2025):** Both Playwright and Cypress are in the "Adopt" ring. Playwright is praised for stability via Chrome DevTools Protocol, auto-waits, and parallel test execution. However, ThoughtWorks notes that teams increasingly prefer Playwright's cross-browser capabilities (Chromium, Firefox, WebKit) over Cypress's Chrome-only default.

**Kent C. Dodds:** Has recommended Playwright for its reliability and cross-browser coverage in modern React applications, noting its superior handling of async operations compared to Cypress.

### Decision

**Playwright.** It has overtaken Cypress in adoption and retention, runs faster in CI, supports all browser engines, has native TypeScript support, and is the framework Next.js documentation leads with. The cross-browser coverage (including WebKit/Safari) is critical for a consumer-facing web app.

### Sources

- [Testing | Next.js](https://nextjs.org/docs/app/guides/testing)
- [State of JavaScript 2025: Testing](https://2025.stateofjs.com/en-US/libraries/testing/)
- [Playwright | ThoughtWorks Technology Radar](https://www.thoughtworks.com/radar/languages-and-frameworks/playwright)
- [Cypress | ThoughtWorks Technology Radar](https://www.thoughtworks.com/radar/tools/cypress)

---

## 2. Expo / React Native Mobile — Maestro

### Contenders

1. **Maestro** (mobile.dev) — black-box, YAML-based flows, cloud option
2. **Detox** (Wix) — gray-box, React Native lifecycle sync, complex setup
3. **Appium** (OpenJS Foundation) — W3C WebDriver, legacy, slow

### Expert Recommendations

**Expo Official Documentation:** Expo's docs explicitly feature Maestro for E2E testing and provide first-class CI/CD integration via EAS Workflows. The official example for "Run E2E tests on EAS Workflows" uses Maestro exclusively.

**Jupiter Money Engineering (Case Study):** After evaluating both Maestro and Detox, their engineering team chose Maestro, finding that "Detox offers deep integration with React Native, its heavier setup, higher learning curve, and flakiness made it less practical for our needs." They specifically cited Maestro's minimal setup time and reliability in CI as deciding factors.

**Technical Comparison:**
- **Maestro:** Black-box testing (works with bundled apps like real users), YAML-based test definitions, near-instant setup, no app code changes required, cloud testing available via Maestro Cloud
- **Detox:** Gray-box (runs inside app process), synchronizes with React Native's JavaScript thread for reduced flakiness in theory, but requires native build configuration, Metro bundler awareness, and significant setup expertise
- **Appium:** Most flexible (cross-platform, cross-framework) but slowest execution, heaviest infrastructure, and highest maintenance burden

### Decision

**Maestro.** It is officially recommended by Expo, requires minimal setup, works with the Expo managed workflow (no ejection needed), supports both iOS and Android from the same YAML flows, and has a cloud testing option. Detox remains a viable alternative if sub-millisecond synchronization with the React Native lifecycle becomes necessary, but Maestro's reliability and simplicity win for our use case.

### Sources

- [Run E2E tests on EAS Workflows and Maestro — Expo Documentation](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Choosing between Maestro and Detox — Jupiter Money](https://life.jupiter.money/choosing-between-maestro-and-detox-on-jupiter-qa-automation-7b94e6f8759d)
- [Detox vs Maestro: Comparing Modern Mobile Testing Frameworks](https://www.getpanto.ai/blog/detox-vs-maestro)

---

## 3. VS Code Extensions — @vscode/test-electron

### Contenders

1. **@vscode/test-electron** (Microsoft) — official, runs in extension host
2. **@vscode/test-web** (Microsoft) — for web-only extensions
3. **WebdriverIO + VS Code plugin** — Electron-level UI automation

### Expert Recommendations

**VS Code Team (Official):** Microsoft's extension testing documentation specifies `@vscode/test-electron` as the standard approach. Tests run inside the VS Code extension host with full access to the VS Code API. The package handles downloading, unzipping, and launching the correct VS Code version for test execution.

**Architecture:** `@vscode/test-electron` launches a real VS Code instance with the extension loaded, running tests in Mocha by default. This provides full API access and realistic integration testing. `@vscode/test-web` serves the same purpose for extensions targeting VS Code for the Web.

**WebdriverIO escalation path:** For extensions with complex custom WebView UIs, WebdriverIO's VS Code plugin can automate the full Electron application like any desktop app. This is only necessary when extension host tests cannot cover the UI layer.

### Decision

**@vscode/test-electron.** It is the official Microsoft standard, provides full API access, and is used by the vast majority of published extensions. We will escalate to WebdriverIO only if the PomoFocus extension develops complex custom WebView UIs that require Electron-level automation.

### Sources

- [Testing Extensions | Visual Studio Code Extension API](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [@vscode/test-electron — npm](https://www.npmjs.com/package/@vscode/test-electron)

---

## 4. Swift / SwiftUI (macOS, iOS Widget, watchOS) — Swift Testing + XCTest

### Contenders

1. **Swift Testing** (Apple, 2024) — modern macros, async-native, open-source
2. **XCTest** (Apple, legacy) — mature, UI automation support
3. **Quick/Nimble** — BDD-style, community-maintained, declining

### Expert Recommendations

**Apple WWDC 2024:** Apple officially introduced Swift Testing as the modern replacement for XCTest unit tests. It ships with Xcode 16+ and is open-source. Two WWDC sessions — "Meet Swift Testing" and "Go further with Swift Testing" — establish it as Apple's forward direction.

**Key advantages over XCTest:**
- Modern Swift syntax using `@Suite`, `@Test`, and `#expect` macros (vs. XCTestCase inheritance and 40+ assertion methods)
- Native concurrency support (async/await first-class)
- Parameterized tests built-in
- Cleaner, more informative error messages
- Open-source and cross-platform (Linux, Windows)

**Current limitation:** Swift Testing does not yet support UI automation (`XCUIApplication`) or performance metrics (`XCTMetric`). XCTest remains the only option for UI tests and performance benchmarks.

**Quick/Nimble:** These third-party BDD frameworks have seen declining adoption since Swift Testing's introduction. They filled a gap that Apple has now officially addressed.

### Decision

**Swift Testing for unit and integration tests** (business logic, timer state, data models). **XCTest/XCUITest for UI automation** (widget rendering, menu bar interactions). Both frameworks run side-by-side in the same test target — this is Apple's recommended migration strategy. Quick/Nimble are not needed.

All three Apple targets (macOS menu bar, iOS widget, watchOS app) use `xcodebuild test` as the test runner, which executes both Swift Testing and XCTest tests.

### Sources

- [Meet Swift Testing — WWDC24](https://developer.apple.com/videos/play/wwdc2024/10179/)
- [Go further with Swift Testing — WWDC24](https://developer.apple.com/videos/play/wwdc2024/10195/)
- [Swift Testing vs. XCTest — Infosys](https://blogs.infosys.com/digital-experience/mobility/swift-testing-vs-xctest-a-comprehensive-comparison.html)

---

## 5. Node.js / MCP Server / Shared Packages — Vitest

### Contenders

1. **Vitest** (Vite team) — native ESM, TypeScript out-of-box, fast
2. **Jest** (Meta) — mature ecosystem, enterprise standard, slower
3. **Node.js built-in test runner** — minimal, no dependencies, limited

### Expert Recommendations

**Performance benchmarks:** Vitest is consistently measured at 4x faster than Jest on cold runs, with reports of 10-20x speedup on large codebases. Memory usage is ~30% lower. These numbers come from multiple independent benchmarks (Better Stack, Medium engineering blogs).

**Architecture difference:**
- **Vitest:** Built on Vite's module transformation pipeline, native ESM, TypeScript without configuration, reuses the Vite dev server's module graph for near-instant re-runs in watch mode
- **Jest:** Isolated Node.js VM environments per test file, requires Babel or ts-jest for TypeScript transpilation, custom module resolution system that conflicts with ESM

**Jest 30 (June 2025):** Jest added substantial improvements including better ESM support, but still requires the `--experimental-vm-modules` flag for ESM and does not match Vitest's speed.

**Community consensus (2026):** Vitest is the default choice for new TypeScript projects. Jest remains appropriate for existing large codebases with deep Jest integration (custom transforms, module mappers) where migration cost is high.

**For HTTP API integration tests:** Use Vitest with **Supertest** for testing HTTP endpoints. Supertest works with any test runner and provides a clean API for asserting HTTP responses.

### Decision

**Vitest** for all TypeScript packages and apps: `packages/core`, `packages/api-client`, `apps/mcp-server`, `apps/vscode-extension` (unit tests alongside @vscode/test-electron for integration). It is dramatically faster, has native ESM and TypeScript support, and aligns with the Vite-based tooling ecosystem. Use Supertest alongside Vitest for HTTP API integration testing where applicable.

### Sources

- [Jest vs Vitest: Which Test Runner Should You Use in 2025?](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Vitest vs Jest | Better Stack](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [Vitest vs. Jest | Hacker News discussion](https://news.ycombinator.com/item?id=42245442)
- [Testing in 2026: Jest, React Testing Library, and Full Stack Testing Strategies](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies)

---

## 6. Visual Regression Testing — Playwright Screenshots

### Contenders

1. **Playwright built-in screenshots** — `toHaveScreenshot()`, free, no SaaS
2. **Chromatic** (Storybook team) — component-driven, Storybook-native, free for OSS
3. **Percy** (BrowserStack) — AI-powered diffing, team review workflow, 5k free screenshots/month
4. **Applitools Eyes** — enterprise AI diffing, premium pricing

### Expert Recommendations

**Playwright built-in:** Playwright's `toHaveScreenshot()` uses Pixelmatch for pixel-by-pixel comparison with configurable `maxDiffPixels` thresholds. Free, no third-party dependency, runs in CI natively. Best for developer-driven visual checks where a team review dashboard is not needed.

**Chromatic:** Built by the Storybook team. Zero-friction integration with Storybook; captures every story as a visual test automatically. Free for open-source projects. Includes Page Shift Detection to reduce false positives. Best choice if you're already using Storybook for component development.

**Percy:** AI-powered diffing reduces false positives from font rendering, anti-aliasing, and dynamic content. AI Visual Review Agent (launched late 2025) filters ~40% of false positives automatically and reduces review time by 3x. Free tier: 5,000 screenshots/month. Best for team workflows with design review.

**React Native / Mobile:** React Native Owl (Formidable Labs/NearForm) provides visual regression testing for React Native on iOS and Android. For native Apple targets (SwiftUI), visual testing is limited to Xcode previews and manual screenshot comparison — no mature third-party tooling exists.

### Decision

**Playwright screenshots** for web E2E visual regression — free, CI-native, no external dependency. Escalate to **Percy** or **Chromatic** later if the team needs a visual review dashboard or AI-powered false-positive reduction. For mobile, defer to **React Native Owl** when the mobile app has stable UI. For Apple native targets, rely on Xcode previews and manual review — the surface area (menu bar widget, iOS widget, watch complication) is small enough that automated visual regression is not cost-effective yet.

### Sources

- [Visual comparisons | Playwright](https://playwright.dev/docs/test-snapshots)
- [Visual tests | Storybook docs](https://storybook.js.org/docs/writing-tests/visual-testing)
- [Percy vs Chromatic | Medium](https://medium.com/@crissyjoshua/percy-vs-chromatic-which-visual-regression-testing-tool-to-use-6cdce77238dc)
- [Best Visual Regression Testing Tools for 2026 | Bug0](https://bug0.com/knowledge-base/visual-regression-testing-tools)
- [GitHub: FormidableLabs/react-native-owl](https://github.com/FormidableLabs/react-native-owl)

---

## 7. Accessibility Testing — axe-core + @axe-core/playwright

### Contenders

1. **axe-core** (Deque Systems) — industry standard, zero false positives, open-source engine
2. **Pa11y** — open-source CLI, built on axe-core, used by UK Gov Digital Service
3. **Lighthouse** (Google) — built into Chrome DevTools, accessibility + performance audits

### Expert Recommendations

**axe-core (Deque Systems):** Detects ~57% of accessibility issues automatically with **zero false positives** — critical for CI pipelines where false positives block merges. Supports WCAG 2.1 AA, WCAG 2.2, Section 508, ADA standards. The `@axe-core/playwright` package provides an `AxeBuilder` class that integrates directly with Playwright tests for automated CI validation.

**Pa11y:** Open-source, CLI-first, built on the same axe-core engine. Used by UK Government Digital Service. Optimized for large-scale automated scanning. Good alternative if you prefer CLI over Playwright integration.

**Lighthouse:** Built into Chrome DevTools — zero setup for quick developer checks. Includes accessibility scoring alongside performance. Less comprehensive than axe-core but good for catching obvious issues during development.

**ThoughtWorks Technology Radar (2025):** "Intelligent guided accessibility tests" are in the Assess ring — the radar recommends integrating automated accessibility checks into CI pipelines as standard practice.

**Regulatory context:** The European Accessibility Act (EAA) took effect June 2025. EU businesses now face legal obligations for digital accessibility, with fines reaching hundreds of thousands of euros. This makes automated accessibility testing a compliance requirement, not just a best practice.

**Critical limitation:** No automated tool catches more than ~40% of accessibility issues. Automated tools handle structural/HTML issues; manual testing is still required for screen reader behavior, keyboard navigation flow, color contrast perception, and cognitive load. The recommended approach: one automated tool in CI + periodic manual keyboard/screen reader spot-checks.

### Decision

**axe-core via `@axe-core/playwright`** for web accessibility in CI — zero false positives, Playwright-native, WCAG 2.2 compliant. For React Native mobile, **axe DevTools Mobile** (Deque) via Appium when mobile E2E infrastructure is mature. For Apple native targets, rely on **XCTest accessibility assertions** + manual VoiceOver testing. Run Lighthouse as an optional developer check, not a CI gate.

### Sources

- [Accessibility testing | Playwright](https://playwright.dev/docs/accessibility-testing)
- [Best Free Accessibility Testing Tools Compared | inclly](https://inclly.com/resources/accessibility-testing-tools-comparison)
- [axe DevTools for Mobile — React Native | Deque Docs](https://docs.deque.com/devtools-mobile/2025.7.2/en/react-native/)
- [Intelligent guided accessibility tests | ThoughtWorks Tech Radar](https://www.thoughtworks.com/radar/techniques/intelligent-guided-accessibility-tests)

---

## 8. API Contract Testing — Pact

### Contenders

1. **Pact** — consumer-driven contracts, multi-language, PactFlow broker
2. **OpenAPI + Prism** — specification-first validation, mock servers
3. **Dredd** — validates API against OpenAPI/Swagger specs

### Expert Recommendations

**ThoughtWorks Technology Radar (2025):** Consumer-Driven Contract Testing is ADOPT tier. Pact is the recommended tool; PactFlow (managed broker) lowers barriers for complex API ecosystems.

**Martin Fowler:** Consumer-driven contracts enable autonomous teams — providers fetch and run consumer tests in their pipeline to catch breaking changes immediately. Contract tests are most valuable when services are being defined, as consumers drive API design by expressing their needs as tests.

**Modern approach (bi-directional testing):** Provider publishes OpenAPI spec to PactFlow; consumers publish Pact files. Both are validated together — no manual API test code needed in provider. PactFlow now offers AI-assisted test generation from natural language prompts.

**For Supabase specifically:** No dedicated contract testing tooling exists. The recommended pattern:
1. **Type generation from schema:** `npx supabase gen types typescript` regenerates TypeScript types from the database schema. Run in CI (nightly or on migration changes) to catch schema drift.
2. **Pact contracts** for the layer between clients (iOS/web/Android) and Cloudflare Workers (the API edge).
3. **OpenAPI + Prism** for mocking the Cloudflare Workers layer during development.

### Decision

**Pact** for consumer-driven contracts between mobile/web clients and Cloudflare Workers. **Supabase type generation** in CI (via GitHub Actions) to catch database schema drift. Defer Pact setup until the Cloudflare Workers API layer exists — before that, there are no contracts to test. Start with type generation from day one.

### Sources

- [Consumer-Driven Contract Testing | ThoughtWorks Tech Radar](https://www.thoughtworks.com/radar/techniques/consumer-driven-contract-testing)
- [Martin Fowler: Consumer-Driven Contracts](https://martinfowler.com/articles/consumerDrivenContracts.html)
- [Generating TypeScript Types | Supabase Docs](https://supabase.com/docs/guides/api/rest/generating-types)
- [Pact Open Source Update — May 2025](https://docs.pact.io/blog/2025/05/28/pact-open-source-update-may-2025)

---

## 9. Code Coverage — Vitest v8 Provider + Ratchet Pattern

### Expert Recommendations on Thresholds

**Google (2019 research paper):** 60% = acceptable, 75% = commendable, 90% = exemplary. Measured at changeset level during code review across 1 billion lines of code.

**Martin Fowler:** Coverage is a diagnostic metric, not a quality gate. 100% coverage does not guarantee quality. Recommends 60-80% as a practical range, with the understanding that the number itself matters less than the trend.

**Kent C. Dodds:** Recommends 70-80% pragmatically. Key advice: "Write tests. Not too many. Mostly integration." Measure where you are now, set the threshold 5% below current, and increase quarterly. Focus on integration tests over unit tests for maximum confidence-per-line-of-test-code.

### Vitest Coverage Setup

**Provider choice:** Vitest supports both v8 (Chrome V8 engine coverage) and Istanbul (instrumentation-based). Since Vitest v3.2.0, AST-based coverage remapping makes v8 identical in accuracy to Istanbul. **Use v8** — it's faster.

### The Ratchet Pattern

Instead of a fixed threshold that incentivizes bogus tests, use a ratchet: the threshold can only go up, never down.

1. Measure current coverage (e.g., 50%)
2. Set CI threshold to 45% (5% below current)
3. As teams improve coverage, the threshold follows
4. Future PRs must maintain or exceed the threshold

This prevents silent regression while avoiding the anti-pattern of writing assertion-free tests to hit an arbitrary number.

**Tools:** `jest-ratchet` / `jest-coverage-ratchet` (adaptable to Vitest), SonarCloud quality gates, or a custom GitHub Action that compares PR coverage to the main branch.

### Decision

**Vitest v8 provider** (`@vitest/coverage-v8`) for all TypeScript packages. Start with **75% lines / 75% functions / 75% statements / 70% branches** as initial thresholds (Google's "commendable" tier). Adopt the **ratchet pattern** — once coverage exceeds the threshold, ratchet it up quarterly. Enforce in CI via `vitest run --coverage` with thresholds in `vitest.config.ts`.

### Sources

- [Coverage | Vitest Guide](https://vitest.dev/guide/coverage.html)
- [Martin Fowler: Test Coverage](https://martinfowler.com/bliki/TestCoverage.html)
- [Google Testing Blog: Code Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)
- [Kent C. Dodds: Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)
- [Ratchets in software development | qntm.org](https://qntm.org/ratchet)
