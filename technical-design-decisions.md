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

All Apple targets (macOS, iOS widget, watchOS) use `xcodebuild test` as the test runner, which executes both Swift Testing and XCTest tests in the same run.
