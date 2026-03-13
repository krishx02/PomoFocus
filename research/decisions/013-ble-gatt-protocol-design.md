# ADR-013: BLE GATT Protocol Design

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 1-2 (System/Container — protocol spanning firmware peripheral and 4 client centrals)
**Platforms:** BLE device (peripheral), iOS app (central), Android app (central), macOS menu bar (fallback central), web (Web Bluetooth, progressive enhancement)

## Context and Problem Statement

ADR-010 chose the nRF52840-based PomoFocus device with BLE 5.0 connectivity and sketched 5 GATT services at a high level (Timer, Goal, Session, Device Info, DFU). ADR-006 defined the outbox sync pattern where the device buffers sessions locally and uploads when BLE reconnects. ADR-012 chose LE Secure Connections with Passkey Entry for pairing security. What remains is the exact GATT protocol specification: service UUIDs, characteristic definitions with properties, data encoding details, MTU negotiation and chunking strategy, and the sync state machine that runs when the phone connects. This is a one-way-door decision — GATT UUIDs and characteristic structures are baked into firmware and all 4 client platforms.

## Decision Drivers

- **One-way door** — GATT UUIDs and characteristic structures are embedded in firmware and 4 client platforms; changing them post-deployment requires coordinated firmware + app updates
- **Data integrity** — no session data can be lost during BLE sync (ADR-006 driver #1)
- **Two distinct data patterns** — real-time control (timer state, goal selection: tiny payloads, instant delivery) and bulk sync (outbox drain: many sessions, reliable transfer)
- **Cross-platform compatibility** — protocol must work with iOS (auto-negotiated MTU), Android (requestable MTU), macOS (auto-negotiated), and Web Bluetooth (no MTU control)
- **Payload efficiency** — BLE packets are small (20-509 bytes usable); encoding must be compact
- **Beginner-friendly firmware** — project lead has zero hardware experience; protocol must be implementable with Arduino framework

## Considered Options

1. **Multi-Service Custom GATT** — 5 separate domain-mapped services with simple read/write/notify characteristics per data type
2. **NUS-Style Stream + Control Service** — Nordic UART Service pattern (TX/RX byte stream) for all data, plus a dedicated Timer Control Service
3. **Hybrid — Structured Services + Chunked Bulk Transfer** — domain-mapped services for real-time data (timer, goals) plus a dedicated Session Sync Service with a chunked reliable-transfer protocol

## Decision Outcome

Chosen option: **"Hybrid — Structured Services + Chunked Bulk Transfer"**, because PomoFocus has two fundamentally different data patterns (real-time control vs bulk sync) that require different transfer strategies. Timer and goal operations need instant, dedicated characteristics. Session sync needs a reliable bulk transfer that can drain the outbox of 50+ sessions efficiently. The hybrid approach gives each pattern the right tool while keeping GATT service boundaries semantically clean.

### GATT Profile Overview

| Service                    | UUID Suffix             | Purpose                                      | Direction                                          |
| -------------------------- | ----------------------- | -------------------------------------------- | -------------------------------------------------- |
| Timer Service              | `0001`                  | Real-time timer state and commands           | Bidirectional                                      |
| Goal Service               | `0002`                  | Phone pushes goals, device reports selection | Phone → Device (goals), Device → Phone (selection) |
| Session Sync Service       | `0003`                  | Bulk session transfer with chunking protocol | Device → Phone (sessions), Phone → Device (cursor) |
| Device Information Service | `0x180A` (SIG standard) | Battery, firmware version, device name       | Device → Phone                                     |
| DFU Service                | Nordic standard         | Over-the-air firmware updates                | Phone → Device                                     |

### Key Protocol Decisions

| Decision              | Choice                     | Why                                                                                                              |
| --------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Service architecture  | Hybrid (structured + bulk) | Real-time control and bulk sync need different transfer strategies                                               |
| Data encoding         | Protobuf (per ADR-010)     | 3x smaller than JSON; compact over BLE; cross-platform code generation (TS + Swift + C++)                        |
| MTU strategy          | Adaptive                   | Read negotiated MTU after connection; chunk at `MTU - 3` bytes; handles 20-509 byte range across all 4 platforms |
| Advertising           | Open                       | Device name + primary service UUID in advertisements; standard consumer pattern; no data exposed before pairing  |
| Phone data conversion | Protobuf → JSON            | Phone deserializes BLE Protobuf, re-serializes as JSON for Hono API (ADR-007); clean architectural separation    |
| Reliability           | Application-level ack      | Bulk transfer uses sequence numbers + acknowledgments; handles BLE stack packet drops per Memfault guidance      |
| UUID scheme           | 128-bit with shared base   | `PMFC0001-CAFE-FACE-DEAD-POMOFOCUS00` pattern; increment suffix per service/characteristic                       |

### Consequences

- **Good:** Protocol correctly structured for both real-time control and bulk sync from day one. One-way-door UUIDs are right the first time. Adaptive MTU maximizes sync speed (5x faster than fixed minimum). Protobuf keeps payloads compact. Standard Device Info and DFU services require zero custom work. Clean separation: firmware speaks Protobuf, API speaks JSON, phone bridges them.
- **Bad:** Building a custom chunked-transfer protocol adds ~200 lines of firmware code and matching phone-side code — engineering investment for a personal prototype. Protobuf→JSON conversion on the phone is an extra step (trivial but exists). More GATT attributes than NUS approach means slightly longer service discovery time.
- **Neutral:** The chunking protocol implementation can start simple (sequential notifies, re-sync on failure) and evolve to full reliability (sequence numbers, retransmit) as real-world failure patterns are observed. The protocol complexity is localized to Session Sync Service — Timer and Goal services remain trivially simple.

## Pros and Cons of the Options

### Multi-Service Custom GATT

- Good, because semantic clarity — each service maps to a domain concept
- Good, because per-characteristic properties match data flow naturally
- Good, because phone can subscribe selectively (only timer notifications during active session)
- Good, because aligns with BLE design philosophy per [NovelBits GATT design guide](https://novelbits.io/bluetooth-gatt-services-characteristics/)
- Bad, because session sync (multiple ~100-byte records) doesn't fit neatly into a single notify characteristic — needs ad-hoc chunking
- Bad, because no dedicated bulk transfer mechanism — would end up reinventing one anyway

### NUS-Style Stream + Control Service

- Good, because simpler GATT table — fewer characteristics
- Good, because proven pattern for large data transfer per [Nordic DevZone](https://devzone.nordicsemi.com/f/nordic-q-a/72373/nus-or-custom-service)
- Good, because natively supported by nRF Connect debugging app
- Bad, because loses semantic clarity — all data is an opaque byte stream
- Bad, because can't selectively subscribe to specific data types
- Bad, because timer commands could be queued behind session data in a FIFO pipe
- Bad, because Nordic explicitly says NUS is ["not meant to be used directly in end products"](https://devzone.nordicsemi.com/f/nordic-q-a/72373/nus-or-custom-service)

### Hybrid — Structured Services + Chunked Bulk Transfer

- Good, because best of both worlds — semantic services for real-time, efficient streaming for bulk
- Good, because session sync gets a purpose-built reliable-transfer protocol
- Good, because timer and goal operations remain instant and simple
- Good, because sync_status characteristic enables progress indication on phone
- Good, because maps cleanly to existing outbox sync pattern (ADR-006)
- Bad, because most complex to implement — custom reliability layer needed
- Bad, because application-level reliability needed for chunked transfer per [Memfault BLE throughput guide](https://interrupt.memfault.com/blog/ble-throughput-primer)

## Research Sources

- [NovelBits — Bluetooth GATT: How to Design Custom Services & Characteristics](https://novelbits.io/bluetooth-gatt-services-characteristics/) — comprehensive GATT design guide
- [Nordic DevZone — NUS or Custom Service](https://devzone.nordicsemi.com/f/nordic-q-a/72373/nus-or-custom-service) — Nordic's guidance on when to use NUS vs custom GATT
- [Punch Through — Maximizing BLE Throughput Part 2: Use Larger ATT MTU](https://punchthrough.com/maximizing-ble-throughput-part-2-use-larger-att-mtu/) — MTU negotiation best practices
- [Memfault — A Practical Guide to BLE Throughput](https://interrupt.memfault.com/blog/ble-throughput-primer) — application-level reliability for BLE transfers
- [react-native-ble-plx Wiki — MTU Negotiation](https://github.com/dotintent/react-native-ble-plx/wiki/MTU-Negotiation) — platform-specific MTU behavior
- [Punch Through — Maximizing BLE Throughput Part 4](https://punchthrough.com/ble-throughput-part-4/) — comprehensive throughput optimization
- [DynGATT — Dynamic GATT-based Data Synchronization Protocol](https://www.sciencedirect.com/science/article/pii/S1389128623000051) — academic research on GATT-based sync
- [Adafruit — Introduction to BLE: GATT](https://learn.adafruit.com/introduction-to-bluetooth-low-energy/gatt) — beginner-friendly GATT overview
- [Beginner's Guide to Custom BLE Services with nRF52840 (2025)](https://hardfault.in/2025/03/12/beginners-guide-to-custom-ble-services-with-nrf52840/) — nRF52840-specific tutorial

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — `packages/ble-protocol/` defines Protobuf schemas and generated code shared between TS, Swift, and C++
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — timer states exposed via Timer Service characteristics match the `transition(state, event) → newState` model
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — session records synced via BLE map to the `sessions` table; client-generated UUIDs enable idempotent inserts
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — BLE session sync is the outbox drain mechanism for the device; same pattern as other platforms
- [ADR-007: API Architecture](./007-api-architecture.md) — phone converts BLE Protobuf to JSON for the Hono REST API; device never talks to the API directly
- [ADR-010: Physical Device Hardware Platform](./010-physical-device-hardware-platform.md) — hardware platform, GPIO allocation, BLE 5.0, Protobuf encoding decision
- [ADR-012: Security & Data Privacy](./012-security-data-privacy.md) — BLE LE Secure Connections with Passkey Entry + Bonding; link-layer AES-128-CCM encryption
- [ADR-015: Device Firmware Toolchain](./015-device-firmware-toolchain.md) — PlatformIO build system, Nanopb for Protobuf encoding on the device side
- [ADR-016: BLE Client Libraries & Integration](./016-ble-client-libraries-integration.md) — client-side BLE libraries that implement this GATT protocol; app-open sync trigger for v1
- [ADR-019: Notification Strategy](./019-notification-strategy.md) — BLE device timer end uses firmware-controlled vibration; encouragement tap vibration via BLE is post-v1
