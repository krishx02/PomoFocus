# PomoFocus Tech Stack Research — 2025/2026 Community Consensus

> Synthesized from community discussions, benchmark reports, official documentation, and developer surveys through mid-2025.
> WebSearch/WebFetch unavailable in this session; all findings are from training knowledge (cutoff August 2025).
> All source links are included at section level for independent verification.

---

## TL;DR — Recommended Stack Decision

| Layer | Recommended Choice | Runner-Up |
|---|---|---|
| Database & Sync | **Supabase** (Postgres + Realtime) | PocketBase (self-hosted) |
| Hosting/Edge | **Cloudflare Workers** (sync API) + **Railway** (long-lived processes) | Vercel (web frontend only) |
| Auth | **Supabase Auth (MVP)** → Better Auth (later) | Clerk |
| Mobile (iOS/Android) | **Expo / React Native** | Flutter |
| Mac Widget | **SwiftUI** (native) + thin JS bridge | Tauri |
| VS Code Extension | **Standard VS Code Extension API** with shared `@pomofocus/core` package | — |
| BLE Backend | **react-native-ble-plx** (mobile) + **Web Bluetooth API** (web) | Noble (Node.js) |
| Monorepo | **Nx** | Turborepo |
| Claude Code Extension | **MCP Server** (Model Context Protocol) | — |

**One-sentence verdict:** Use Supabase for the database and auth (MVP), Cloudflare Workers for the sync edge, Expo for mobile, SwiftUI for the Mac widget, Nx as the monorepo tool, and an MCP server for the Claude Code integration — then migrate auth to Better Auth when Supabase's vendor lock-in becomes a concern.

---

## 1. Database — Supabase vs Alternatives

### The Question
For a sync-heavy multi-platform Pomodoro app, the database needs to handle: offline-first local state, real-time cross-device sync, row-level access control per user, and a subscription paywall.

### Supabase (Recommended)

**What it is:** Hosted Postgres with a REST + GraphQL API, real-time subscriptions via WebSockets, Storage, Edge Functions, and Row Level Security (RLS).

**Pros:**
- **Realtime v2 (Broadcast + Presence + Postgres Changes):** Supabase Realtime now supports three channels: Broadcast (ephemeral pub/sub), Presence (who is online), and Postgres Changes (CDC-based row-level events). For a Pomodoro app this means a session change on iOS instantly propagates to the VS Code extension and web dashboard.
- **Row Level Security is first-class:** You can enforce `user_id = auth.uid()` directly in the DB, making the subscription tier enforcement reliable and auditable without application-layer logic.
- **Subscription paywall integration:** A `subscriptions` table with RLS policies is the standard pattern. Features gated on subscription status use a Postgres function called from RLS — no client-side trust required.
- **Offline support via local-first libraries:** Supabase works well with ElectricSQL or PowerSync layered on top to handle offline-first conflict resolution. Both have Expo/React Native SDKs.
- **TypeScript SDK maturity:** `@supabase/supabase-js` v2 is the most used BaaS SDK in the JavaScript ecosystem. Type generation via `supabase gen types` is first-class.
- **Self-hostable:** Supabase is open source (Apache 2). You can move to self-hosted if costs escalate.

**Cons:**
- **Realtime connection limits on free/pro tier:** The free tier allows 200 concurrent Realtime connections. At scale, Realtime becomes expensive. Each active user session (iOS + web + VS Code open) counts as multiple connections.
- **Cold start / connection pooling:** Supabase uses PgBouncer, but for serverless edge functions, connection pool exhaustion under spiky load is a known pain point. Use Supavisor (their newer pooler) or connect via the REST API rather than direct Postgres connections from edge.
- **Vendor lock-in risk:** RLS policies and Supabase-specific auth functions (`auth.uid()`) are not portable to raw Postgres without migration work.
- **No native CRDT / conflict resolution:** If two devices edit the same timer session offline and both come back online, Supabase has no built-in conflict resolution. You must implement last-write-wins, vector clocks, or use ElectricSQL/PowerSync which handle this.

### Alternatives Considered

**PocketBase**
- Single Go binary, self-hosted, embedded SQLite, built-in realtime.
- Excellent for indie projects and side projects.
- Cons: No managed hosting (you run it), SQLite limits horizontal scale, smaller ecosystem.
- Verdict: Great for solo dev or MVP, not recommended once you want managed multi-region sync.

**Firebase / Firestore**
- Excellent offline-first and real-time story, built-in conflict resolution.
- Cons: NoSQL document model is awkward for relational session/task data. Vendor lock-in is severe. Pricing at scale is punishing. Community sentiment in 2025 has shifted heavily toward Supabase.

**Turso (libSQL)**
- Embedded SQLite at the edge, very low latency reads.
- Cons: No built-in realtime subscriptions, no managed auth, still maturing.

**PowerSync + Any Postgres**
- PowerSync is a sync layer that sits in front of any Postgres DB, handles offline-first CRDT-style sync on mobile/web.
- A strong complement to Supabase, not a replacement. Worth evaluating for the offline-first story.

### Recommendation
Use **Supabase** as the primary database. Add **PowerSync** as the sync/offline layer for mobile and web clients if offline-first is a hard requirement. Use Supabase RLS for subscription enforcement.

**Sources:**
- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/guides/auth/row-level-security
- https://www.powersync.com/blog/powersync-supabase
- https://electric-sql.com/docs

---

## 2. Hosting / Edge — Cloudflare Workers vs Vercel vs Railway

### The Requirements
- Serve real-time sync WebSocket connections (long-lived, stateful)
- Handle BLE device webhooks / firmware update delivery
- Serve the web frontend
- Run subscription billing webhooks (Stripe)

### Cloudflare Workers + Durable Objects (Recommended for sync)

**Pros:**
- **Durable Objects are the right primitive for real-time sync:** A Durable Object is a stateful serverless unit with a built-in WebSocket hibernation API. Each user's sync session can be a single Durable Object, meaning the WS connection survives across the global Cloudflare network edge with consistent state. This is the architecture that companies like Liveblocks and PartyKit use.
- **Global edge, sub-10ms latency worldwide:** CF has 300+ PoPs. For a sync app used globally, this matters.
- **Workers KV for caching:** Timer state snapshots cacheable at edge without hitting Supabase.
- **Zero cold starts:** Workers use V8 isolates, not containers. Startup is ~0ms.
- **Cost:** Extremely cheap for moderate traffic. Workers free tier is 100k requests/day.

**Cons:**
- **Durable Objects pricing:** DO storage + compute gets expensive under heavy real-time load. Plan for this in the subscription pricing.
- **CPU time limits:** Workers have a 30ms CPU time limit per request (extendable with Unbound). Long-running sync logic must be structured carefully.
- **No long-running Node.js processes:** Cannot run a persistent BLE gateway daemon on CF Workers. This requires Railway or a VPS.
- **Limited Node.js API compatibility:** CF Workers run in a restricted runtime (though `nodejs_compat` flag in 2025 covers most use cases).

### Vercel

**Best for:** Hosting the Next.js/React web frontend. Vercel's DX is unmatched for frontend deployment.

**Cons for this use case:**
- **No Durable Objects equivalent:** Vercel has no stateful WebSocket primitive. You'd delegate real-time to a third-party (Pusher, Ably, Supabase Realtime) rather than owning it.
- **Cold starts on Fluid compute (2025):** Vercel's new Fluid compute reduces cold starts but doesn't eliminate them for long-lived WS connections.
- **Edge Functions are stateless:** Cannot maintain WS connections across requests.

**Verdict:** Use Vercel for the web frontend only. Do not use it as the real-time sync backend.

### Railway

**Best for:** Long-running processes that CF Workers cannot host — specifically a BLE device gateway daemon, background job workers, and any Node.js service needing full process lifetime.

**Pros:**
- Persistent containers with persistent disk.
- Deploy any Docker image or Nixpacks auto-detected service.
- Private networking between services (Redis, Postgres sidecar, etc.).
- Simple pricing ($5/month hobby tier).

**Cons:**
- No edge network (single region or limited multi-region as of 2025).
- Not suitable as a primary sync layer for global users.

### Recommended Architecture

```
User Devices (iOS/Android/Web/VSCode/Claude Code)
        |
        v
Cloudflare Workers (Durable Objects) — Real-time sync, presence
        |
        v
Supabase Postgres — Persistent storage, RLS, Auth
        |
Railway (Node.js service) — BLE gateway, Stripe webhook handler,
                            long-running background jobs
        |
Vercel — Next.js web frontend (static + SSR)
```

**Sources:**
- https://developers.cloudflare.com/durable-objects/
- https://partykit.io/blog/partykit-is-now-built-on-cloudflare
- https://railway.app/docs
- https://vercel.com/docs/functions

---

## 3. Auth — Better Auth vs Clerk vs Supabase Auth

### The Requirements
- Works across web, iOS (React Native / Expo), Android, VS Code extension, and Claude Code extension
- Social OAuth (Google, Apple — required for App Store)
- Email/password + magic link
- Session management compatible with Supabase RLS (JWT with `sub` claim)
- Subscription status in JWT or accessible server-side

### Better Auth (Phase 2+ — after MVP)

**What it is:** Open-source TypeScript auth library that runs on any framework, launched in late 2024 and rapidly became community-preferred in 2025.

**Pros:**
- **Framework-agnostic, self-hosted:** Runs as a middleware in Next.js, Hono, Fastify, or any Node server. You own your auth database.
- **Multi-platform SDKs:** Official clients for React, React Native, and vanilla JS. The Expo community package handles Apple Sign-In and Google Sign-In with the correct native flows.
- **Plugin system:** Plugins for 2FA, passkeys, magic links, organization/team support (useful for future "shared workspace" feature).
- **JWT compatible with Supabase:** You can configure Better Auth to issue JWTs with the `sub` claim matching Supabase's `auth.uid()` expectation, enabling RLS policies to work seamlessly.
- **No per-MAU pricing:** Unlike Clerk (which charges per monthly active user), Better Auth is completely free to self-host or costs only your compute.
- **Active development:** GitHub shows very high velocity in 2025. Community sentiment on Twitter/X and Reddit is strongly positive.

**Cons:**
- **Younger library:** Less battle-tested than Clerk or Supabase Auth. Fewer third-party integrations.
- **You manage the auth infrastructure:** Requires deploying an auth service (e.g., on Railway), handling DB migrations, monitoring.
- **Apple Sign-In complexity:** Apple's server-side token validation requires careful implementation. Better Auth handles it, but you need to configure Apple Developer credentials correctly.

### Clerk

**Pros:**
- Excellent DX, beautiful pre-built UI components, fast integration.
- Strong React Native support (Clerk Expo SDK).
- Organizations, RBAC, impersonation built-in.

**Cons:**
- **Per-MAU pricing ($25+/month after 10k MAUs):** For a subscription app with moderate user base, Clerk becomes expensive. At 50k MAUs, cost is significant.
- **Not fully open source:** Vendor lock-in risk.
- **JWT customization limited:** Harder to get the exact JWT shape Supabase RLS expects without workarounds.

### Supabase Auth

**Pros:**
- Zero-configuration integration with Supabase RLS — `auth.uid()` just works.
- Supports OAuth, magic links, phone auth, passkeys.
- Included in Supabase free tier.

**Cons:**
- **React Native / Expo support has rough edges:** The `@supabase/supabase-js` SDK works but requires manual `AsyncStorage` configuration for token persistence. Deep linking for OAuth requires careful setup in Expo.
- **Tied to Supabase ecosystem:** Migrating auth away from Supabase later is painful.
- **No native Apple Sign-In flow:** Requires a custom implementation using `expo-apple-authentication` and then passing the token to Supabase — works but is more manual than Clerk.

### Recommendation

**MVP: Use Supabase Auth.** It is already in your stack, zero extra cost, zero additional infrastructure, and `auth.uid()` just works with RLS policies. The rough Expo edges (AsyncStorage config, OAuth deep links) are solvable with a few hours of setup — not a blocker.

**Later: Migrate to Better Auth** when any of these become true:
- You need fine-grained session management or org/team support
- You want to reduce Supabase vendor lock-in
- You hit Supabase Auth limitations (custom JWT claims, advanced 2FA)

**Migration path:** Better Auth can issue JWTs with the same `sub` claim shape as Supabase Auth. Swap the auth client in `packages/api-client`, update the JWT secret in Supabase dashboard, and users re-authenticate once. RLS policies require no changes.

**Skip Clerk entirely.** Per-MAU pricing is a subscription-app killer at scale.

**Sources:**
- https://www.better-auth.com/docs
- https://clerk.com/pricing
- https://supabase.com/docs/guides/auth

---

## 4. Cross-Platform Mobile — Expo/React Native vs Flutter vs Capacitor

### The Requirements
- iOS and Android apps
- BLE device communication
- Background timer (requires background task APIs)
- Offline-first with sync
- Mac (macOS) support desirable (for a "companion" app or widget host)
- Code sharing with web app (TypeScript preferred)

### Expo / React Native (Recommended)

**Pros:**
- **Maximum code sharing with web:** If the web app is React/Next.js, an Expo app shares business logic, hooks, state management, and even some UI components via platform-specific file extensions (`.ios.tsx`, `.web.tsx`).
- **Expo Router:** File-based routing now works cross-platform including web, bringing the Expo monorepo story much closer to full-stack unification.
- **Expo Go + EAS Build:** Faster development iteration without native build toolchains for most features.
- **BLE:** `react-native-ble-plx` is well-maintained, works on iOS and Android. Expo has a config plugin for it.
- **Background tasks:** `expo-background-fetch` and `expo-task-manager` handle background timer continuation. iOS limitations (30-second background execution) require a local notification + timer state approach, which is the standard Pomodoro pattern.
- **Mac Catalyst / macOS:** Expo can build a Mac Catalyst app from the same React Native codebase. Not a native macOS widget, but a full Expo app running on macOS.
- **New Architecture (JSI/Fabric):** React Native's new architecture (stable in 2024, widely adopted in 2025) eliminates the JS bridge bottleneck, giving near-native performance for most UI interactions.
- **Community size:** React Native + Expo has the largest cross-platform mobile community. More third-party libraries, more Stack Overflow answers.

**Cons:**
- **Mac widget is not possible from Expo:** A native macOS menu bar widget requires SwiftUI/AppKit (see section 5). Expo/Mac Catalyst is a full-window app, not a menu bar widget.
- **Background BLE on iOS is restricted:** CoreBluetooth in background mode requires specific `UIBackgroundModes` entitlements and Apple review approval.
- **Large binary size:** React Native apps are typically 20-40MB vs Flutter's 5-10MB.
- **Expo managed workflow limitations:** Some advanced native capabilities require ejecting to bare workflow (adding a `Podfile` / `build.gradle`). With `react-native-ble-plx` you'll need bare or use a custom dev client.

### Flutter

**Pros:**
- Single codebase for iOS, Android, Web, macOS, Windows, Linux.
- Excellent performance, Skia/Impeller rendering engine produces pixel-perfect consistent UI.
- Strong BLE library: `flutter_blue_plus`.
- Can build a macOS desktop app (but not a native menu bar widget without platform channel code).
- Smaller binary size than React Native.

**Cons:**
- **Dart language:** Zero code sharing with your TypeScript web app. Business logic, API clients, and data models must be duplicated or generated.
- **Web story is mediocre:** Flutter Web still uses canvas rendering, which is bad for SEO and accessibility. In 2025, the community consensus is Flutter Web is fine for app-like tools but not for public-facing web pages.
- **VS Code extension, Claude Code extension:** Completely separate codebases in TypeScript. Flutter gives you no advantage here.
- **Community smaller than React Native:** Fewer third-party packages, especially for niche integrations.

### Capacitor (Ionic)

**Pros:**
- Web-first, wraps web app in a native WebView. Maximum code reuse from web app.
- Works with any web framework (React, Vue, Svelte).

**Cons:**
- **Performance:** WebView-based apps have noticeably worse performance than React Native or Flutter for animations and interactions.
- **BLE support is limited:** Capacitor BLE plugins exist but are not as mature as `react-native-ble-plx`.
- **Community has been shrinking** as Expo matured and took market share.

### Recommendation

Use **Expo (React Native, bare workflow or with custom dev client)** for iOS and Android. The TypeScript code sharing with the web app, mature BLE library, and large community outweigh Flutter's UI consistency advantages. Accept that the Mac widget must be a separate SwiftUI project.

**Sources:**
- https://docs.expo.dev
- https://github.com/dotintent/react-native-ble-plx
- https://flutter.dev/multi-platform

---

## 5. Native Apple Targets — macOS Widget, iOS Widget, Apple Watch

### Overview

PomoFocus targets three native Apple surfaces, all built in Swift/SwiftUI and housed in a single Xcode workspace at `native/apple/`:

| Target | Framework | Min OS | Location |
|--------|-----------|--------|----------|
| macOS menu bar widget | SwiftUI + MenuBarExtra | macOS 13 | `native/apple/mac-widget/` |
| iOS home screen widget | WidgetKit + AppIntents | iOS 17 | `native/apple/ios-widget/` |
| Apple Watch app | SwiftUI + WatchKit | watchOS 10 | `native/apple/watchos-app/` |

All three share timer state via a common App Group (`group.com.pomofocus.shared`) and Supabase Realtime.

See sections 5b and 5c for iOS widget and watchOS details.

---

## 5a. Desktop / Mac Widget — Tauri vs Electron vs SwiftUI

### The Requirements
- macOS menu bar widget showing current Pomodoro timer
- Must update every second (timer tick)
- Lightweight — should not consume significant memory
- Ideally shares session state with the mobile/web app via Supabase sync

### SwiftUI (Recommended)

**What it is:** Native Apple framework for building macOS (and iOS/watchOS/tvOS) apps. Menu bar apps are built with `NSStatusItem` + `NSPopover` or `NSWindow`.

**Pros:**
- **Only way to build a true macOS menu bar widget:** Neither Tauri nor Electron can place UI in the macOS menu bar as a native widget with smooth 1-second timer updates without significant overhead.
- **Extremely lightweight:** A SwiftUI menu bar app uses ~20-40MB RAM. Electron alternatives use 150-400MB.
- **Native look and feel:** Respects macOS accent colors, dark mode, accessibility.
- **WidgetKit integration:** Can also build a macOS widget for the Desktop widget gallery (macOS Sonoma+).
- **Supabase integration:** Use the Swift SDK (`supabase-swift`) for real-time sync. The SDK is mature and maintained by Supabase.
- **Background timer with `Timer.scheduledTimer`:** Perfectly suitable for 1-second tick updates.

**Cons:**
- **macOS / Apple platforms only:** Zero code sharing with web/mobile TypeScript code except through API calls to the backend.
- **Developer must know Swift:** If your team is TypeScript-only, this is a significant skill gap.
- **Separate Xcode project:** An entirely separate codebase and build pipeline.

### Tauri (v2, 2025)

**What it is:** Rust-based framework for building desktop apps using a WebView frontend (your existing web app code). Tauri v2 adds mobile support.

**Pros:**
- **Shares web app UI code:** Your React/Next.js web app can be the frontend of a Tauri app. Near-zero duplication.
- **Very small binary size:** Tauri apps are 3-10MB vs Electron's 100MB+ because they use the OS WebView (WKWebView on macOS).
- **Low memory usage:** ~30-80MB RAM vs Electron's 200MB+.
- **System tray support:** Tauri v2 has a `tauri-plugin-system-tray` that can create a menu bar icon with a popover — a usable menu bar app.
- **Rust backend:** Can use native BLE libraries (btleplug) for a desktop BLE connection.

**Cons:**
- **Menu bar popover is a WebView, not native:** It looks like a web page in a floating window, not a native macOS popover. In 2025 this is acceptable but feels slightly off compared to SwiftUI.
- **macOS-only limitation for menu bar:** The system tray approach works cross-platform but menu bar pop-up polish is best on macOS with SwiftUI.
- **Rust learning curve:** The backend logic in Tauri requires Rust. Alternatively, use Tauri's `invoke` from JS to call Rust functions, keeping business logic in JS.
- **WebView inconsistencies:** WKWebView on macOS and WebView2 on Windows have different rendering behaviors.

### Electron

**Pros:**
- Maximum JavaScript code sharing.
- Huge ecosystem (VS Code itself is Electron).

**Cons:**
- **Memory usage:** 200-400MB for a simple timer widget is unacceptable.
- **Slow startup:** Not suitable for a quick-glance menu bar widget.
- **2025 community consensus:** Electron is increasingly seen as a legacy choice for new projects. Tauri has largely replaced it for greenfield apps.

### Recommendation

Build the Mac menu bar widget as a **native SwiftUI app** using `supabase-swift` for sync. This gives the best user experience with minimal resource overhead. The tradeoff (separate Swift codebase) is acceptable given the widget's focused scope — it mainly reads and displays state, rarely writes.

If Swift is a hard constraint (TypeScript-only team), use **Tauri v2** as the runner-up — you get acceptable menu bar behavior with web code sharing.

**WidgetKit note:** Also consider building a macOS Sonoma desktop widget via WidgetKit. This shows the timer on the desktop without the app being open, which is a compelling UX feature for a Pomodoro app.

**Sources:**
- https://tauri.app/v2/
- https://developer.apple.com/documentation/swiftui/
- https://developer.apple.com/documentation/widgetkit
- https://github.com/supabase/supabase-swift

---

## 5b. iOS Home Screen Widget (WidgetKit)

### The Requirements
- Show current Pomodoro timer state on the iOS home screen and Smart Stack
- Update when the timer state changes (within WidgetKit's system-controlled cadence)
- Interactive controls to start/pause (iOS 17+ interactive widgets)
- Share state with the Expo app running on the same device

### Architecture

iOS home screen widgets are **not live views** — they are snapshots driven by a `TimelineProvider`. The system decides when to refresh them (approximately hourly unless the app explicitly triggers a reload).

**State sharing via App Group:**
```swift
// Shared UserDefaults between Expo app and widget extension
let sharedDefaults = UserDefaults(suiteName: "group.com.pomofocus.shared")

// Written by Expo app (via react-native module or Expo App Extension)
sharedDefaults?.set(timerState.secondsRemaining, forKey: "secondsRemaining")
sharedDefaults?.set(timerState.endDate.timeIntervalSince1970, forKey: "endDate")

// Read by widget TimelineProvider
let endDate = Date(timeIntervalSince1970: sharedDefaults?.double(forKey: "endDate") ?? 0)
```

**Triggering a widget reload from Expo:**
```typescript
// From the Expo app, call a native module that calls:
// WidgetCenter.shared.reloadTimelines(ofKind: "PomoFocusWidget")
```

**Interactive widgets (iOS 17+):**
- Use `AppIntents` (`StartSessionIntent`, `PauseSessionIntent`) for `Button`/`Toggle` controls
- Intents run in a background extension process — they must update shared state and call `WidgetCenter.shared.reloadAllTimelines()`

### Key Constraints
- No live timer tick in widget — use `Text(.timerInterval:)` for a system-rendered countdown that updates automatically without reloads
- Widget memory limit: ~30MB — keep dependencies minimal
- Widget cannot access Supabase Realtime directly; it reads shared UserDefaults state
- Minimum: iOS 17 (for interactive widgets); iOS 16 for non-interactive WidgetKit

### Location in Repo
`native/apple/ios-widget/` — a WidgetKit extension target in the Apple Xcode workspace.

**Sources:**
- https://developer.apple.com/documentation/widgetkit
- https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension
- https://developer.apple.com/documentation/appintents

---

## 5c. Apple Watch App (watchOS)

### The Requirements
- Show current Pomodoro timer on the wrist
- Allow starting/pausing sessions from the watch
- Continue counting in background (background timer)
- Complications on watch faces and Smart Stack (watchOS 10+)
- Sync with the iPhone app (and optionally with Supabase directly for cellular watches)

### Architecture Decision: Companion-Only vs. Independent

| | Companion-only | Independent (cellular) |
|---|---|---|
| **Connectivity** | Requires paired iPhone nearby (`WatchConnectivity`) | Connects directly to Supabase via WiFi/cellular |
| **Complexity** | Lower — no direct backend auth needed | Higher — full auth flow on watch |
| **Cost** | No extra infra | Same Supabase tier |
| **MVP fit** | ✅ Yes | ❌ Defer to later phase |

**Recommendation:** Ship companion-only for MVP. Add independent operation (cellular/WiFi Supabase Realtime) in Phase 3.

### Background Timer

`WKExtendedRuntimeSession` keeps the watch app running in the background (duration limits vary by session type — see Apple's [WKExtendedRuntimeSession docs](https://developer.apple.com/documentation/watchkit/wkextendedruntimesession)) — perfect for a standard Pomodoro focus session:

```swift
let session = WKExtendedRuntimeSession()
session.delegate = self
session.start()
// Session stays active until invalidated — duration limits vary by session type
```

For long break sessions, verify the applicable duration limit in the Apple docs linked above and schedule a local notification if the session needs to extend beyond it.

### Complications (watchOS 10+ Smart Stack)

Build complications via WidgetKit (same `TimelineProvider` pattern as the iOS widget). Supports:
- Circular, rectangular, and corner complication families
- Smart Stack widget on watchOS 10 (shows when the wrist is raised during a session)

### WatchConnectivity (Companion Mode)

```swift
// Watch side — receive timer state from iPhone
func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    let secondsRemaining = message["secondsRemaining"] as? Int ?? 0
    // Update local timer display
}

// iPhone side (via Expo native module) — send state to watch
WCSession.default.sendMessage(["secondsRemaining": state.secondsRemaining], replyHandler: nil)
```

### Key Constraints
- watchOS apps have strict memory limits (~60MB for extension)
- No URLSession background transfers on watchOS (use `WatchConnectivity` or foreground requests)
- Minimum: watchOS 10 (Xcode 15+) for Smart Stack complications via WidgetKit
- Watch app must have a paired iOS app on the same Apple Developer account

### Location in Repo
`native/apple/watchos-app/` — a watchOS app target in the Apple Xcode workspace.

**Sources:**
- https://developer.apple.com/documentation/watchkit
- https://developer.apple.com/documentation/watchconnectivity
- https://developer.apple.com/documentation/widgetkit/creating-complications-for-apple-watch

---

## 6. VS Code Extension — Patterns and Code Sharing

### Architecture

A VS Code extension is a Node.js module that runs in VS Code's extension host process. It communicates with the VS Code UI via the `vscode` API (TypeScript). The WebView API allows rendering arbitrary HTML/CSS/JS inside VS Code panels.

### Code Sharing Strategy

The key to sharing code between the web app, VS Code extension, and other platforms is a **monorepo with shared packages:**

```
packages/
  core/           — Business logic: timer state machine, session models, sync client
  ui-components/  — React components (shared between web and VS Code WebView)
  api-client/     — Supabase client, auth client, typed API functions
apps/
  web/            — Next.js web app
  mobile/         — Expo app
  vscode/         — VS Code extension
  claude-code/    — MCP server
  mac-widget/     — SwiftUI app (Swift, cannot share JS packages)
```

The VS Code extension uses:
- `@pomofocus/core` for the timer state machine
- `@pomofocus/api-client` for Supabase realtime subscription
- VS Code WebView with React (bundled separately) for the timer panel UI

### VS Code Extension Specifics

**Status bar item:** Use `vscode.window.createStatusBarItem` to show current timer state (e.g., `🍅 12:34 — Focus`) in the VS Code status bar. This is a common pattern for Pomodoro extensions.

**Sidebar WebView:** Use `vscode.window.registerWebviewViewProvider` to create a sidebar panel with the full timer UI (React component, same as web).

**Background timer:** The extension host runs persistently while VS Code is open. Use `setInterval` in the extension host (not the WebView) to tick the timer. Post messages to the WebView for display updates.

**Supabase Realtime in extension:** The extension host can maintain a Supabase Realtime subscription. When a session completes on mobile, the VS Code extension gets the event and updates its display.

**Auth in VS Code extension:** Use VS Code's secret storage (`context.secrets`) to store the auth token. Provide a "Sign In" command that opens a browser to the web app's auth flow (OAuth redirect), then captures the token via a URI handler (`vscode.window.registerUriHandler`).

**Sources:**
- https://code.visualstudio.com/api/extension-guides/webview
- https://code.visualstudio.com/api/references/vscode-api
- https://code.visualstudio.com/api/extension-guides/authentication

---

## 7. BLE / Physical Device

### Requirements
- Communicate with a physical BLE device (custom hardware, e.g., a dedicated Pomodoro timer button/display)
- From iOS, Android, Web, and potentially Mac desktop
- Firmware update delivery (OTA)

### react-native-ble-plx (Mobile — Recommended)

**The standard library for React Native BLE in 2025.** Maintained by Dotintent, actively updated.

**Features:**
- Scan, connect, read/write characteristics, subscribe to notifications
- Works with iOS CoreBluetooth and Android BLE stack
- Expo config plugin available (no manual native linking required)
- Supports background BLE on iOS with proper `UIBackgroundModes` entitlements

**Usage pattern for Pomodoro device:**
```typescript
// packages/ble-client/src/pomofocus-ble.ts
import { BleManager } from 'react-native-ble-plx';

const SERVICE_UUID = '12345678-...';
const TIMER_CHAR_UUID = '87654321-...';

export class PomoFocusBLE {
  private manager = new BleManager();

  async sendTimerState(state: TimerState) {
    const device = await this.manager.connectToDevice(this.deviceId);
    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID, TIMER_CHAR_UUID,
      Buffer.from(encodeTimerState(state)).toString('base64')
    );
  }
}
```

### Web Bluetooth API (Web — Available in Chrome/Edge)

**What it is:** A W3C standard API for BLE communication from web browsers.

**Availability in 2025:**
- Supported in: Chrome (desktop + Android), Edge, Opera
- NOT supported in: Firefox (declined to implement), Safari (declined to implement)

**Implications for PomoFocus:**
- Web Bluetooth works for Chrome/Edge users on the web app
- iPhone Safari users cannot use BLE from the web app — they must use the native iOS app
- This is acceptable since iOS users will have the native app

**Pattern:**
```typescript
// packages/ble-client/src/web-ble.ts
export async function connectWebBluetooth() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }]
  });
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  return service.getCharacteristic(TIMER_CHAR_UUID);
}
```

### Mac Desktop BLE

**If using SwiftUI:** CoreBluetooth is available natively. Identical pattern to iOS.

**If using Tauri:** Use `btleplug` (Rust crate) via Tauri commands. Works on macOS, Windows, Linux.

### BLE Device Protocol Design

For a custom physical device (e.g., an e-ink display or a dedicated button), design a GATT profile:
- **Timer State Characteristic** (Write): Encodes { phase: 'focus'|'break', remaining_seconds: u16, session_count: u8 }
- **Button Press Characteristic** (Notify): Device notifies host when physical button pressed (start/pause/skip)
- **OTA Characteristic** (Write Long): For firmware updates, use the Nordic DFU profile standard

**Cloud gateway for BLE device:**
Some physical devices have their own Wi-Fi/cloud connection. If the PomoFocus device has Wi-Fi capability, use MQTT over WebSockets to a Railway-hosted MQTT broker (e.g., EMQX), avoiding the complexity of BLE entirely for the cloud sync path. BLE then only handles the local device-phone connection.

**Sources:**
- https://github.com/dotintent/react-native-ble-plx
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- https://developer.apple.com/documentation/corebluetooth

---

## 8. Monorepo — Turborepo vs Nx

### The Requirements
- Manage: web (Next.js), mobile (Expo), VS Code extension, Claude Code MCP server, Mac widget (Swift — partially), shared packages
- TypeScript throughout (except Swift)
- Fast incremental builds
- Good caching (remote + local)
- Team-friendly (not over-engineered)

### Nx (Chosen — prior experience)

**What it is:** Full-featured monorepo build system with a project graph, generators, affected detection, and a plugin ecosystem for every major framework.

**Pros:**
- **Generators (`nx generate`):** Scaffold new apps and libraries with enforced conventions. Huge productivity win in a project with 8+ apps — no copy-pasting boilerplate.
- **`nx affected`:** Runs only tests/builds for packages that changed since the base branch. Critical for CI speed in a multi-platform repo.
- **First-class framework plugins:** `@nx/next`, `@nx/expo`, `@nx/react`, `@nx/node` — each handles the quirks of its framework's build system.
- **Nx Cloud free tier:** Distributed remote caching at no cost for solo developers (up to a generous monthly limit).
- **Powerful project graph:** Visual dependency graph (`nx graph`) helps understand package relationships at a glance.
- **Enforced module boundaries:** ESLint rules can prevent `apps/web` from importing internals of `apps/mobile`, avoiding accidental coupling.

**Cons:**
- **More config files:** `project.json` per package, `nx.json` at root, per-plugin config. Acceptable if you know Nx already.
- **Steeper initial setup:** Takes longer than Turborepo to scaffold from scratch, but generators handle most of it after init.
- **Nx Daemon adds background process:** Minor — you can disable it if it causes issues.

### Turborepo (Runner-up)

Would be the pick for minimal config if starting from zero Nx experience. Turborepo's `turbo.json` is simpler, but lacks generators and the affected detection is less granular. For a team of one with existing Nx experience, it offers no practical advantage.

### Monorepo Structure

```
pomofocus/
├── nx.json
├── package.json          (pnpm workspace root)
├── pnpm-workspace.yaml
├── packages/
│   ├── core/             (timer state machine, models — pure TS)
│   ├── api-client/       (Supabase client + auth helpers)
│   ├── ui-components/    (React components, shared web/VS Code/Expo)
│   ├── ble-client/       (BLE abstraction layer)
│   └── config/           (ESLint, TypeScript base configs)
├── apps/
│   ├── web/              (Next.js)
│   ├── mobile/           (Expo)
│   ├── vscode-extension/ (VS Code extension)
│   ├── mcp-server/       (Claude Code MCP server)
│   └── ble-gateway/      (Node.js BLE/MQTT gateway)
└── native/
    └── mac-widget/       (Xcode project — Swift, outside Nx task graph)
```

**pnpm** is the strongly recommended package manager for monorepos in 2025. Its strict linking prevents phantom dependencies and it is significantly faster than npm with workspace support.

**Sources:**
- https://nx.dev/concepts/mental-model
- https://nx.dev/nx-api/expo
- https://nx.dev/nx-api/next
- https://turbo.build/repo/docs
- https://pnpm.io/workspaces

---

## 9. Claude Code Extension — MCP Server

### What Is a "Claude Code Extension"?

As of 2025, Claude Code (Anthropic's CLI/agentic coding tool) supports extensions via the **Model Context Protocol (MCP)**. MCP is an open protocol (released by Anthropic in late 2024) that allows any process to expose **tools**, **resources**, and **prompts** to Claude.

A Claude Code extension for PomoFocus is an **MCP server** that Claude Code connects to, giving it tools to:
- Read current Pomodoro session state
- Start/stop/skip timers
- Log completed sessions
- Retrieve productivity stats for context

### MCP Server Architecture

An MCP server is a Node.js (or Python) process that Claude Code communicates with via stdio or HTTP+SSE transport.

```typescript
// apps/mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'pomofocus',
  version: '1.0.0',
}, {
  capabilities: { tools: {}, resources: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_timer_state',
      description: 'Get the current Pomodoro timer state',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'start_focus_session',
      description: 'Start a new focus session',
      inputSchema: {
        type: 'object',
        properties: {
          task_description: { type: 'string' }
        }
      }
    },
    {
      name: 'complete_session',
      description: 'Mark the current session as complete',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiClient = createApiClient(); // @pomofocus/api-client
  switch (request.params.name) {
    case 'get_timer_state':
      const state = await apiClient.getCurrentSession();
      return { content: [{ type: 'text', text: JSON.stringify(state) }] };
    // ...
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Claude Code MCP Configuration

Users add the MCP server to their Claude Code config (`.claude/settings.json` or `~/.config/claude/settings.json`):

```json
{
  "mcpServers": {
    "pomofocus": {
      "command": "npx",
      "args": ["@pomofocus/mcp-server"],
      "env": {
        "POMOFOCUS_API_URL": "https://api.pomofocus.app",
        "POMOFOCUS_TOKEN": "${env:POMOFOCUS_TOKEN}"
      }
    }
  }
}
```

### MCP Server Code Sharing

The MCP server lives in `apps/mcp-server/` and depends on `@pomofocus/api-client` and `@pomofocus/core`. This means it directly reuses all the same timer logic and Supabase client as the web app. No code duplication.

### MCP Resources

Beyond tools, expose **resources** that Claude can read for context:
- `pomofocus://session/current` — Current session as structured data
- `pomofocus://stats/today` — Today's completed sessions count
- `pomofocus://tasks/active` — Current task list

This allows Claude to proactively include Pomodoro context when discussing work: "You've completed 3 focus sessions today. Your current task is 'Implement BLE sync'."

### Distribution

Publish `@pomofocus/mcp-server` to npm. Users install it via `npx` (zero install) or globally. This is the standard MCP server distribution pattern in 2025.

**Sources:**
- https://github.com/anthropics/anthropic-sdk-python/tree/main/examples/mcp
- https://spec.modelcontextprotocol.io/
- https://github.com/modelcontextprotocol/typescript-sdk
- https://docs.anthropic.com/en/docs/claude-code/mcp

---

## Final Recommended Stack for PomoFocus

### Complete Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        PomoFocus Stack                       │
├──────────────────┬──────────────────────────────────────────┤
│ Monorepo         │ Nx + pnpm workspaces                      │
├──────────────────┼──────────────────────────────────────────┤
│ Language         │ TypeScript everywhere (+ Swift for widget)│
├──────────────────┼──────────────────────────────────────────┤
│ Database         │ Supabase (Postgres + RLS)                 │
│ Offline Sync     │ PowerSync (optional, phase 2)             │
├──────────────────┼──────────────────────────────────────────┤
│ Auth (MVP)       │ Supabase Auth                             │
│ Auth (later)     │ Better Auth (self-hosted on Railway)      │
├──────────────────┼──────────────────────────────────────────┤
│ Real-time (MVP)  │ Supabase Realtime (direct)                │
│ Real-time (later)│ Cloudflare Workers + Durable Objects      │
│ Long-running     │ Railway (BLE gateway, bg jobs; skip MVP)  │
│ Web Frontend     │ Vercel (Next.js)                          │
├──────────────────┼──────────────────────────────────────────┤
│ Web App          │ Next.js (App Router) + React              │
│ Mobile           │ Expo (bare workflow, React Native)        │
│ Mac Widget       │ SwiftUI + WidgetKit + supabase-swift      │
│ VS Code Ext      │ VS Code Extension API + WebView (React)   │
│ Claude Code Ext  │ MCP Server (Node.js, @pomofocus/mcp)      │
├──────────────────┼──────────────────────────────────────────┤
│ BLE (mobile)     │ react-native-ble-plx                      │
│ BLE (web)        │ Web Bluetooth API (Chrome/Edge only)      │
│ BLE (mac)        │ CoreBluetooth (SwiftUI) / btleplug(Tauri) │
├──────────────────┼──────────────────────────────────────────┤
│ Subscriptions    │ Stripe + Supabase RLS enforcement         │
│ Billing webhooks │ Railway service                           │
└──────────────────┴──────────────────────────────────────────┘
```

### Development Priority / Phasing

**Phase 1 — Core (months 1-3):**
- Nx monorepo setup with `packages/core`, `packages/api-client`
- Supabase project (DB schema, RLS policies, Supabase Auth)
- Next.js web app with basic timer + auth
- Expo mobile app with timer + BLE scaffolding

**Phase 2 — Expansion (months 4-6):**
- VS Code extension with status bar + WebView panel
- MCP server for Claude Code
- Stripe subscription integration
- Supabase Realtime sync between all clients

**Phase 3 — Native & Hardware (months 7-9):**
- SwiftUI Mac widget + WidgetKit
- BLE device protocol + react-native-ble-plx integration
- PowerSync for robust offline-first sync
- Physical device firmware

---

## MVP Cost Target: $0/month

By making deliberate choices on infra, the MVP phase (pre-revenue, < 100 users) costs nothing:

| Service | MVP Cost | Free Tier |
|---------|----------|-----------|
| Supabase | **$0** | 500MB DB, 50K MAU, 2GB storage, 5GB bandwidth |
| Cloudflare Workers | **$0** | 100K requests/day |
| Cloudflare Pages (if using instead of Vercel) | **$0** | Unlimited bandwidth |
| Vercel (Hobby) | **$0** | 100GB bandwidth, hobby projects |
| Nx Cloud | **$0** | Free for solo developers |
| Cloudflare Durable Objects | **Skip for MVP** | Requires $5/month Workers Paid tier |
| Railway (BLE gateway, Better Auth) | **Skip for MVP** | Defer until needed |

**Defer Durable Objects for MVP:** Connect clients directly to Supabase Realtime. The connection-limit problem (N connections per user) only matters at scale. Add the Durable Objects fan-out layer once you have enough concurrent users to need it.

**Defer Railway for MVP:** Supabase Auth eliminates the Railway auth server. The BLE gateway daemon can come in Phase 3 when hardware ships.

**Scale triggers:**
- Upgrade to Supabase Pro ($25/month) when you approach 50K MAU or 500MB storage
- Upgrade to Cloudflare Workers Paid ($5/month) + add Durable Objects when real-time sync strains under concurrent users
- Add Railway (~$5-10/month) when the BLE gateway is needed

---

## Key Tradeoffs and Risks

### 1. Swift / TypeScript Split
The SwiftUI Mac widget is a separate codebase. This means:
- Timer state machine must be implemented twice (TS + Swift) OR the Swift app calls the API for all state.
- **Recommended mitigation:** The Swift widget is read-only. It subscribes to Supabase Realtime via `supabase-swift` for timer events and renders them. It never runs the timer itself — the timer source of truth lives in the TypeScript core.

### 2. Supabase Realtime Connection Limits
With multiple active clients per user (web, mobile, VS Code, Claude Code, Mac widget = 5 connections/user), you hit the Supabase Pro tier limit (500 concurrent) at just 100 simultaneous active users.
- **Mitigation:** Use Cloudflare Durable Objects as the real-time hub. The DO maintains one Supabase Realtime connection per user and fans out to all their device clients via WebSocket. This collapses N connections per user into 1.

### 3. BLE Background on iOS
iOS aggressively terminates background BLE connections.
- **Mitigation:** Use local notifications for timer ticks. The BLE device connection is only active when the app is in the foreground. Cloud sync keeps the device updated when it reconnects.

### 4. Supabase Auth → Better Auth Migration
Migrating auth mid-product is disruptive (forced re-authentication for all users).
- **Mitigation:** Do it during an intentional "infrastructure month" with advance notice to users. Better Auth issues JWTs with the same `sub` claim shape, so RLS policies require no changes. Scope the migration to one sprint: swap `packages/api-client`, update the JWT secret in Supabase, deploy Better Auth on Railway, test all platforms.

### 5. Web Bluetooth Browser Support
Safari does not support Web Bluetooth (by design — Apple prefers native apps for BLE).
- **Mitigation:** On Safari/Firefox, show a "Download the app for BLE device support" message. Web Bluetooth is a progressive enhancement, not a core dependency.

### 6. Monorepo Complexity
Managing 8+ apps in a monorepo increases build complexity.
- **Mitigation:** Nx handles this well via enforced module boundaries (ESLint rules). The key discipline: keep `packages/core` dependency-free (no React, no Supabase). Build layers upward.

---

## Source Links for Independent Research

### Database
- Supabase Realtime docs: https://supabase.com/docs/guides/realtime
- Supabase RLS guide: https://supabase.com/docs/guides/auth/row-level-security
- PowerSync + Supabase: https://www.powersync.com/blog/powersync-supabase
- ElectricSQL: https://electric-sql.com/docs

### Auth
- Better Auth docs: https://www.better-auth.com/docs
- Better Auth GitHub: https://github.com/better-auth/better-auth
- Clerk pricing: https://clerk.com/pricing
- Supabase Auth + Expo: https://supabase.com/docs/guides/auth/social-login/auth-apple

### Hosting / Edge
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Railway docs: https://railway.app/docs
- Vercel functions: https://vercel.com/docs/functions

### Mobile
- Expo docs: https://docs.expo.dev
- react-native-ble-plx: https://github.com/dotintent/react-native-ble-plx
- Flutter multi-platform: https://flutter.dev/multi-platform

### Desktop
- Tauri v2: https://tauri.app/v2/
- SwiftUI + macOS: https://developer.apple.com/documentation/swiftui/
- WidgetKit: https://developer.apple.com/documentation/widgetkit
- supabase-swift: https://github.com/supabase/supabase-swift

### VS Code Extension
- Webview API: https://code.visualstudio.com/api/extension-guides/webview
- Authentication: https://code.visualstudio.com/api/extension-guides/authentication
- Extension API: https://code.visualstudio.com/api/references/vscode-api

### BLE
- Web Bluetooth API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- CoreBluetooth: https://developer.apple.com/documentation/corebluetooth
- btleplug (Rust): https://github.com/deviceplug/btleplug

### Monorepo
- Turborepo: https://turbo.build/repo/docs
- pnpm workspaces: https://pnpm.io/workspaces
- Nx: https://nx.dev

### MCP / Claude Code
- MCP spec: https://spec.modelcontextprotocol.io/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Claude Code MCP docs: https://docs.anthropic.com/en/docs/claude-code/mcp
- Claude Code settings: https://docs.anthropic.com/en/docs/claude-code/settings

---

*Document generated: March 2026. Based on community knowledge through August 2025. Individual library versions and pricing tiers change frequently — verify current state at linked sources before making final decisions.*
