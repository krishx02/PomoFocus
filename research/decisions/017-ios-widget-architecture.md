# ADR-017: iOS Widget Architecture

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 3 (Component — WidgetKit integration within iOS platform)
**Platforms:** iOS home screen widget, iOS lock screen widget

## Context and Problem Statement

The Expo/React Native app needs an iOS home screen and lock screen widget that displays glanceable stats (Tier 1 + selected Tier 2 metrics per ADR-014). WidgetKit widgets are native Swift — they run in a separate process and cannot execute JavaScript or React Native code. The core challenge is: how does a TS/RN app share data with a Swift widget, and how do we give users control over what their widget displays?

## Decision Drivers

- **User customization** — users should choose which stat their widget displays (goal progress, weekly dots, streak, completion rate)
- **Simplicity and reliability** — fewest moving parts, predictable behavior
- **Expo managed workflow compatibility** — must work with CNG (`expo prebuild`), EAS Build, and survive `prebuild --clean`
- **No live timer** — avoid inconsistency with BLE device; widget shows cached stats, not real-time countdown
- **$0 budget**

## Considered Options

1. `@bacons/apple-targets` + App Group UserDefaults
2. `expo-widgets` (Expo's alpha library)
3. `@bacons/apple-targets` + App Group MMKV

## Decision Outcome

Chosen option: **"`@bacons/apple-targets` + App Group UserDefaults"**, because it is the only option that supports `AppIntentConfiguration` (user customization), uses Apple's recommended data sharing mechanism for widgets, is endorsed by Expo's own blog, and works with managed workflow + CNG.

### Widget Sizes

- **Small** — single stat (user's choice via `AppIntentConfiguration`)
- **Medium** — up to 4 stats or weekly dots visualization
- **Lock Screen (Accessory)** — single number or small graphic (streak, progress ring)
- **Large** — not supported. A full dashboard belongs in the app.

### Configurable Stats (via AppIntentConfiguration)

Users choose which metric to display per widget instance via the Edit Widget sheet — Tier 1 stats (ADR-014) plus selected Tier 2 metrics like completion rate:

- Today's goal progress (e.g., "3/5 sessions")
- Weekly dots (7-day completion visualization)
- Current streak (consecutive days)
- Completion rate (percentage)

### Data Flow

1. Expo app computes widget stats (Tier 1 + selected Tier 2, received from Hono API per ADR-007/ADR-014)
2. RN native module writes stats to App Group shared `UserDefaults` (keyed by `WidgetKeys` constants)
3. RN native module calls `WidgetCenter.shared.reloadAllTimelines()` to trigger widget refresh
4. Swift widget's `TimelineProvider` reads from shared `UserDefaults`, renders based on user's `AppIntentConfiguration` selection

### Cross-Language Type Safety

Define `WidgetKeys` constants in both languages — `widget-keys.ts` and `WidgetKeys.swift`. The `/align-repo` skill checks that both files define the same keys. If the contract grows beyond ~10 keys, upgrade to JSON schema codegen.

### Live Activity

Not included for v1. Live Activity uses ActivityKit (separate from WidgetKit) and would show a timer countdown on the lock screen / Dynamic Island during active sessions. Deferred to avoid inconsistency with the BLE device and to keep scope tight. Can be added later as a separate feature — no architectural dependency on this decision.

### Consequences

- **Good:** Full WidgetKit power — all size classes, `AppIntentConfiguration`, interactive widgets (iOS 17+), standard Apple patterns. Expo-endorsed approach. Widget is an isolated Swift target — easy to replace if `expo-widgets` matures.
- **Bad:** Widget code is pure Swift — no hot reload, slower iteration (prebuild + Xcode build). String-keyed UserDefaults boundary between TS and Swift has no compiler-enforced type safety — mitigated by shared constant files and `/align-repo`.
- **Neutral:** `@bacons/apple-targets` is labeled "experimental" by its author (Evan Bacon, Expo core team). However, it's the most mature community solution and is demonstrated in Expo's official blog.

## Pros and Cons of the Options

### `@bacons/apple-targets` + App Group UserDefaults

- Good, because it supports `AppIntentConfiguration` for user-customizable widgets (the #1 priority)
- Good, because UserDefaults is Apple's recommended mechanism for widget data sharing — simple, reliable, well-documented
- Good, because Expo's official blog demonstrates this exact pattern
- Good, because widget Swift files live outside `/ios` directory, surviving `expo prebuild --clean`
- Bad, because widget development has no hot reload — every change requires prebuild + Xcode compile
- Bad, because a small Expo native module (~50 lines) is needed to bridge RN → App Group UserDefaults
- Bad, because `@bacons/apple-targets` is labeled "experimental" (though widely used)

### `expo-widgets` (alpha)

- Good, because no Swift code is needed — widgets are written with Expo UI components
- Good, because setup is simplest — just install the package
- Good, because App Group data sharing is built in via `groupIdentifier` config
- Bad, because it is **alpha** — subject to breaking changes, API instability
- Bad, because it does **not support `AppIntentConfiguration`** — users cannot customize which stat the widget shows (blocks the #1 decision driver)
- Bad, because advanced WidgetKit features (custom layouts per size class, SF Symbols, interactive widgets) are not accessible

### `@bacons/apple-targets` + App Group MMKV

- Good, because MMKV is already the mobile app's persistence choice (ADR-003) — single storage layer
- Good, because MMKV has faster read/write than UserDefaults (binary encoding)
- Bad, because linking MMKV's C++ core into the widget extension target adds Podfile configuration and build complexity
- Bad, because widget extensions have a ~30MB memory limit — MMKV adds overhead for no benefit at this data scale (~200 bytes of Tier 1 stats)
- Bad, because MMKV shared container debugging is harder than UserDefaults when the widget shows stale data

## Research Sources

- [How to implement iOS widgets in Expo apps — Expo Blog](https://expo.dev/blog/how-to-implement-ios-widgets-in-expo-apps)
- [Home screen widgets and Live Activities in Expo — Expo Blog](https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo)
- [expo-widgets — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/widgets/)
- [Making a configurable widget — Apple Developer Documentation](https://developer.apple.com/documentation/widgetkit/making-a-configurable-widget)
- [Keeping a widget up to date — Apple Developer Documentation](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- [Building Interactive Widgets in Expo-Managed React Native Apps](https://www.peterarontoth.com/posts/interactive-widgets-in-expo-managed-workflows)
- [Use MMKV in iOS Widget with React Native Expo](https://akshayjadhav.hashnode.dev/how-to-access-react-native-mmkv-in-a-ios-widget-react-native-expo)

## Related Decisions

- [ADR-014](./014-analytics-insights-architecture.md) — Defines Tier 1 stats that the widget displays
- [ADR-007](./007-api-architecture.md) — API that serves the stats data
- [ADR-003](./003-client-state-management.md) — MMKV persistence in mobile app (evaluated but not chosen for widget)
- [ADR-001](./001-monorepo-package-structure.md) — Widget target lives in `apps/mobile/targets/ios-widget/` (follows `@bacons/apple-targets` convention)
