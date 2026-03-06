# Technical Design Decisions

## Testing Frameworks

> **Date:** 2026-03-06
> **Status:** Accepted
> **Research:** [research/08-testing-frameworks.md](./research/08-testing-frameworks.md)

| Platform | Tool | Why |
|----------|------|-----|
| Next.js / React web (E2E) | **Playwright** | State of JS 2025: overtook Cypress in adoption (45%) and retention (94%); cross-browser; Next.js docs lead with it |
| Expo / React Native (E2E) | **Maestro** | Officially recommended by Expo; minimal setup; works with managed workflow; cloud testing option |
| VS Code extension (integration) | **@vscode/test-electron** | Microsoft's official standard; full extension host API access |
| Swift/SwiftUI (unit/integration) | **Swift Testing** | Apple WWDC 2024 official direction; modern macros; async-native; open-source |
| Swift/SwiftUI (UI automation) | **XCTest / XCUITest** | Still required — Swift Testing doesn't support UI automation yet |
| All TypeScript (unit/integration) | **Vitest** | 4-20x faster than Jest; native ESM and TypeScript; aligns with Vite ecosystem |
| HTTP API integration | **Vitest + Supertest** | Supertest provides clean HTTP assertion API; works with any runner |

| Visual regression (web) | **Playwright screenshots** | Built-in `toHaveScreenshot()`; free; no SaaS dependency; escalate to Percy/Chromatic if team review dashboard needed |
| Visual regression (mobile) | **React Native Owl** (deferred) | Purpose-built for RN; set up when mobile UI stabilizes |
| Accessibility (web) | **axe-core + @axe-core/playwright** | Industry standard; zero false positives; WCAG 2.2; Playwright-native |
| Accessibility (mobile) | **axe DevTools Mobile** (deferred) | Deque's RN tooling via Appium; set up when mobile E2E infra exists |
| API contract testing | **Pact** (deferred) | ThoughtWorks ADOPT tier; consumer-driven; set up when Cloudflare Workers API layer exists |
| Schema drift detection | **Supabase type generation** | `npx supabase gen types typescript` in CI; catches DB schema drift from day one |
| Code coverage | **Vitest v8 + ratchet pattern** | 75% threshold (Google "commendable"); ratchet up quarterly; `@vitest/coverage-v8` |

All Apple targets (macOS, iOS widget, watchOS) use `xcodebuild test` as the test runner, which executes both Swift Testing and XCTest tests in the same run.

Items marked **(deferred)** are researched and decided but will be set up when their prerequisites exist. The `/pre-finalize` skill gracefully skips these until infrastructure is in place.
