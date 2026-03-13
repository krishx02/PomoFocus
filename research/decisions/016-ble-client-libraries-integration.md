# ADR-016: BLE Client Libraries & Integration

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 2 (Container — BLE client integration spans mobile app, web app, and macOS widget)
**Platforms:** iOS app (primary central), Android app (central), web (progressive enhancement), macOS menu bar widget (fallback central, post-v1)

## Context and Problem Statement

ADR-013 defined the GATT protocol (5 services, Protobuf encoding, chunked bulk transfer). ADR-010 established the phone as primary BLE central with Mac as fallback. Now each client platform needs a concrete BLE library choice, a reconnection strategy, and a shared abstraction design. The decision also includes whether BLE sync happens automatically in the background or only when the user opens the app — a question with major implementation complexity implications on iOS and Android.

## Decision Drivers

- **Expo managed workflow** — BLE library must work with Expo config plugins (`npx expo prebuild`), no manual native code edits
- **Developer experience** — project lead has zero BLE/hardware experience; good documentation and community support are essential
- **Chunked bulk transfer** — ADR-013's Session Sync Service requires reliable multi-packet transfer with sequence numbers and acknowledgments; the library must support fine-grained GATT operations (write, notify, MTU negotiation)
- **iOS background BLE complexity** — Apple aggressively suspends background BLE connections; state restoration is unreliable and a major source of bugs
- **Code sharing** — `packages/ble-protocol/` (ADR-001) should hold as much shared logic as possible, with platform-specific transport adapters
- **Cross-platform consistency** — same GATT protocol must work across iOS, Android, Chrome (Web Bluetooth), and macOS (CoreBluetooth)

## Considered Options

1. **react-native-ble-plx + thin shared layer** — use ble-plx for mobile, share only Protobuf types in `packages/ble-protocol/`, each platform writes its own connection/sync logic independently
2. **react-native-ble-plx + deep shared abstraction** — use ble-plx for mobile, define a TypeScript `BleTransport` interface in `packages/ble-protocol/` with shared sync orchestration; mobile and web implement thin transport adapters
3. **react-native-ble-manager + minimal abstraction** — use the simpler ble-manager for mobile, minimal code sharing

## Decision Outcome

Chosen option: **"react-native-ble-plx + deep shared abstraction"**, because ble-plx is the only React Native BLE library with the feature depth needed for ADR-013's chunked sync protocol (MTU negotiation, multi-device support, guaranteed transactions), and the shared abstraction pattern matches every prior architectural decision (timer FSM in `core/` with platform drivers per ADR-004, sync protocol in `core/sync/` with drivers per ADR-006).

### Library Assignments

| Platform             | Library                                | Role                                             | Timeline      |
| -------------------- | -------------------------------------- | ------------------------------------------------ | ------------- |
| iOS / Android (Expo) | **react-native-ble-plx** (v3.x)        | Primary BLE central                              | v1            |
| Web                  | **Web Bluetooth API** (native browser) | Progressive enhancement (Chrome/Edge/Opera only) | v1 (degraded) |
| macOS menu bar       | **CoreBluetooth** (Apple framework)    | Fallback BLE central                             | Post-v1       |
| watchOS              | None — WatchConnectivity relay         | Data via phone                                   | Post-v1       |

### Key Integration Decisions

| Decision           | Choice                                     | Why                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync trigger       | **App-open** (not background BLE)          | iOS background BLE is notoriously unreliable — Apple can kill connections after 30s-3min. Android background varies wildly by manufacturer (Samsung, Xiaomi, Huawei aggressive battery optimization). App-open sync eliminates the #1 source of BLE bugs. Device stores ~10 months of sessions locally (ADR-010), so no data loss risk. Background auto-sync deferred to v2. |
| MTU negotiation    | **Automatic on iOS, requested on Android** | iOS auto-negotiates to ~187 bytes. Android requires explicit `requestMTU()` — request 512, accept whatever is granted. Since Android 14, default MTU is 517. react-native-ble-plx handles both via `requestMTU` connection option.                                                                                                                                           |
| Pairing            | **OS-managed** (no app-level auth)         | Passkey pairing dialog is a system-level UI on both iOS and Android. react-native-ble-plx doesn't control pairing — it initiates connection, the OS handles security. Session data (timestamps, durations, goal IDs) isn't sensitive enough for additional app-level authentication (ADR-012).                                                                               |
| Reconnection       | **Scan-on-open**                           | When app opens, scan for known device UUID. If found, connect and drain outbox. No persistent connection maintained. Reconnection timeout: 10s scan, then stop. User can manually trigger re-scan.                                                                                                                                                                           |
| Shared abstraction | **Extract from working code**              | Build mobile BLE end-to-end first. Once working, extract shared sync orchestration into `packages/ble-protocol/`. Don't design the abstraction upfront — let it emerge from real implementation.                                                                                                                                                                             |

### Shared Abstraction Architecture

```
packages/ble-protocol/
├── proto/                    # Protobuf definitions (existing per ADR-001)
│   └── pomofocus.proto
├── generated/                # protoc output (TS, Swift, C++)
├── src/
│   ├── types.ts              # BleTransport interface, connection types
│   ├── sync-orchestrator.ts  # Chunked sync state machine (pure logic)
│   ├── command-encoder.ts    # Encode timer/goal commands to Protobuf
│   └── chunk-handler.ts     # Chunk/reassemble session data
└── adapters/                 # (added after mobile works)
    ├── ble-plx-transport.ts  # react-native-ble-plx adapter
    └── web-bluetooth-transport.ts  # Web Bluetooth adapter
```

The `BleTransport` interface defines 6 operations:

- `connect(deviceId, options?): Promise<BleConnection>` — establish GATT connection
- `disconnect(): Promise<void>` — clean disconnect
- `read(serviceUuid, charUuid): Promise<Uint8Array>` — read from characteristic
- `write(serviceUuid, charUuid, data): Promise<void>` — write to characteristic
- `subscribe(serviceUuid, charUuid, callback): Subscription` — subscribe to notifications
- `negotiateMtu(requestedSize): Promise<number>` — request MTU size

Sync orchestration (chunk handling, ack logic, cursor management) lives above this interface — same code for mobile and web. CoreBluetooth (Swift) needs its own implementation of both transport and orchestration.

### Consequences

- **Good:** react-native-ble-plx is the most mature and full-featured React Native BLE library (90K weekly downloads, 3.3K GitHub stars). Expo config plugin support means no ejecting. App-open sync eliminates the iOS/Android background BLE nightmare — dramatically simpler implementation. Shared abstraction aligns with every prior architecture pattern (ADR-004, ADR-006). MTU negotiation maximizes sync throughput (5x faster than minimum MTU per ADR-013).
- **Bad:** Shared abstraction only benefits mobile for v1 — web (Chrome-only, no Safari/Firefox) and macOS (post-v1) won't use it for months. react-native-ble-plx doesn't work in Expo Go — requires development builds on physical devices for all BLE testing. CoreBluetooth (Swift) can't share the TypeScript abstraction — needs parallel Swift implementation. App-open sync means sessions don't appear on other devices until the user opens the app near the device.
- **Neutral:** Web Bluetooth covers ~78% of global users but likely much less for the iOS-centric target audience (Safari has zero support). App-open sync can be upgraded to background sync in v2 without architectural changes — just add state restoration to the existing BleTransport adapter.

## Pros and Cons of the Options

### react-native-ble-plx + thin shared layer

- Good, because less upfront abstraction work — get mobile BLE working fastest
- Good, because no risk of premature abstraction that doesn't fit all platforms
- Bad, because reconnection logic, chunk handling, and command encoding duplicated across platforms
- Bad, because no shared contract for web BLE implementation to target

### react-native-ble-plx + deep shared abstraction

- Good, because sync orchestration (chunk handling, acks, cursor) written once in TypeScript
- Good, because web BLE gets a clear `BleTransport` contract to implement
- Good, because aligns with every prior architecture pattern (pure logic in packages, adapters in apps)
- Good, because react-native-ble-plx has 90K weekly downloads, 3.3K GitHub stars — largest RN BLE community
- Good, because iOS background BLE with state restoration is supported if needed for v2
- Good, because MTU negotiation is built in (auto on iOS, requestable on Android)
- Good, because Expo config plugin — no ejecting, just `npx expo prebuild`
- Bad, because shared abstraction serves only mobile for v1 — web and macOS BLE are months away
- Bad, because CoreBluetooth (Swift) needs separate implementation of same protocol
- Bad, because more upfront design work before writing the first BLE connection

### react-native-ble-manager + minimal abstraction

- Good, because simpler API — lower learning curve for BLE beginners
- Good, because 45K weekly downloads — healthy community
- Bad, because lacks multi-device connections, guaranteed transactions, raw packet handling
- Bad, because ADR-013's chunked bulk transfer needs reliable multi-packet operations that ble-manager can't guarantee
- Bad, because less documentation on iOS background BLE and state restoration (even though deferred to v2)
- Bad, because may need migration to ble-plx when sync requirements exceed ble-manager's capabilities

## Research Sources

- [Expo Blog — How to Build a BLE-Powered Expo App](https://expo.dev/blog/how-to-build-a-bluetooth-low-energy-powered-expo-app) — Expo's official guide uses react-native-ble-plx
- [LogRocket — Comparing React Native BLE Libraries](https://blog.logrocket.com/comparing-react-native-ble-libraries/) — feature comparison of ble-plx vs ble-manager
- [npm trends — ble-manager vs ble-plx](https://npmtrends.com/react-native-ble-manager-vs-react-native-ble-plx) — download comparison (90K vs 45K weekly)
- [react-native-ble-plx Wiki — Background Mode (iOS)](<https://github.com/dotintent/react-native-ble-plx/wiki/Background-mode-(iOS)>) — state restoration documentation
- [react-native-ble-plx Wiki — MTU Negotiation](https://github.com/dotintent/react-native-ble-plx/wiki/MTU-Negotiation) — platform-specific MTU behavior
- [react-native-ble-plx Wiki — Expo](https://github.com/dotintent/react-native-ble-plx/wiki/Expo) — Expo config plugin setup
- [Can I Use — Web Bluetooth](https://caniuse.com/web-bluetooth) — ~78% global support; no Safari, no Firefox
- [MDN — Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) — API reference and browser compatibility
- [Web Bluetooth CG — Implementation Status](https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md) — Mozilla position: "Harmful"

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — `packages/ble-protocol/` hosts Protobuf schemas, generated code, and now the shared BLE abstraction (transport interface + sync orchestration)
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — timer commands sent over BLE map to the `transition(state, event)` model; `BleTransport.write()` encodes timer events as Protobuf
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — BLE chunked sync is the transport layer for the device's outbox drain; phone receives sessions over BLE, then uses the HTTP outbox to upload to the API
- [ADR-007: API Architecture](./007-api-architecture.md) — phone converts BLE Protobuf to JSON for the Hono REST API; device never talks to the API directly
- [ADR-010: Physical Device Hardware Platform](./010-physical-device-hardware-platform.md) — device stores ~2,500 sessions locally; app-open sync drains this outbox when user opens the app near the device
- [ADR-012: Security & Data Privacy](./012-security-data-privacy.md) — BLE pairing is OS-managed (LE Secure Connections + Passkey Entry); no app-level authentication needed
- [ADR-013: BLE GATT Protocol Design](./013-ble-gatt-protocol-design.md) — defines the GATT services, characteristics, and chunked sync protocol that these client libraries implement
