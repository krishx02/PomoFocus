# ADR-015: Device Firmware Toolchain

**Status:** Accepted
**Date:** 2026-03-09
**Decision-makers:** Project lead
**Zoom level:** Level 3-4 (Component/Code — build tooling, library, and power config within decided hardware platform)
**Platforms:** BLE device (nRF52840 firmware)

## Context and Problem Statement

ADR-010 chose the Seeed XIAO ePaper EN04 board (nRF52840 Plus built in) as the hardware platform and defined the firmware architecture at a high level (C++ port of the timer state machine, GxEPD2 for e-ink, outbox sync, BLE GATT profile). Three implementation-level decisions remained open: (1) which build system to use for compiling and flashing firmware, (2) which Protobuf library to use for BLE data encoding on a flash-constrained microcontroller, and (3) which sleep strategy to use for battery life management. These decisions are tightly coupled — the build system affects library management, the Protobuf library affects flash budget, and the sleep strategy determines how BLE and GPIO interact during idle periods.

## Decision Drivers

- **Beginner-friendliness** — project lead has zero hardware experience; the toolchain must not add a steep learning curve on top of C++, BLE, and e-ink
- **Reproducibility and CI-readiness** — pinned library versions and command-line builds for eventual CI integration (ADR-009 already has PlatformIO CI placeholder)
- **Flash footprint** — nRF52840 has 1MB total flash; firmware + bootloader consume ~512KB, session storage ~256KB, leaving ~232KB for application code and libraries
- **BLE discoverability** — device must remain discoverable by phone while idle for seamless sync (core to the "calm technology" experience)
- **Code portability** — firmware code should remain standard Arduino-compatible as a fallback

## Considered Options

### Build Toolchain

1. PlatformIO with Arduino framework
2. Arduino IDE 2.x
3. Arduino IDE first, migrate to PlatformIO later

### Protobuf Encoding

1. Nanopb (lightweight C implementation for embedded)
2. Full protoc C++ (Google's standard library)

### Sleep Strategy

1. System ON sleep with BLE SoftDevice active
2. System OFF (deepest sleep, full reset on wake)
3. Hybrid — System ON during day, System OFF overnight

## Decision Outcome

### Build Toolchain

Chosen option: **"PlatformIO with Arduino framework"**, because it provides reproducible builds via `platformio.ini` (equivalent to `package.json` for embedded), CLI builds for CI (`pio run`, `pio test`), and runs inside Cursor/VS Code — while writing standard Arduino code (`setup()`, `loop()`, Arduino libraries) that remains portable to Arduino IDE as a fallback.

### Protobuf Encoding

Chosen option: **"Nanopb"**, because full protoc C++ consumes ~150-200KB+ of flash (too large for the ~232KB available) and uses dynamic memory allocation (dangerous on a microcontroller with no memory protection). Nanopb fits in ~2-5KB, uses only static buffers, and produces wire-compatible output from the same `.proto` file shared across all platforms.

### Sleep Strategy

Chosen option: **"System ON sleep with BLE SoftDevice active"**, because the device must remain BLE-discoverable while idle for seamless phone sync. System ON sleep draws ~5.4μA (without BLE) + ~22μA (BLE advertising) — already modeled in ADR-010's power budget, yielding 8-10 weeks battery life. System OFF would save only ~3μA but kill BLE discoverability and require a full device reset on every wake.

### Consequences

- **Good:** Reproducible firmware builds with pinned library versions. CI-ready from day one (`pio run` + `pio test`). Nanopb's ~2-5KB footprint leaves ample flash for application code. No dynamic memory allocation eliminates an entire class of embedded bugs. Device stays BLE-discoverable during idle — phone auto-syncs when in range. Standard Arduino code is portable between PlatformIO and Arduino IDE.
- **Bad:** PlatformIO setup for the EN04 board (a newer Seeed product) may require manual `platformio.ini` configuration — Seeed's official PlatformIO guide targets the standalone XIAO nRF52840, not the EN04 driver board specifically. Nanopb's API (`pb_encode()`/`pb_decode()` with field descriptors) differs from standard protobuf's generated class API — requires learning a different encoding pattern than TypeScript/Swift. Nanopb requires `.options` files to set max string lengths and array sizes for each message type.
- **Neutral:** The `.proto` file (`packages/ble-protocol/proto/pomofocus.proto`) remains the single source of truth across all platforms — code generation differs (`--nanopb_out` for C, `--ts_out` for TS, `--swift_out` for Swift) but the wire format is binary-compatible. Hybrid sleep (System ON + overnight System OFF) can be added during Phase 8 prototyping if battery testing shows it's needed — no architectural change required.

## Pros and Cons of the Options

### PlatformIO with Arduino Framework

- Good, because `platformio.ini` pins board, platform, and library versions — reproducible builds across machines
- Good, because CLI builds (`pio run`, `pio test`) integrate directly into CI (ADR-009 placeholder)
- Good, because runs as a Cursor/VS Code extension — same editor as TypeScript development
- Good, because IntelliSense, code completion, and jump-to-definition for C++
- Good, because Seeed has an [official PlatformIO guide for XIAO nRF52840](https://wiki.seeedstudio.com/xiao_nrf52840_with_platform_io/)
- Good, because code is standard Arduino — portable to Arduino IDE as fallback
- Bad, because initial setup requires configuring Seeed's custom platform URL in `platformio.ini`
- Bad, because some users report [compile issues](https://forum.seeedstudio.com/t/xiao-nrf52840-sense-in-vscode-with-platform-io-extension-wont-compile/285203) with XIAO nRF52840 on PlatformIO (resolvable but adds friction)

### Arduino IDE 2.x

- Good, because simplest setup — install, select board, click Upload
- Good, because most tutorials and examples target Arduino IDE
- Good, because board manager handles nRF52840 board package automatically
- Good, because proven to work reliably with XIAO nRF52840
- Bad, because no library version pinning — libraries update globally, can break silently
- Bad, because no CLI for CI integration (arduino-cli exists but is a separate tool)
- Bad, because basic IntelliSense and code navigation compared to PlatformIO/Cursor
- Bad, because context-switching between Arduino IDE and Cursor

### Arduino IDE First, Migrate Later

- Good, because lowest barrier to first "Hello World"
- Bad, because "migrate later" adds a second learning curve
- Bad, because build configuration accumulated in Arduino IDE doesn't transfer — must be recreated in PlatformIO

### Nanopb

- Good, because designed for systems with <10KB ROM, <1KB RAM — [nanopb homepage](https://jpa.kapsi.fi/nanopb/)
- Good, because no dynamic memory allocation — all static buffers, predictable and safe on MCUs
- Good, because ~2-5KB compiled footprint vs ~150-200KB+ for full protoc C++
- Good, because plain ANSI C — compiles on any platform including nRF52840
- Good, because used in production by Android, iOS, Cisco — [nanopb GitHub](https://github.com/nanopb/nanopb)
- Good, because available as PlatformIO library — [bolderflight/nanopb](https://github.com/bolderflight/nanopb)
- Good, because same `.proto` file shared across all platforms — wire format is binary-compatible
- Bad, because API differs from standard protobuf (`pb_encode()`/`pb_decode()` vs generated classes)
- Bad, because requires `.options` files to set max field sizes (no dynamic allocation means fixed limits)

### Full protoc C++

- Good, because same API style as TypeScript and Swift protobuf — generated classes with setter methods
- Good, because full protobuf feature support (oneof, maps, any, extensions)
- Good, because most documentation and Stack Overflow answers reference this implementation
- Bad, because ~150-200KB+ compiled code — consumes most of available flash on nRF52840
- Bad, because uses dynamic memory allocation (`new`, `malloc`) — unsafe on MCU with no memory protection
- Bad, because designed for servers and desktops, not 256KB-RAM embedded systems

### System ON Sleep (BLE SoftDevice Active)

- Good, because BLE advertising continues in sleep (~22μA) — phone auto-discovers device
- Good, because GPIO interrupts wake on encoder click — instant response
- Good, because no full reset on wake — device resumes exactly where it left off
- Good, because measured at [5.4μA on XIAO nRF52840](https://forum.seeedstudio.com/t/sleep-current-of-xiao-nrf52840-deep-sleep-vs-light-sleep/271841) without BLE
- Good, because already modeled in ADR-010's power budget (8-10 weeks battery life)
- Bad, because ~3μA more than System OFF — negligible impact on battery life

### System OFF

- Good, because lowest possible power — [2.4μA measured on XIAO nRF52840](https://forum.seeedstudio.com/t/sleep-current-of-xiao-nrf52840-deep-sleep-vs-light-sleep/271841)
- Good, because simplest to implement — `NRF_POWER->SYSTEMOFF = 1;`
- Bad, because full reset on wake — device reboots, several seconds of startup delay
- Bad, because no BLE advertising — phone can't discover device until user presses a button
- Bad, because breaks "calm technology" experience — user must manually wake device before syncing

### Hybrid (System ON + System OFF overnight)

- Good, because captures System OFF savings during 8+ hours of nighttime inactivity
- Good, because could extend battery life from ~10 weeks to ~12-14 weeks
- Bad, because more complex power management logic (inactivity timer, RTC schedule, boot recovery)
- Bad, because premature optimization — 8-10 weeks is already sufficient for v1

## Research Sources

- [PlatformIO vs Arduino IDE — PlatformIO docs](https://docs.platformio.org/en/latest/faq/arduino-vs-platformio.html)
- [PlatformIO vs Arduino IDE 2.x: Debugging — Arduino Forum](https://forum.arduino.cc/t/platformio-vs-arduino-ide-2-x-which-wins-for-advanced-debugging/1372177)
- [Getting Started with PlatformIO — DroneBot Workshop](https://dronebotworkshop.com/platformio/)
- [XIAO nRF52840 with PlatformIO — Seeed Studio Wiki](https://wiki.seeedstudio.com/xiao_nrf52840_with_platform_io/)
- [Nanopb — Protocol Buffers for Embedded Systems](https://jpa.kapsi.fi/nanopb/)
- [Nanopb GitHub](https://github.com/nanopb/nanopb)
- [bolderflight/nanopb — PlatformIO library](https://github.com/bolderflight/nanopb)
- [Serialization for Embedded Systems — mbedded.ninja](https://blog.mbedded.ninja/programming/serialization-formats/serialization-for-embedded-systems/)
- [From MCU to Cloud: Lightweight Serialization with Nanopb — Medium](https://medium.com/embedworld/from-mcu-to-cloud-lightweight-serialization-with-nanopb-856bea75fe07)
- [nRF52840 Deep Sleep — Nordic DevZone](https://devzone.nordicsemi.com/f/nordic-q-a/51648/how-to-put-nrf52840-to-deep-sleep-system-off)
- [Sleep Current of XIAO nRF52840 — Seeed Forum](https://forum.seeedstudio.com/t/sleep-current-of-xiao-nrf52840-deep-sleep-vs-light-sleep/271841)
- [Low-Power Sleep Modes with nRF52840 RTC — DevForge](https://blog.thedevforge.com/exploring-low-power-sleep-modes-with-the-promicro-nrf52840-rtc-on-arduino-and-platformio/)
- [Sub-microamp Sleep Current with XIAO nRF52840 — Medium](https://kongmunist.medium.com/sub-microamp-sleep-current-with-seeed-xiao-nrf52840-732def7d95c3)
- [Moddable nRF52 Low Power Notes](https://www.moddable.com/documentation/devices/nRF52-low-power)

## Related Decisions

- [ADR-004: Timer State Machine](./004-timer-state-machine.md) — device firmware ports the pure `transition(state, event) → newState` function to C++; timer driver uses `millis()`
- [ADR-009: CI/CD Pipeline Design](./009-ci-cd-pipeline-design.md) — firmware CI uses `platformio run` + `platformio test` on `ubuntu-latest`
- [ADR-010: Physical Device Hardware Platform](./010-physical-device-hardware-platform.md) — defines the EN04 board, GPIO allocation, power budget, and prototyping phases that this ADR's toolchain serves
- [ADR-013: BLE GATT Protocol Design](./013-ble-gatt-protocol-design.md) — Protobuf encoding (now Nanopb on device) for all BLE data; `.proto` file in `packages/ble-protocol/proto/pomofocus.proto`
