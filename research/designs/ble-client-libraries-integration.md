# Design: BLE Client Libraries & Integration

**Date:** 2026-03-09
**Status:** Accepted
**Related ADR:** [ADR-016](../decisions/016-ble-client-libraries-integration.md)
**Platforms:** iOS app (primary central), Android app (central), web (progressive enhancement), macOS menu bar widget (fallback central, post-v1)

## Context & Scope

The PomoFocus physical device communicates exclusively via BLE (ADR-010). The GATT protocol is fully specified (ADR-013): 5 services, Protobuf encoding, adaptive MTU, and a chunked bulk transfer protocol for session sync. Each client platform needs a BLE implementation to scan for the device, connect, send timer/goal commands, and receive synced sessions.

The fundamental insight driving this design: BLE has two very different usage patterns in PomoFocus, and they have different complexity levels:

1. **Real-time control** (Timer Service, Goal Service) — small payloads, simple read/write/notify. Any BLE library can handle this.
2. **Bulk session sync** (Session Sync Service) — multi-packet chunked transfer with sequence numbers, acknowledgments, and cursor management. This requires a library with fine-grained GATT control.

## Goals & Non-Goals

**Goals:**

- Select BLE libraries for each client platform that can implement the full GATT protocol (ADR-013)
- Define a shared TypeScript abstraction in `packages/ble-protocol/` that separates transport (platform-specific) from sync orchestration (shared logic)
- Establish the sync trigger model (when does sync happen?)
- Define reconnection behavior (how does the app find the device?)

**Non-Goals:**

- Background BLE sync (explicitly deferred to v2 — iOS background BLE is unreliable and a major source of bugs)
- Multi-device support (one device per user for v1)
- BLE mesh or multi-central connections
- Firmware-side BLE stack choice (separate decision — Device Firmware Stack)
- iOS Widget BLE access (widgets can't use BLE directly — they read synced data from App Group)

## The Design

### Library Selection

| Platform      | Library                                | Why This One                                                                                                                                                                                                            |
| ------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS / Android | **react-native-ble-plx** v3.x          | Most full-featured RN BLE library (90K weekly downloads). MTU negotiation, multi-device support, guaranteed transactions. Expo config plugin — no ejecting. iOS state restoration support for future v2 background BLE. |
| Web           | **Web Bluetooth API** (browser native) | Only option. No library needed — it's a browser API. Chrome/Edge/Opera only (~78% global coverage). No Safari, no Firefox (Mozilla position: "Harmful").                                                                |
| macOS         | **CoreBluetooth** (Apple framework)    | Only option for macOS. CBCentralManager + CBPeripheralDelegate. SwiftUI-compatible.                                                                                                                                     |
| watchOS       | None                                   | Gets data through phone relay via WatchConnectivity (ADR-010).                                                                                                                                                          |

### Sync Trigger Model: App-Open Sync

```
User completes session on device
         ↓
Device stores session in flash outbox (~2,500 capacity)
         ↓
[time passes — phone may be in another room]
         ↓
User opens PomoFocus app on phone
         ↓
App scans for known device UUID (10s timeout)
         ↓
If found: connect → negotiate MTU → drain outbox (chunked sync per ADR-013)
         ↓
Sessions uploaded to Hono API → Supabase
         ↓
App updates local state → widget refreshes via WidgetCenter.reloadAllTimelines()
```

**Why not background sync:**

- iOS aggressively kills background BLE connections (30s-3min inactivity)
- State restoration is unreliable — iOS may take minutes to wake the app
- Android background BLE varies by manufacturer — Samsung/Xiaomi/Huawei kill background processes
- Would require Android foreground service with persistent notification
- Device stores ~10 months of sessions locally — zero data loss risk from delayed sync
- App-open sync eliminates the #1 source of BLE bugs in mobile development

**v2 upgrade path:** Add `restoreStateIdentifier` + `restoreStateFunction` to the BleManager constructor. The `BleTransport` interface doesn't change — background sync is just a different lifecycle trigger.

### Reconnection Strategy

```
App Launch / Tab Focus
         ↓
Check: is there a bonded device ID stored locally?
         ↓
  No → Show "Pair Device" UI (first-time setup)
  Yes → Start BLE scan (filter by device UUID, 10s timeout)
         ↓
    Not found → Show "Device not in range" with manual re-scan button
    Found → Connect → negotiate MTU → check sync_status characteristic
         ↓
      Outbox empty → done (device is current)
      Outbox has sessions → start chunked sync → show progress indicator
```

**Key behaviors:**

- Scan uses device UUID filtering (from ADR-013 advertising) — no broad scan needed
- Connection timeout: 10s scan, then 5s connection timeout
- Auto-retry: 1 retry with 2s delay on connection failure, then surface error to user
- Disconnect on app background (v1) — no persistent connections
- Store bonded device ID in expo-secure-store (mobile) / localStorage (web) / Keychain (macOS)

### Shared Abstraction: `packages/ble-protocol/`

The package has two layers:

**Layer 1: Transport interface (platform-specific)**

```typescript
interface BleTransport {
  // Lifecycle
  connect(deviceId: string, options?: ConnectOptions): Promise<BleConnection>;
  disconnect(): Promise<void>;

  // GATT operations
  read(serviceUuid: string, charUuid: string): Promise<Uint8Array>;
  write(serviceUuid: string, charUuid: string, data: Uint8Array): Promise<void>;
  subscribe(
    serviceUuid: string,
    charUuid: string,
    onData: (data: Uint8Array) => void,
  ): Subscription;

  // MTU
  negotiateMtu(requestedSize: number): Promise<number>;
}

interface ConnectOptions {
  timeoutMs?: number; // default: 5000
  requestMtu?: number; // default: 512
}

interface BleConnection {
  deviceId: string;
  mtu: number;
  isConnected: boolean;
}

interface Subscription {
  remove(): void;
}
```

**Layer 2: Sync orchestration (shared, pure logic)**

```typescript
// Chunked sync state machine — same code for mobile and web
class SyncOrchestrator {
  constructor(private transport: BleTransport) {}

  // Drain device outbox
  async syncSessions(onProgress: (synced: number, total: number) => void): Promise<Session[]>;

  // Push goals to device
  async pushGoals(goals: Goal[]): Promise<void>;

  // Send timer command
  async sendTimerCommand(command: TimerCommand): Promise<void>;

  // Read current timer state
  async readTimerState(): Promise<TimerState>;
}
```

The `SyncOrchestrator` handles:

- Reading `sync_status` to determine outbox size
- Writing `sync_control` to initiate sync and send acknowledgments
- Receiving `session_data` notifications and reassembling chunks
- Sequence number tracking and re-sync on errors
- Progress reporting for UI feedback

This is pure protocol logic — no platform-specific code. It calls `BleTransport` methods and handles the sync state machine from ADR-013.

**Implementation order:**

1. Build mobile BLE with react-native-ble-plx directly (no abstraction)
2. Get end-to-end sync working on iOS and Android
3. Extract `BleTransport` interface from the working mobile code
4. Move sync orchestration into `packages/ble-protocol/`
5. Implement `WebBluetoothTransport` adapter when web BLE is needed
6. Implement CoreBluetooth in Swift separately (can't share TypeScript)

### Platform-Specific Notes

**iOS (react-native-ble-plx):**

- Config plugin in app.json: `["react-native-ble-plx", { "isBackgroundEnabled": false, "modes": ["central"], "bluetoothAlwaysPermission": "PomoFocus uses Bluetooth to sync with your focus device" }]`
- Must use development build — ble-plx not included in Expo Go
- Testing requires physical device with Bluetooth hardware
- MTU: iOS auto-negotiates (typically 187 bytes)
- Pairing: OS-managed system dialog when device requests passkey

**Android (react-native-ble-plx):**

- Permissions: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (API 31+); `ACCESS_FINE_LOCATION` (API 30 and below)
- MTU: call `requestMTU(512)` after connection — not guaranteed but Android 14+ defaults to 517
- Pairing: OS-managed system dialog
- No background service needed for v1 (app-open sync)

**Web (Web Bluetooth API):**

- Must call `navigator.bluetooth.requestDevice()` from a user gesture (click/tap)
- No MTU control — browser handles negotiation
- No background mode — page must be open and focused
- Browser support: Chrome 56+, Edge 79+, Opera 43+, Samsung Internet 6.2+
- **No Safari, no Firefox** — show graceful fallback: "BLE sync requires Chrome or Edge. Use the mobile app for device sync."
- Web Bluetooth is progressive enhancement, not a primary sync path

**macOS (CoreBluetooth) — post-v1:**

- `CBCentralManager` + `CBPeripheralDelegate` in SwiftUI
- Same GATT profile — device doesn't care who connects
- Needs Bluetooth entitlement in macOS app
- Can share Protobuf definitions (generated Swift code from `packages/ble-protocol/proto/`)
- Sync orchestration must be reimplemented in Swift (same logic, different language)

### Expo Configuration

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-ble-plx",
        {
          "isBackgroundEnabled": false,
          "modes": ["central"],
          "bluetoothAlwaysPermission": "PomoFocus uses Bluetooth to sync with your focus device"
        }
      ]
    ]
  }
}
```

Build with: `npx expo prebuild` → `npx expo run:ios` (or `run:android`).

## Alternatives Considered

### react-native-ble-manager

Rejected because it explicitly lacks guaranteed transactions and raw packet handling — both needed for ADR-013's chunked sync protocol. Simpler API is a minor advantage that gets outweighed by feature gaps. Migration risk: would likely need to switch to ble-plx once sync implementation hits ble-manager's limitations.

### Background BLE sync (v1)

Rejected for v1 because iOS background BLE is the most complained-about topic in mobile BLE development. Apple can kill background connections unpredictably (30s-3min). State restoration exists but is unreliable. Android requires a foreground service with persistent notification, and even that is killed by aggressive manufacturer battery optimization (Samsung, Xiaomi, Huawei). The device stores ~10 months of sessions locally (ADR-010), so delayed sync is a UX annoyance, not a data loss risk. Deferred to v2 — upgrade path is straightforward (add `restoreStateIdentifier` to BleManager constructor).

### No shared abstraction (Option A)

Rejected because it leads to three independent sync implementations that can diverge. The chunk handling, ack logic, and cursor management from ADR-013 are substantial protocol code (~200+ lines) that should be written once. The pattern of shared pure logic with platform adapters is established by ADR-004 (timer) and ADR-006 (sync) — diverging from it here would be inconsistent.

## Cross-Cutting Concerns

- **Security:** Pairing is OS-managed via LE Secure Connections with Passkey Entry (ADR-012). No app-level authentication. Link encryption is AES-128-CCM after bonding. Session data (timestamps, durations) isn't sensitive enough for additional security layers.
- **Cost:** react-native-ble-plx is MIT licensed, free. Web Bluetooth is a browser API, free. CoreBluetooth is Apple framework, free. Total: $0/month.
- **Observability:** BLE connection events (connect, disconnect, sync start, sync complete, errors) should be logged locally for debugging. When Sentry is added per platform (ADR-011), BLE errors get captured as breadcrumbs. No dedicated BLE monitoring for v1.
- **Migration path (v2 background sync):** Add `restoreStateIdentifier` and `restoreStateFunction` to BleManager constructor. Add iOS background mode capability. Android: add foreground service. The `BleTransport` interface doesn't change — background sync is a lifecycle trigger, not a protocol change.

## Open Questions

1. **Web Bluetooth fallback UX** — When a user visits the web app in Safari or Firefox (no Web Bluetooth), what does the device sync section look like? "Use the mobile app" banner? Or hide the section entirely?
2. **Scan behavior on Android** — Some Android devices require location services enabled for BLE scanning (even with `BLUETOOTH_SCAN` permission). How do we handle the UX when location is off?
3. **Multi-device (v2)** — If a user has multiple PomoFocus devices (e.g., home and office), how does the app select which one to sync with? ble-plx supports multi-device, but the UX needs design.
