---
paths:
  - "native/**"
  - "apps/mobile/targets/**"
---

# Swift Native Standards

Source: research/coding-standards.md Section 4a

- **NAT-S01:** Follow Apple's Swift API Design Guidelines: clarity over brevity, argument labels read as grammar, factory methods use `make` prefix, protocols use `-able`/`-ible` or nouns.
- **NAT-S02:** Use Swift Testing framework (`@Test`, `#expect`, `#require`) for new tests — not `XCTestCase`. Swift Testing supports parameterized tests, parallel execution, and Swift concurrency.
- **NAT-S03:** Widget views must be cheap. Only read from `TimelineProvider` entries (which read from App Group `UserDefaults`). No network calls, no database reads, no heavy computation. WidgetKit limits: 30MB memory, 5s time.
- **NAT-S04:** `WidgetKeys` constants must be identical in `widget-keys.ts` and `WidgetKeys.swift`. A key mismatch means the widget silently shows stale data. `/align-repo` checks drift.
- **NAT-S05:** Use `AppIntentConfiguration` (iOS 17+) for widget configuration — never legacy `IntentConfiguration` or `StaticConfiguration`.
