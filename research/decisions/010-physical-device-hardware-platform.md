# ADR-010: Physical Device Hardware Platform

**Status:** Accepted
**Date:** 2026-03-08
**Decision-makers:** Project lead
**Zoom level:** Level 1 (System)
**Platforms:** BLE device, iOS app (BLE central), Android app (BLE central), macOS menu bar (BLE fallback central), web (Web Bluetooth progressive enhancement)

## Context and Problem Statement

PomoFocus includes a physical desk companion device — a dedicated Pomodoro timer with e-ink display that enables phone-away focus sessions. The device needs to run a timer, display goals, accept user input, store sessions offline, and sync with the phone via BLE. The project lead has zero hardware experience, so the hardware platform must balance technical capability with learnability. This decision covers: microcontroller, display, input method, feedback actuators, battery, and connectivity architecture.

## Decision Drivers

- **Battery life** — the device should last weeks-to-months on a single charge, behaving like a Kindle (calm technology: forget the battery exists)
- **Display quality and aesthetics** — aligned with the PomoFocus design philosophy (wabi-sabi, quiet luxury, Dieter Rams, Teenage Engineering); the device should be an object you want on your desk
- **Cost and availability** — parts should be affordable, globally available, and sourceable from mainstream suppliers (Seeed Studio, Adafruit, Waveshare)
- **BLE efficiency** — the device communicates exclusively via BLE; WiFi is unnecessary per the sync architecture (device syncs through phone, phone syncs to cloud)
- **Beginner-friendliness** — Arduino IDE compatibility, good documentation, active community
- **GPIO sufficiency** — enough pins for display, input, and feedback without external expanders

## Considered Options

1. **nRF52840 (Seeed XIAO) — BLE power champion**
2. **ESP32-S3 (LILYGO T5) — full-featured with integrated e-ink**
3. **ESP32-C6 (Seeed XIAO) — middle ground**

## Decision Outcome

Chosen option: **"nRF52840 (Seeed XIAO)"**, because it is the most power-efficient BLE microcontroller available, the device does not need WiFi (all sync goes through the phone per the existing sync architecture), and the Seeed XIAO ecosystem provides beginner-friendly tooling (Arduino IDE, USB-C, built-in battery charging) at the lowest cost.

### Hardware Bill of Materials (Prototype)

| Component | Part | Est. Cost | GPIO Pins |
|-----------|------|-----------|-----------|
| MCU + Driver Board | Seeed XIAO ePaper Driver Board EN04 (nRF52840 Plus built in, battery charging, USB-C, 3 user buttons, NFC, 24-pin + 50-pin FPC) | $10 | — |
| Display | 4.26" e-ink (B/W), 800x480, GDEQ0426T82 (SSD1677), 219 PPI, 24-pin FPC | $16 | 6 (SPI via EN04 board) |
| Input | KY-040 rotary encoder with push button | $2 | 3 (CLK, DT, SW) |
| Feedback (primary) | Coin vibration motor (+ NPN transistor + flyback diode) | $2 | 1 |
| Feedback (secondary) | Small LED (warm white or amber) | $0.50 | 1 |
| Battery | AKZYTUE 903048 1200mAh LiPo (JST PH 2.0mm) — check polarity before connecting | $7 | 0 (battery sense via built-in ADC) |
| Charging | USB-C (built into EN04 board) | $0 | 0 |
| **Total** | | **~$38** | **11 GPIO used (EN04 handles display SPI internally)** |

**Note:** The EN04 board integrates the XIAO nRF52840 Plus SoC — it is NOT a separate pluggable XIAO module. The EN04 handles display SPI via its FPC connector, freeing user-accessible GPIO for encoder, motor, and LED. The XIAO nRF52840 Plus provides 20 GPIOs (11 through-hole + 9 SMD castellations), giving headroom beyond the 11 needed.

### Display Refresh Strategy

- **Minutes 25:00 → 1:00**: Partial refresh once per minute. Calm, peripheral, low power.
- **Last 60 seconds (1:00 → 0:00)**: Partial refresh every 10 seconds. Display comes alive for the transition.
- **Timer completion**: Full refresh (~1.6-3.5 second black-white flash). Clears ghosting and serves as a visual "done" signal.
- **Every ~5 partial refreshes**: Full refresh to clear accumulated ghosting.

### Connectivity Architecture

- **Phone is the primary BLE central.** One connection at a time. Phone relays data to cloud via the outbox sync pattern ([ADR-006](./006-offline-first-sync-architecture.md)).
- **Mac menu bar widget as fallback central** (CoreBluetooth). Same GATT profile — the device doesn't care who connects.
- **Web Bluetooth as progressive enhancement** (Chrome/Edge only). Same GATT profile.
- **Apple Watch does NOT connect directly** — gets data through phone relay (WatchConnectivity). watchOS BLE background is too power-constrained.
- **BLE security**: Passkey pairing. Device displays 6-digit code on e-ink; user enters on phone. One-time setup for proper authentication.

### Local Storage

- nRF52840 internal flash: 1MB. ~256KB allocated to session storage.
- Session record size: ~100 bytes (timestamp + duration + type + goal_id + reflection data).
- **Capacity: ~2,500 sessions offline** (~10 months at 8 sessions/day).
- Sync pattern: outbox — sessions stored locally, uploaded in chronological order when BLE reconnects. UUID-based idempotent inserts (`ON CONFLICT (id) DO NOTHING`) per ADR-005.

### Consequences

- **Good:** Battery life of ~8-10 weeks (1200mAh AKZYTUE LiPo, ~8.1 mAh/day at 4h active use). Calm technology: monthly charging, vibration-only feedback, e-ink ambient display. 4.26" display (800x480, 219 PPI) is readable from desk distance with sharp text for goal names and reflection prompts. EN04 board integrates nRF52840 Plus with 20 GPIOs — ample headroom. All 8 device features (timer, goals, reflection, input, feedback, storage, sync, OTA) covered. Aligns with design philosophy across all 10 principles. Cost ~$38 for complete prototype.
- **Bad:** EN04's nRF52840 Plus has 20 GPIOs but not all may be easily accessible without soldering to SMD castellations. nRF52840 community is smaller than ESP32 — fewer Stack Overflow threads and YouTube tutorials. No audio feedback (vibration only) — may feel insufficient to some users. E-ink cannot show per-second countdown for most of the session (mitigated by hybrid refresh strategy). Larger device footprint than 2.9" variant (~105x62mm display outline vs ~89x38mm).
- **Neutral:** BLE passkey pairing adds one-time setup friction. Device firmware is C++ (Arduino framework) while the rest of the codebase is TypeScript/Swift — separate build toolchain. iOS background BLE disconnection means delayed sync during active sessions (outbox pattern handles this gracefully).

## Pros and Cons of the Options

### nRF52840 (Seeed XIAO)

- Good, because BLE power consumption is best-in-class (~15mA active BLE vs ~94-250mA for ESP32 variants) — [Seeed Studio BLE benchmark](https://forum.seeedstudio.com/t/ble-advertising-current-comparison-esp32c3-c6-s3-mg24-nrf52840/287847)
- Good, because deep sleep is ~5 μA — enables weeks-to-months of battery life on 1000mAh
- Good, because no WiFi means no wasted power on unused radio — [Predictable Designs comparison](https://predictabledesigns.com/esp32-vs-stm32-vs-nrf52-vs-rp2040-which-is-best-for-your-product/)
- Good, because XIAO form factor (21x17.5mm) enables compact enclosure design
- Good, because Arduino IDE compatible via Seeed's nRF52 board package — [Seeed Wiki](https://wiki.seeedstudio.com/XIAO_BLE/)
- Good, because built-in battery charging IC on XIAO ePaper kit
- Good, because nRF52840 has built-in DFU (Device Firmware Update) via BLE — no extra hardware for OTA updates
- Good, because affordable complete BOM (~$38)
- Bad, because smaller community than ESP32 — fewer tutorials and forum threads
- Bad, because 11 GPIO pins is tight — zero spare after all peripherals connected
- Bad, because Nordic's native SDK (Zephyr/nRF Connect) has a steep learning curve (mitigated by using Arduino IDE)

### ESP32-S3 (LILYGO T5)

- Good, because largest community — multiple existing [Pomodoro timer projects](https://github.com/Rukenshia/pomodoro) to reference
- Good, because LILYGO T5 boards come as complete units with pre-attached 4.7" e-ink display — no wiring
- Good, because WiFi + BLE — could skip phone relay for cloud sync (but architecture doesn't need this)
- Good, because more compute power (dual-core, 240MHz) and more GPIO pins
- Bad, because BLE power consumption is ["not suitable for low current consumption"](https://forum.seeedstudio.com/t/ble-advertising-current-comparison-esp32c3-c6-s3-mg24-nrf52840/287847) — 6-16x more power than nRF52840
- Bad, because WiFi radio wastes power on an unused capability
- Bad, because larger form factor (T5 Pro is roughly phone-sized)
- Bad, because more expensive ($45-55 for dev board)

### ESP32-C6 (Seeed XIAO)

- Good, because improved deep sleep (~9.5 μA) compared to ESP32-S3 — [power measurement](https://tomasmcguinness.com/2025/01/06/lowering-power-consumption-in-esp32-c6/)
- Good, because ESP32 ecosystem and community familiarity
- Good, because WiFi 6 + BLE 5.3 + Thread/Zigbee — future-proof connectivity
- Good, because cheapest board (~$5)
- Bad, because active BLE still draws significantly more than nRF52840
- Bad, because newer chip with fewer tutorials than either ESP32-S3 or nRF52840
- Bad, because no integrated e-ink dev board — requires separate display module and wiring
- Bad, because WiFi/Thread capabilities are unused complexity

## Research Sources

- [Seeed Studio BLE Advertising Current Comparison](https://forum.seeedstudio.com/t/ble-advertising-current-comparison-esp32c3-c6-s3-mg24-nrf52840/287847) — nRF52840 "by far the best" for low power BLE
- [Predictable Designs: ESP32 vs STM32 vs nRF52 vs RP2040](https://predictabledesigns.com/esp32-vs-stm32-vs-nrf52-vs-rp2040-which-is-best-for-your-product/) — detailed MCU comparison for products
- [Geeky Gadgets: nRF52840 vs ESP32 for Low Power Smart Devices](https://www.geeky-gadgets.com/efficient-sensor-energy-battery/) — practical battery life comparison
- [Good Display GDEY029T94 specs](https://www.good-display.com/product/389.html) — 2.9" e-ink (originally considered)
- [Good Display GDEQ0426T82 specs](https://www.good-display.com/product/457.html) — 4.26" e-ink: 800x480, 219 PPI, 0.42s partial refresh, 3.5s full refresh, SSD1677 driver
- [MakerGuides: Partial Refresh of e-Paper Display](https://www.makerguides.com/partial-refresh-e-paper-display-esp32/) — practical partial refresh implementation
- [CNX Software: XIAO ePaper DIY Kit](https://www.cnx-software.com/2025/12/02/xiao-epaper-diy-kit-features-esp32-s3-or-nrf52840-soc-supports-1-54-inch-to-13-3-inch-displays/) — "for anything requiring a battery, go with the nRF52840 board"
- [Seeed Studio XIAO nRF52840 Wiki](https://wiki.seeedstudio.com/XIAO_BLE/) — getting started guide
- [MakerGuides: LILYGO T5 E-Paper S3 Pro Review](https://www.makerguides.com/review-the-lilygo-t5-e-paper-s3-pro/) — ESP32-S3 e-ink dev board review
- [XDA: E-ink Pomodoro Timer with ESP32](https://www.xda-developers.com/e-ink-pomodoro-timer-esp32/) — existing DIY Pomodoro timer project
- [Rukenshia/pomodoro GitHub](https://github.com/Rukenshia/pomodoro) — ESP32 + e-paper + rotary encoder Pomodoro timer
- [ESP32-C6 Power Consumption](https://tomasmcguinness.com/2025/01/06/lowering-power-consumption-in-esp32-c6/) — deep sleep ~9.5 μA
- [ESP32-H2 Low Power](https://tomasmcguinness.com/2025/08/29/matter-low-power-on-an-esp32-h2/) — light sleep ~24 μA

## Related Decisions

- [ADR-001: Monorepo Package Structure](./001-monorepo-package-structure.md) — `packages/ble-protocol/` defines the GATT profile and Protobuf encoding shared between TS, Swift, and C++ (device firmware)
- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — the pure `transition(state, event) → newState` model translates to C++ `enum class` on the device; device runs its own timer driver using `millis()`
- [ADR-005: Database Schema & Data Model](./005-database-schema-data-model.md) — `devices` and `device_sync_log` tables support BLE device registration and incremental sync; UUID-based idempotent inserts deduplicate retries
- [ADR-006: Offline-First Sync Architecture](./006-offline-first-sync-architecture.md) — device implements the outbox sync pattern: buffer sessions locally, upload when BLE reconnects, server deduplicates via `ON CONFLICT (id) DO NOTHING`
- [ADR-012: Security & Data Privacy](./012-security-data-privacy.md) — BLE uses LE Secure Connections with Passkey Entry + Bonding; advanced BLE hardening (SCO mode, GATT-level encryption) explicitly deferred
- [ADR-013: BLE GATT Protocol Design](./013-ble-gatt-protocol-design.md) — detailed GATT service/characteristic definitions, Protobuf message schemas, chunked bulk transfer protocol, and connection sync state machine
- [ADR-015: Device Firmware Toolchain](./015-device-firmware-toolchain.md) — PlatformIO build system, Nanopb for Protobuf encoding, System ON sleep strategy
- [ADR-016: BLE Client Libraries & Integration](./016-ble-client-libraries-integration.md) — react-native-ble-plx (mobile), Web Bluetooth (web), CoreBluetooth (macOS); app-open sync for v1
