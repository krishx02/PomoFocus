# Design: BLE GATT Protocol

**Date:** 2026-03-09
**Status:** Accepted
**Related ADR:** [ADR-013](../decisions/013-ble-gatt-protocol-design.md)
**Platforms:** BLE device (peripheral), iOS app (central), Android app (central), macOS menu bar (fallback central), web (Web Bluetooth, progressive enhancement)

## Context & Scope

The PomoFocus BLE device (nRF52840, ADR-010) communicates exclusively via BLE with phone, Mac, or web as the central. The device runs a timer, displays goals, stores sessions offline, and syncs when connected. This design specifies the complete GATT protocol: service/characteristic definitions, Protobuf message schemas, MTU-adaptive chunking for bulk transfer, and the connection sync state machine.

The protocol must handle two distinct patterns:
1. **Real-time control** — timer state changes, goal selection (tiny payloads, instant delivery, while user interacts)
2. **Bulk sync** — outbox drain of 0-2,500 buffered sessions (~100 bytes each) when BLE reconnects after hours/days offline

## Goals & Non-Goals

**Goals:**
- Define complete GATT service and characteristic specifications implementable in firmware
- Specify Protobuf message schemas for all BLE data transfer
- Design a reliable bulk-transfer protocol for session sync with adaptive MTU
- Define the connection sync state machine (handshake sequence)
- Ensure protocol works across iOS, Android, macOS, and Web Bluetooth with their different MTU behaviors

**Non-Goals:**
- BLE client library choices (react-native-ble-plx, CoreBluetooth, Web Bluetooth API selection — separate ADR)
- DFU protocol details (Nordic's standard DFU is used as-is)
- Firmware implementation details (build toolchain, memory layout — separate ADR)
- BLE advertising parameters (interval, TX power — tuned during prototyping Phase 5)

---

## The Design

### UUID Scheme

All custom services and characteristics share a base UUID with an incrementing suffix:

```
Base UUID: PMFC{XXXX}-CAFE-FACE-DEAD-P0M0F0CUS00

Where PMFC = "PomoFocus" prefix (hex: 504D4643)
And {XXXX} is the service/characteristic identifier
```

**Actual UUIDs (128-bit):**

| Entity | UUID |
|--------|------|
| **Timer Service** | `504D4643-0001-CAFE-FACE-DEAD00000000` |
| Timer State characteristic | `504D4643-0101-CAFE-FACE-DEAD00000000` |
| Timer Command characteristic | `504D4643-0102-CAFE-FACE-DEAD00000000` |
| **Goal Service** | `504D4643-0002-CAFE-FACE-DEAD00000000` |
| Goal List characteristic | `504D4643-0201-CAFE-FACE-DEAD00000000` |
| Selected Goal characteristic | `504D4643-0202-CAFE-FACE-DEAD00000000` |
| **Session Sync Service** | `504D4643-0003-CAFE-FACE-DEAD00000000` |
| Sync Status characteristic | `504D4643-0301-CAFE-FACE-DEAD00000000` |
| Session Data characteristic (bulk TX) | `504D4643-0302-CAFE-FACE-DEAD00000000` |
| Sync Control characteristic (bulk RX) | `504D4643-0303-CAFE-FACE-DEAD00000000` |
| **Device Info Service** | `0x180A` (BLE SIG standard) |
| **DFU Service** | Nordic standard UUID |

**UUID naming convention:** First two hex digits of the characteristic suffix match the service (`01xx` for Timer, `02xx` for Goal, `03xx` for Session Sync). This makes debugging with nRF Connect easy — you can tell which service a characteristic belongs to by its UUID.

---

### Service 1: Timer Service (`0001`)

Controls the timer state machine (ADR-004) in real-time over BLE.

#### Timer State Characteristic (`0101`)

| Property | Value |
|----------|-------|
| UUID | `504D4643-0101-CAFE-FACE-DEAD00000000` |
| Properties | Read, Notify |
| Security | Encrypted (requires bonding) |
| Max size | ~30 bytes |

**Protobuf message:**

```protobuf
message TimerState {
  TimerPhase phase = 1;           // idle, focusing, paused, short_break, long_break, break_paused, reflection, completed, abandoned
  uint32 remaining_seconds = 2;   // seconds remaining in current phase
  uint32 elapsed_seconds = 3;     // seconds elapsed in current phase
  bytes goal_id = 4;              // UUID of active goal (16 bytes), empty if none
  uint32 session_count = 5;       // completed sessions in current cycle (for long break calculation)
}

enum TimerPhase {
  TIMER_PHASE_IDLE = 0;
  TIMER_PHASE_FOCUSING = 1;
  TIMER_PHASE_PAUSED = 2;
  TIMER_PHASE_SHORT_BREAK = 3;
  TIMER_PHASE_LONG_BREAK = 4;
  TIMER_PHASE_BREAK_PAUSED = 5;
  TIMER_PHASE_REFLECTION = 6;
  TIMER_PHASE_COMPLETED = 7;
  TIMER_PHASE_ABANDONED = 8;
}
```

**Behavior:**
- Device sends notification on every state transition (start, pause, resume, break, complete, abandon)
- Device does NOT send per-second countdown notifications (wasteful; phone calculates from `remaining_seconds` + local clock)
- Phone reads on connection to get current state

#### Timer Command Characteristic (`0102`)

| Property | Value |
|----------|-------|
| UUID | `504D4643-0102-CAFE-FACE-DEAD00000000` |
| Properties | Write |
| Security | Encrypted (requires bonding) |
| Max size | ~20 bytes |

**Protobuf message:**

```protobuf
message TimerCommand {
  TimerAction action = 1;
  bytes goal_id = 2;              // required for START, ignored for others
  uint32 focus_duration = 3;      // optional override in seconds (0 = use device default)
}

enum TimerAction {
  TIMER_ACTION_START = 0;
  TIMER_ACTION_PAUSE = 1;
  TIMER_ACTION_RESUME = 2;
  TIMER_ACTION_ABANDON = 3;
  TIMER_ACTION_SKIP_BREAK = 4;
  TIMER_ACTION_RATE_SESSION = 5;  // focus_quality in goal_id field (reused, 1-5)
}
```

**Behavior:**
- Phone writes a command; device processes via `transition(state, event) → newState`
- Device responds with a Timer State notification (confirmation)
- Invalid commands (e.g., PAUSE when idle) are silently ignored (device state machine rejects them)

---

### Service 2: Goal Service (`0002`)

Manages the goal list displayed on the device's e-ink screen.

#### Goal List Characteristic (`0201`)

| Property | Value |
|----------|-------|
| UUID | `504D4643-0201-CAFE-FACE-DEAD00000000` |
| Properties | Write |
| Security | Encrypted (requires bonding) |
| Max size | up to MTU × N chunks (uses same chunking as Session Sync for large goal lists) |

**Protobuf message:**

```protobuf
message GoalList {
  repeated Goal goals = 1;       // ordered list, max ~10 goals
}

message Goal {
  bytes id = 1;                   // UUID (16 bytes)
  string title = 2;              // goal title, max 100 chars
  GoalType type = 3;
  uint32 target_sessions = 4;    // daily target (process goals)
  uint32 completed_today = 5;    // sessions completed today
}

enum GoalType {
  GOAL_TYPE_LONG_TERM = 0;
  GOAL_TYPE_PROCESS = 1;
}
```

**Behavior:**
- Phone writes the full goal list on every sync (replace, not delta)
- If the goal list exceeds MTU, use the chunked transfer protocol (same as Session Sync but phone→device direction)
- Device caches in flash; survives power cycles
- Device shows goals on e-ink for user selection via rotary encoder

#### Selected Goal Characteristic (`0202`)

| Property | Value |
|----------|-------|
| UUID | `504D4643-0202-CAFE-FACE-DEAD00000000` |
| Properties | Read, Notify |
| Security | Encrypted (requires bonding) |
| Max size | 16 bytes |

**Protobuf message:**

```protobuf
message SelectedGoal {
  bytes goal_id = 1;             // UUID of selected goal (16 bytes), empty if none
}
```

**Behavior:**
- Device notifies when user selects a goal via rotary encoder
- Phone reads on connection to check current selection

---

### Service 3: Session Sync Service (`0003`)

Handles bulk transfer of buffered sessions from device to phone (outbox drain per ADR-006).

#### Sync Status Characteristic (`0301`)

| Property | Value |
|----------|-------|
| UUID | `504D4643-0301-CAFE-FACE-DEAD00000000` |
| Properties | Read, Notify |
| Security | Encrypted (requires bonding) |
| Max size | ~20 bytes |

**Protobuf message:**

```protobuf
message SyncStatus {
  uint32 pending_sessions = 1;    // sessions in outbox waiting to upload
  uint32 total_stored = 2;        // total sessions in flash (including uploaded)
  bytes last_synced_id = 3;       // UUID of last successfully synced session (16 bytes)
  SyncState state = 4;
}

enum SyncState {
  SYNC_STATE_IDLE = 0;            // no sync in progress
  SYNC_STATE_READY = 1;           // sessions available, waiting for phone to start
  SYNC_STATE_TRANSFERRING = 2;    // bulk transfer in progress
  SYNC_STATE_COMPLETE = 3;        // transfer complete, waiting for ack
  SYNC_STATE_ERROR = 4;           // transfer failed
}
```

**Behavior:**
- Phone reads on connection to determine if sync is needed
- Device notifies on state changes during sync process
- `pending_sessions` lets the phone show a progress indicator

#### Session Data Characteristic (`0302`) — Bulk TX

| Property | Value |
|----------|-------|
| UUID | `504D4643-0302-CAFE-FACE-DEAD00000000` |
| Properties | Notify |
| Security | Encrypted (requires bonding) |
| Max size | MTU - 3 bytes per notification |

**Protobuf message (per session):**

```protobuf
message SessionRecord {
  bytes id = 1;                    // UUID (16 bytes) — idempotency key per ADR-005
  bytes goal_id = 2;              // UUID of associated goal
  int64 started_at = 3;           // Unix timestamp (seconds)
  int64 ended_at = 4;             // Unix timestamp (seconds)
  uint32 planned_duration = 5;    // planned duration in seconds
  uint32 actual_duration = 6;     // actual duration in seconds
  SessionType type = 7;
  SessionOutcome outcome = 8;
  uint32 focus_quality = 9;       // 1-5 self-reported rating (0 = not rated)
  string intention = 10;          // session intention text, max 200 chars
  string reflection = 11;         // post-session reflection, max 500 chars
  string distraction_note = 12;   // what pulled attention, max 200 chars
}

enum SessionType {
  SESSION_TYPE_FOCUS = 0;
  SESSION_TYPE_SHORT_BREAK = 1;
  SESSION_TYPE_LONG_BREAK = 2;
}

enum SessionOutcome {
  SESSION_OUTCOME_COMPLETED = 0;
  SESSION_OUTCOME_ABANDONED = 1;
}
```

**Chunked Transfer Protocol:**

```
┌──────────────────────────────────────────────────────┐
│ Chunk Header (4 bytes) + Protobuf Payload            │
├────────┬────────┬────────┬────────┬──────────────────┤
│ SeqNum │ Total  │ Flags  │ Resrvd │ Payload bytes    │
│ 1 byte │ 1 byte │ 1 byte │ 1 byte │ (MTU - 7) bytes  │
└────────┴────────┴────────┴────────┴──────────────────┘

SeqNum:  0-indexed chunk sequence number (0-255)
Total:   total chunks for this session record (1 = fits in single packet)
Flags:   bit 0 = first chunk of session, bit 1 = last chunk of session,
         bit 2 = last session in batch (end of sync)
Reserved: 0x00 (future use)
Payload: Protobuf-encoded SessionRecord bytes (or partial if chunked)
```

**Transfer flow:**

```
Device                              Phone
  │                                   │
  │◄── Subscribe to Session Data ─────│
  │◄── Write Sync Control: START ─────│
  │                                   │
  │── Notify: Chunk [0/1] Session 1 ─►│
  │── Notify: Chunk [0/1] Session 2 ─►│
  │── Notify: Chunk [0/1] Session 3 ─►│  (small sessions: 1 chunk each)
  │   ...                             │
  │── Notify: Chunk [0/3] Session N ─►│  (large session: 3 chunks)
  │── Notify: Chunk [1/3] Session N ─►│
  │── Notify: Chunk [2/3] Session N ─►│  (flags: last chunk + last session)
  │                                   │
  │◄── Write Sync Control: ACK(N) ────│  (phone confirms receipt of N sessions)
  │                                   │
  │── Notify: SyncStatus COMPLETE ───►│
  │                                   │
```

**Reliability:**
- Phone tracks received sequence numbers per session
- If a chunk is missing (gap in sequence), phone writes `NACK(session_index)` to Sync Control — device retransmits from that session
- If connection drops mid-transfer, phone writes `START` again on reconnect — device resumes from the last ACK'd session
- Sessions are only marked as "uploaded" in the device's circular buffer after the phone sends a final ACK

#### Sync Control Characteristic (`0303`) — Bulk RX

| Property | Value |
|----------|-------|
| UUID | `504D4643-0303-CAFE-FACE-DEAD00000000` |
| Properties | Write |
| Security | Encrypted (requires bonding) |
| Max size | ~20 bytes |

**Protobuf message:**

```protobuf
message SyncControl {
  SyncCommand command = 1;
  uint32 ack_count = 2;          // number of sessions successfully received (for ACK)
  bytes last_synced_id = 3;       // UUID of last synced session (for CURSOR_UPDATE)
}

enum SyncCommand {
  SYNC_COMMAND_START = 0;         // start/resume bulk transfer
  SYNC_COMMAND_ACK = 1;           // acknowledge receipt of ack_count sessions
  SYNC_COMMAND_NACK = 2;          // request retransmit from ack_count position
  SYNC_COMMAND_ABORT = 3;         // cancel current transfer
  SYNC_COMMAND_CURSOR_UPDATE = 4; // update sync cursor (after phone uploads to cloud)
}
```

**Behavior:**
- `START`: device begins sending sessions from oldest un-synced
- `ACK(N)`: phone confirms N sessions received; device can mark them for overwrite
- `NACK(N)`: phone requests retransmit starting from session N
- `ABORT`: cancel current transfer (e.g., phone going to background)
- `CURSOR_UPDATE`: phone has uploaded sessions to cloud; device permanently marks them as synced

---

### Service 4: Device Information Service (`0x180A`)

Standard BLE SIG service. No custom implementation needed.

| Characteristic | UUID (SIG) | Properties | Value |
|----------------|------------|------------|-------|
| Manufacturer Name | `0x2A29` | Read | "PomoFocus" |
| Model Number | `0x2A24` | Read | "PF-001" |
| Firmware Revision | `0x2A26` | Read | Semantic version (e.g., "1.0.0") |
| Battery Level | `0x2A19` (Battery Service `0x180F`) | Read, Notify | 0-100 (percentage) |

**Note:** Battery Level is technically its own service (`0x180F`) per BLE SIG. Both Device Info and Battery are standard services with built-in support in most BLE stacks.

---

### Service 5: DFU Service

Uses Nordic's standard Secure DFU service. The UUID and protocol are defined by Nordic's DFU bootloader. No custom design needed — the firmware includes Nordic's DFU library and the phone uses Nordic's DFU library (available for iOS, Android, and web).

---

### MTU Negotiation Strategy

```
Connection established
        │
        ▼
Phone requests MTU exchange (platform-dependent):
  - Android: requestMtu(512)
  - iOS: automatic (typically 185-255)
  - macOS: automatic (typically 185-255)
  - Web Bluetooth: automatic (varies)
        │
        ▼
BLE stack negotiates: effective_mtu = min(phone_mtu, device_mtu)
Device supports up to 247 bytes (nRF52840 default max)
        │
        ▼
Both sides compute: chunk_payload_size = effective_mtu - 3 (ATT header) - 4 (chunk header)
        │
        ▼
Minimum guaranteed: 23 - 3 - 4 = 16 bytes payload per chunk
Typical iOS/macOS:  185 - 3 - 4 = 178 bytes payload per chunk
Best case Android:  247 - 3 - 4 = 240 bytes payload per chunk
```

**Implementation note:** The chunk header is 4 bytes (sequence, total, flags, reserved). This overhead is per-chunk. For sessions that fit in a single chunk (most will, at typical MTUs), the overhead is minimal.

---

### Connection Sync State Machine

When a central (phone/Mac/web) connects to the device, this handshake runs:

```
┌─────────────────────────────────────────────────────────┐
│                  CONNECTION ESTABLISHED                   │
│            (BLE link encrypted via bonding)               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 1: SERVICE DISCOVERY                               │
│  Phone discovers all GATT services and characteristics   │
│  (~200-500ms, one-time per connection)                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: SUBSCRIBE TO NOTIFICATIONS                      │
│  Phone enables CCCD on:                                  │
│    - Timer State (0101)                                  │
│    - Selected Goal (0202)                                │
│    - Sync Status (0301)                                  │
│    - Session Data (0302) — only during sync              │
│    - Battery Level (0x2A19)                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: READ CURRENT STATE                              │
│  Phone reads:                                            │
│    - Timer State → update phone UI                       │
│    - Selected Goal → update phone UI                     │
│    - Sync Status → check pending_sessions count          │
│    - Battery Level → update phone UI                     │
│  (~50-100ms total)                                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: PUSH GOALS (phone → device)                    │
│  Phone writes GoalList to Goal List characteristic       │
│  Device caches in flash                                  │
│  (~100-200ms depending on goal count)                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: SESSION SYNC (if pending_sessions > 0)         │
│  Phone writes START to Sync Control                      │
│  Device streams sessions via Session Data notifications  │
│  Phone sends ACK after receiving all sessions            │
│  Phone uploads to cloud via Hono API (ADR-007)           │
│  Phone writes CURSOR_UPDATE to confirm cloud upload      │
│  (~1-60s depending on session count)                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 6: STEADY STATE                                    │
│  Real-time notifications flow:                           │
│    - Timer state changes (device → phone)                │
│    - Goal selection changes (device → phone)             │
│    - Timer commands (phone → device)                     │
│  Connection maintained until user walks away or          │
│  phone goes to background (iOS BLE background limits)    │
└─────────────────────────────────────────────────────────┘
```

**Reconnection behavior:**
- After disconnection, device resumes BLE advertising
- On reconnect, the full handshake runs again (Steps 1-6)
- Session sync resumes from the last ACK'd position (not from the beginning)
- Goals are re-pushed every connection (simple replace, not delta)

---

### Protobuf Schema File

All messages defined above live in a single `.proto` file:

**File:** `packages/ble-protocol/proto/pomofocus.proto`

```protobuf
syntax = "proto3";
package pomofocus.ble;

// === Timer Service ===

enum TimerPhase {
  TIMER_PHASE_IDLE = 0;
  TIMER_PHASE_FOCUSING = 1;
  TIMER_PHASE_PAUSED = 2;
  TIMER_PHASE_SHORT_BREAK = 3;
  TIMER_PHASE_LONG_BREAK = 4;
  TIMER_PHASE_BREAK_PAUSED = 5;
  TIMER_PHASE_REFLECTION = 6;
  TIMER_PHASE_COMPLETED = 7;
  TIMER_PHASE_ABANDONED = 8;
}

enum TimerAction {
  TIMER_ACTION_START = 0;
  TIMER_ACTION_PAUSE = 1;
  TIMER_ACTION_RESUME = 2;
  TIMER_ACTION_ABANDON = 3;
  TIMER_ACTION_SKIP_BREAK = 4;
  TIMER_ACTION_RATE_SESSION = 5;
}

message TimerState {
  TimerPhase phase = 1;
  uint32 remaining_seconds = 2;
  uint32 elapsed_seconds = 3;
  bytes goal_id = 4;
  uint32 session_count = 5;
}

message TimerCommand {
  TimerAction action = 1;
  bytes goal_id = 2;
  uint32 focus_duration = 3;
}

// === Goal Service ===

enum GoalType {
  GOAL_TYPE_LONG_TERM = 0;
  GOAL_TYPE_PROCESS = 1;
}

message Goal {
  bytes id = 1;
  string title = 2;
  GoalType type = 3;
  uint32 target_sessions = 4;
  uint32 completed_today = 5;
}

message GoalList {
  repeated Goal goals = 1;
}

message SelectedGoal {
  bytes goal_id = 1;
}

// === Session Sync Service ===

enum SessionType {
  SESSION_TYPE_FOCUS = 0;
  SESSION_TYPE_SHORT_BREAK = 1;
  SESSION_TYPE_LONG_BREAK = 2;
}

enum SessionOutcome {
  SESSION_OUTCOME_COMPLETED = 0;
  SESSION_OUTCOME_ABANDONED = 1;
}

enum SyncState {
  SYNC_STATE_IDLE = 0;
  SYNC_STATE_READY = 1;
  SYNC_STATE_TRANSFERRING = 2;
  SYNC_STATE_COMPLETE = 3;
  SYNC_STATE_ERROR = 4;
}

enum SyncCommand {
  SYNC_COMMAND_START = 0;
  SYNC_COMMAND_ACK = 1;
  SYNC_COMMAND_NACK = 2;
  SYNC_COMMAND_ABORT = 3;
  SYNC_COMMAND_CURSOR_UPDATE = 4;
}

message SessionRecord {
  bytes id = 1;
  bytes goal_id = 2;
  int64 started_at = 3;
  int64 ended_at = 4;
  uint32 planned_duration = 5;
  uint32 actual_duration = 6;
  SessionType type = 7;
  SessionOutcome outcome = 8;
  uint32 focus_quality = 9;
  string intention = 10;
  string reflection = 11;
  string distraction_note = 12;
}

message SyncStatus {
  uint32 pending_sessions = 1;
  uint32 total_stored = 2;
  bytes last_synced_id = 3;
  SyncState state = 4;
}

message SyncControl {
  SyncCommand command = 1;
  uint32 ack_count = 2;
  bytes last_synced_id = 3;
}
```

**Code generation targets:**
- TypeScript: `npx protoc --ts_out` → `packages/ble-protocol/generated/ts/`
- Swift: `protoc --swift_out` → `native/apple/shared/Generated/`
- C++: Nanopb `nanopb_generator` → `firmware/device/generated/` (ADR-015; full `protoc --cpp_out` rejected — too large for nRF52840 flash)

---

## Alternatives Considered

### Multi-Service Custom GATT (without bulk transfer)
Rejected because session sync (50+ records × ~100 bytes) doesn't fit naturally into a simple notify characteristic. You'd end up inventing the chunking protocol anyway — bolted onto a structure that wasn't designed for it. Simpler on paper but harder in practice.

### NUS-Style Stream
Rejected because timer commands could be queued behind session data in a FIFO byte stream. The PomoFocus device needs instant timer control (user pauses from phone) independent of bulk sync. Nordic explicitly states NUS is not meant for production use. The opaque byte stream loses the semantic clarity that makes debugging with nRF Connect easy.

## Cross-Cutting Concerns

- **Security:** All custom characteristics require bonding (encrypted link per ADR-012). GATT table is discoverable before pairing (standard consumer pattern) but no data can be read without authentication. The Sync Control characteristic (write) requires encryption — prevents unauthorized session injection.

- **Cost:** Zero additional cost. The GATT protocol runs on the existing nRF52840 hardware. Protobuf code generation is free. No cloud services involved in BLE communication.

- **Observability:** Sync Status characteristic (`pending_sessions`, `state`) provides real-time sync progress to the phone UI. Battery Level is standard BLE with built-in support in most phone OSes. Firmware version is readable via Device Info Service. For development debugging: nRF Connect mobile app can read all characteristics and subscribe to notifications.

- **Migration path:** If the protocol needs to change post-deployment:
  1. **Adding characteristics:** Non-breaking. Old clients ignore new characteristics.
  2. **Adding Protobuf fields:** Non-breaking. Proto3 ignores unknown fields.
  3. **Changing characteristic properties:** Breaking. Requires coordinated firmware + app update via DFU.
  4. **Changing UUIDs:** Breaking. Requires re-pairing. Avoid.

## Open Questions

1. ~~**Nanopb vs full protoc for firmware C++ generation:**~~ Resolved — Nanopb chosen. See [ADR-015: Device Firmware Toolchain](../decisions/015-device-firmware-toolchain.md). ~2-5KB flash, no dynamic allocation, wire-compatible output. Full protoc C++ rejected (~150-200KB flash, uses `malloc`). Does NOT affect the GATT protocol design.

2. **Connection interval tuning:** The default BLE connection interval (~30ms) may be too frequent for idle state (wastes battery) or too slow for bulk transfer (limits throughput). iOS allows 15ms-2000ms. Fine-tune during prototyping Phase 8 (power optimization).

3. **Goal list delta sync:** Currently the phone sends the full goal list on every connection. If goal lists grow large (>10 goals with long titles), a delta-based approach (send only changes) would reduce transfer time. Defer until this becomes a real problem.

4. **Web Bluetooth characteristic limit:** Some Web Bluetooth implementations have a limit on the number of characteristics that can be discovered in a single session. Test with Chrome during prototyping Phase 5. If this is an issue, the web client may need to discover services selectively.
