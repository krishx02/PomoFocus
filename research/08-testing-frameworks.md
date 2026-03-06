# Testing Framework Recommendations: Expert Synthesis

> **Note:** This document synthesizes expert recommendations, official documentation, survey data, and community consensus for testing frameworks across all PomoFocus target platforms as of early 2026. Source links point to real, known URLs — cross-check before citing as current.

---

## TL;DR

The testing tool landscape has shifted significantly in 2024-2026. **Playwright** has overtaken Cypress as the dominant web E2E framework. **Maestro** has emerged as the Expo-recommended mobile E2E tool, displacing Detox. Apple's **Swift Testing** framework (WWDC 2024) is the new standard for Swift unit/integration tests, though **XCTest** remains required for UI automation. **Vitest** has become the preferred test runner for modern TypeScript projects, outperforming Jest by 4-20x. VS Code extension testing remains standardized on Microsoft's **@vscode/test-electron**.

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
