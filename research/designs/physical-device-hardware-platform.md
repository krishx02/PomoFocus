# Design: Physical Device Hardware Platform

**Date:** 2026-03-08
**Status:** Accepted
**Related ADR:** [ADR-010](../decisions/010-physical-device-hardware-platform.md)
**Platforms:** BLE device (primary), iOS app, Android app, macOS menu bar, web (Chrome/Edge)

## Context & Scope

PomoFocus includes a physical desk companion — a dedicated Pomodoro timer device that enables phone-away focus. The device embodies the PomoFocus design philosophy: calm technology, quiet luxury, Teenage Engineering-inspired tangibility, and Fukasawa's "Without Thought" interaction. It sits on a desk, displays the current timer state and goal, accepts input via a single rotary encoder, and syncs with the phone via BLE.

The project lead has zero hardware experience. The design must be buildable by a complete beginner using off-the-shelf development boards, breadboard prototyping, and the Arduino IDE. Manufacturing is not a near-term goal — this is a personal project first.

## Goals & Non-Goals

**Goals:**
- Define the complete hardware platform: MCU, display, input, feedback, battery, connectivity
- Achieve weeks-to-months of battery life on a single charge
- Create a device that aligns with the PomoFocus design philosophy (10 principles)
- Use off-the-shelf dev boards and components — no custom PCB for v1
- Fit within ~$45 prototype budget
- Use all GPIO pins efficiently — no waste, no shortage
- Support offline operation with outbox sync when BLE reconnects

**Non-Goals:**
- Custom PCB design (deferred to post-prototype)
- Manufacturing feasibility, certifications (FCC/CE), or cost-at-scale analysis
- WiFi connectivity (device syncs through phone; WiFi is unused)
- Audio feedback (buzzer/speaker) — vibration motor is the sole feedback actuator per design philosophy
- Complex enclosure design (3D-printed prototype enclosure is sufficient for v1)
- Multi-device pairing (one phone pairs with one device at a time)

## The Design

### System Architecture

```
┌─────────────────────────────────────┐
│  PomoFocus Physical Device          │
│                                     │
│  ┌───────────┐  ┌────────────────┐  │
│  │ EN04 board│──│ 4.26" e-ink    │  │ FPC (24-pin, SPI via board)
│  │ (nRF52840 │  │ 800x480 219PPI│  │
│  │  Plus     │  │ display        │  │
│  │  built-in)│  │ (GDEQ0426T82) │  │
│  │           │  └────────────────┘  │
│  │  BLE 5.0  │  ┌────────────────┐  │
│  │  (built-in│──│ Rotary encoder │  │ GPIO (3 pins)
│  │   antenna)│  │ + push button  │  │
│  │           │  └────────────────┘  │
│  │  1MB flash│  ┌────────────────┐  │
│  │  (session │──│ Vibration motor│  │ GPIO (1 pin + transistor)
│  │   storage)│  └────────────────┘  │
│  │           │  ┌────────────────┐  │
│  │  ADC      │──│ LED (amber)    │  │ GPIO (1 pin)
│  │  (battery │  └────────────────┘  │
│  │   sense)  │                      │
│  └─────┬─────┘  ┌────────────────┐  │
│        └────────│ 1200mAh LiPo   │  │ JST PH 2.0mm
│                 │ (AKZYTUE)     │  │
│                 │ + USB-C charge  │  │
│                 └────────────────┘  │
└──────────┬──────────────────────────┘
           │ BLE (one connection at a time)
           │
    ┌──────▼──────┐
    │  Phone App  │ (primary BLE central)
    │  (iOS/      │
    │   Android)  │──── Cloud sync via
    │             │     Hono API (ADR-007)
    └─────────────┘
           │
    ┌──────▼──────┐
    │  Mac Widget │ (fallback BLE central,
    │  (macOS     │  CoreBluetooth)
    │   menu bar) │
    └─────────────┘
```

### GPIO Pin Allocation (EN04 / XIAO nRF52840 Plus)

The EN04 board handles display SPI internally via its 24-pin FPC connector (using D0, D1, D2, D3, D8, D10). This frees the remaining user-accessible GPIOs for peripherals:

| Pin | Function | Notes |
|-----|----------|-------|
| D0-D3, D8, D10 | E-ink display (via EN04 FPC) | Managed by EN04 board — not user-wired |
| D4 | Rotary encoder CLK | Interrupt-capable |
| D5 | Rotary encoder DT | Interrupt-capable |
| D6 | Rotary encoder SW (button) | Active low — enable internal pull-up (KY-040 SW pin has no on-module pull-up) |
| D7 | Vibration motor | Output via 2N2222 NPN transistor + 1K base resistor + 1N4148 flyback diode |
| D9 | LED | Output, PWM-capable for pulsing effect |
| — | Battery voltage | Built-in ADC on VBAT pin (no GPIO needed) |
| SMD pads | 9 extra GPIOs | Via 1.27mm castellations on nRF52840 Plus bottom — available for future expansion |

**5 user GPIOs used out of 5 available through-hole pins** (after EN04 claims 6 for display). 9 additional GPIOs accessible via SMD soldering if needed. The EN04 also provides 3 built-in user buttons (GPIO2, GPIO3, GPIO5) for prototype input before the rotary encoder is wired.

### E-ink Display Refresh Strategy

The 4.26" e-ink display (GDEQ0426T82, SSD1677 driver, 800x480, 219 PPI) supports three refresh modes:

| Mode | Speed | Visual Effect | Power |
|------|-------|---------------|-------|
| Full refresh | ~1.6-3.5s | Black-white-black flash, clears all ghosting | Highest |
| Fast refresh | ~1.5s | Single flash, minor ghosting | Medium |
| Partial refresh | ~0.42-0.6s | No flash, no flicker, ghosting accumulates | Lowest |

**Hybrid refresh strategy (design-philosophy-aligned):**

```
Timer: 25:00 → 1:00
  └─ Partial refresh once per minute
  └─ "24:00" ... "23:00" ... "22:00"
  └─ Calm. Peripheral. User shouldn't be watching.
  └─ Design principle: "Emptiness Is Generosity"

Timer: 1:00 → 0:00
  └─ Partial refresh every 10 seconds
  └─ "0:50" ... "0:40" ... "0:30"
  └─ Display comes alive for the transition.
  └─ Design principle: "Emotion Lives in the Transition"

Timer completion:
  └─ Full refresh (3s black-white flash)
  └─ Clears all accumulated ghosting
  └─ The flash IS the completion signal (visual punctuation)
  └─ Followed by vibration motor buzz pattern

Ghosting management:
  └─ Full refresh every ~5 partial refreshes (manufacturer recommendation)
  └─ During focus sessions: natural full refresh every 5 minutes
```

### BLE Architecture

**Connection model:** One connection at a time. Phone is primary central. Mac is fallback. Web Bluetooth is progressive enhancement.

**Pairing:** Passkey display. Device shows 6-digit code on e-ink during pairing. User enters on phone. One-time setup. BLE bonding stores the key — subsequent connections are automatic.

**GATT profile** (detailed in [ADR-013](../decisions/013-ble-gatt-protocol-design.md) and [Design: BLE GATT Protocol](./ble-gatt-protocol-design.md)):
- Timer Service: read timer state, write timer commands (start/pause/skip/abandon)
- Goal Service: write goal list (phone → device), read selected goal
- Session Service: notify completed sessions (device → phone), read session log
- Device Info Service: battery level, firmware version, device name
- DFU Service: Nordic DFU for over-the-air firmware updates

**Data encoding:** Protobuf (defined in `packages/ble-protocol/proto/pomofocus.proto`). Generated code for TypeScript (phone), Swift (Mac), and C++ (device firmware). Zero manual type sync.

### Local Storage Architecture

```
nRF52840 Internal Flash (1MB total)
├── Firmware code + Arduino bootloader (~512KB)
├── BLE bonding data (~4KB)
├── Device config (timer settings, paired device ID) (~4KB)
├── Goal cache (synced from phone, ~5 active goals) (~1KB)
├── Session outbox (circular buffer) (~256KB)
│   └── ~2,500 sessions × ~100 bytes each
│   └── FIFO: oldest sessions uploaded first
│   └── Each session has: UUID (idempotency key), timestamp,
│       duration, type, goal_id, reflection data
└── Reserved / free (~223KB)
```

**Sync protocol:**
1. Phone connects via BLE
2. Phone sends current goal list → device caches in flash
3. Phone sends timer config (durations, reflection preference) → device caches
4. Device sends buffered sessions → phone uploads to cloud via Hono API
5. Phone sends `sync_cursor` (last synced session UUID) → device marks as uploaded
6. Sessions marked as uploaded are eligible for overwrite in circular buffer

**Offline behavior:** When phone is not connected, the device operates fully standalone:
- Timer runs using `millis()` (ADR-004 timer driver pattern)
- Sessions are stored in the outbox
- Goals are displayed from the local cache
- No degradation in core functionality

### Power Budget

| State | Current Draw | Duration/Day | Energy/Day |
|-------|-------------|--------------|------------|
| Deep sleep (idle, screen static) | ~5 μA | 20 hours | 0.1 mAh |
| BLE advertising (not connected) | ~22 μA | 2 hours | 0.044 mAh |
| Active Pomodoro (BLE connected, processing) | ~5 mA | 1.5 hours | 7.5 mAh |
| E-ink partial refresh (~1/min during active) | ~10 mA for 0.5s | 36 refreshes | 0.05 mAh |
| E-ink full refresh (~1/5min during active) | ~25 mA for 3s | 18 refreshes | 0.375 mAh |
| Vibration motor (session completion) | ~100 mA for 1s | 6 sessions | 0.17 mAh |
| LED pulse (session completion) | ~5 mA for 5s | 6 sessions | 0.008 mAh |
| **Total** | | | **~8.1 mAh/day** |

**Estimated battery life:** 1200mAh ÷ 8.1 mAh/day ≈ **148 days** (theoretical). With real-world overhead (self-discharge, inefficiencies, temperature variation): **~8-10 weeks** conservatively.

### Interaction Model

```
Device States (firmware state machine):

  ┌─────────┐   encoder click   ┌────────────────┐
  │  IDLE   │ ────────────────> │ GOAL_SELECTION  │
  │ (rest   │                   │ (scroll goals   │
  │  state) │ <──── long press  │  with encoder)  │
  └─────────┘                   └───────┬─────────┘
                                        │ encoder click
                                        │ (select goal)
                                        ▼
                                ┌────────────────┐
                                │   FOCUSING     │
                                │ (timer running,│
                                │  display calm) │
                                └───┬────┬───────┘
                         click      │    │  long press
                        (pause)     │    │  (abandon)
                                    │    │
                              ┌─────▼┐   │    ┌───────────┐
                              │PAUSED│   └──> │ ABANDONED  │
                              └──┬───┘        │ (optional  │
                          click  │            │  reason)   │
                         (resume)│            └───────────┘
                                 │
                   timer expires │
                                 ▼
                         ┌───────────────┐
                         │  BREAK        │
                         │ (short/long)  │
                         └───────┬───────┘
                                 │ timer expires
                                 ▼
                         ┌───────────────┐   encoder: rate 1-5
                         │  REFLECTION   │ ──────────────────>
                         │ (if enabled)  │   click: confirm
                         └───────┬───────┘   stores in outbox
                                 │
                                 ▼
                         ┌───────────────┐
                         │  SESSION      │
                         │  COMPLETE     │  vibrate + LED
                         │  (auto → IDLE)│
                         └───────────────┘
```

**Design philosophy alignment:**
- **Without Thought (Fukasawa):** Rotate knob to browse goals, click to start. Your hand already knows.
- **Emptiness (Hara):** The idle screen shows only the last goal and "click to start." Near-blank.
- **Calm Technology:** During focus, the display updates once per minute. Peripheral. Glanceable.
- **Emotion in Transition:** Last 60 seconds accelerate updates. Vibration at completion. The transition IS the moment.
- **The Object at Rest:** Idle display shows a minimal clock or last session summary. Beautiful even when off-duty.
- **Active Rest (Fukasawa):** The e-ink retains its last image with zero power. The device is always "showing something" even in deep sleep.

### Firmware Architecture

```
firmware/device/
├── src/
│   ├── main.cpp              # setup() + loop(), Arduino entry point
│   ├── timer/
│   │   ├── state_machine.h   # C++ port of packages/core/timer/ (ADR-004)
│   │   ├── state_machine.cpp # transition(state, event) → newState
│   │   └── driver.cpp        # millis()-based timer driver
│   ├── display/
│   │   ├── renderer.h        # E-ink rendering (GxEPD2)
│   │   ├── screens.cpp       # Screen layouts: idle, focusing, break, reflection
│   │   └── refresh.cpp       # Hybrid refresh strategy logic
│   ├── input/
│   │   ├── encoder.h         # Rotary encoder driver (interrupt-based)
│   │   └── encoder.cpp       # Debouncing, rotation detection, click/long-press
│   ├── ble/
│   │   ├── gatt_profile.h    # GATT service/characteristic definitions
│   │   ├── ble_server.cpp    # BLE peripheral setup, advertising, connection handling
│   │   └── sync.cpp          # Outbox sync: send sessions, receive goals/config
│   ├── storage/
│   │   ├── flash_store.h     # Flash read/write abstraction
│   │   ├── session_outbox.cpp # Circular buffer for session storage
│   │   └── config_cache.cpp  # Goals + timer config cache
│   ├── feedback/
│   │   ├── vibration.h       # Vibration motor patterns
│   │   └── led.h             # LED pulse patterns
│   └── power/
│       └── sleep.cpp         # Deep sleep entry/exit, BLE advertising in sleep
├── generated/                # AUTO-GENERATED: nanopb_generator (BLE types, ADR-015)
│   └── pomofocus.pb.h
│   └── pomofocus.pb.cc
├── platformio.ini            # Build config: board = xiao_nrf52840
└── README.md
```

**Key firmware patterns:**
- Timer state machine is a direct C++ port of `packages/core/timer/` (ADR-004). Same states, same transitions, same types. Verified by comparing TypeScript and C++ outputs for the same input sequence.
- Encoder input uses hardware interrupts for responsive rotation detection. Debouncing is handled in software with a 5ms threshold.
- BLE server runs in the background. Connection/disconnection events trigger sync.
- Deep sleep is entered after 30 seconds of inactivity. BLE advertising continues in sleep mode (nRF52840 handles this in hardware at ~22 μA). Any BLE connection or encoder interrupt wakes the device.
- Session UUIDs are generated using the nRF52840's hardware random number generator (TRNG) — cryptographically random, no external entropy source needed.

### Prototyping Phases

| Phase | Goal | Hardware | Deliverable |
|-------|------|----------|-------------|
| 1 | Blink + Hello | XIAO nRF52840 Plus + EN04 board | LED blinks, serial output works, Arduino IDE confirmed |
| 2 | Display | + 4.26" e-ink via EN04 FPC | GxEPD2 renders text and timer mockup (800x480) |
| 3 | Input | + rotary encoder | Navigate a goal list, select with click |
| 4 | Timer | Software only | Full timer state machine running on device |
| 5 | BLE | + phone app connection | Timer state synced to phone in real-time |
| 6 | Feedback | + vibration motor + LED | Session completion notification |
| 7 | Storage | Flash outbox | Offline session storage + sync on reconnect |
| 8 | Power | Deep sleep optimization | Battery life measurement, sleep/wake tuning |
| 9 | Enclosure | 3D-printed case | Physical form factor for desk use |

### Prototype Shopping List (Verified)

| # | Component | Source | Link | Price |
|---|-----------|--------|------|-------|
| 1 | EN04 Board (nRF52840 Plus built in) | Seeed Studio | [EN04 board only](https://www.seeedstudio.com/XIAO-ePaper-Display-Board-nRF52840-EN04-p-6589.html) | ~$10 |
| 2 | 4.26" Mono ePaper Display (800x480, 24-pin FPC) | Seeed Studio | [4.26" Display](https://www.seeedstudio.com/4-26-Monochrome-SPI-ePaper-Display-p-6398.html) | ~$16 |
| 3 | KY-040 Rotary Encoder (5-pack) | Amazon | [Cylewet 5-pack](https://www.amazon.com/Cylewet-Encoder-15%C3%9716-5-Arduino-CYT1062/dp/B06XQTHDRR) | ~$7 |
| 4 | Coin Vibration Motor (20-pack) | Amazon | [tatoko 20-pack](https://www.amazon.com/tatoko-Vibration-Button-Type-Vibrating-Appliances/dp/B07Q1ZV4MJ) | ~$7 |
| 5 | 1200mAh LiPo Battery (JST PH 2.0mm) | Amazon | [AKZYTUE 903048 1200mAh](https://www.amazon.com/AKZYTUE-1200mAh-Battery-Rechargeable-Connector/dp/B07TWHHCNK) | ~$7 |
| 6 | Components Kit (breadboard, jumpers, LEDs, resistors, capacitors, transistors, diodes) | Amazon | [REXQualis Fun Kit](https://www.amazon.com/REXQualis-Electronics-tie-Points-Breadboard-Potentiometer/dp/B073ZC68QG) | ~$14 |

**Total: ~$61** (per-unit device cost: ~$38; rest is multi-packs and prototyping supplies). **All parts ordered 2026-03-08.**

**Order strategy:** Items 1-2 from Seeed Studio (one shipment). Items 3-6 from Amazon.

**Required small components from kit (item 6):** 3mm warm white/amber LED, 2N2222 NPN transistor, 1K ohm resistor (transistor base), 1N4148 diode (flyback protection across motor), 100nF ceramic capacitors ×2 (encoder debouncing on CLK-GND and DT-GND lines).

**⚠ BATTERY POLARITY WARNING:** There is no universal standard for JST PH 2.0mm polarity. Before connecting the AKZYTUE battery to the EN04 board: (1) power the EN04 via USB-C, (2) use a multimeter on the JST battery pads to identify which is + and which is −, (3) compare to the battery's red (+) and black (−) wires. If reversed, swap the wires in the JST housing using a pin extractor tool — no soldering needed. Wrong polarity can damage the board.

## Alternatives Considered

### ESP32-S3 (LILYGO T5 E-Paper)
Rejected because BLE power consumption is 6-16x higher than nRF52840, WiFi capability is unused (all sync goes through phone), and the larger form factor conflicts with the compact desk companion vision. The LILYGO T5's pre-integrated display and larger community were attractive, but the power penalty directly contradicts the #1 design criterion (battery life). Reference: [Seeed Studio BLE advertising benchmark](https://forum.seeedstudio.com/t/ble-advertising-current-comparison-esp32c3-c6-s3-mg24-nrf52840/287847).

### ESP32-C6 (Seeed XIAO)
Rejected because, while its deep sleep current (~9.5 μA) approaches the nRF52840, its active BLE still draws significantly more. The ESP32-C6 is the newest chip of the three — fewer tutorials than either ESP32-S3 or nRF52840. Its WiFi 6 and Thread support add unused complexity. It occupies a middle ground that doesn't win on any of the stated criteria.

## Cross-Cutting Concerns

- **Security:** BLE passkey pairing prevents unauthorized connections. Session data (goal names, timestamps) is encrypted in transit via BLE's AES-CCM encryption after bonding. Flash storage on-device is not encrypted (acceptable for a personal device — physical access to the device implies ownership).
- **Cost:** ~$38 prototype BOM (EN04 $10 + display $16 + encoder $2 + motor $2 + LED $0.50 + AKZYTUE 1200mAh LiPo $7). At manufacturing scale (100+ units), total BOM ~$20-25. Manufacturing consideration is deferred.
- **Observability:** Battery level reported via BLE to the phone app. Session sync status visible on phone. Firmware version exposed via Device Information Service. For debugging: serial output via USB-C when connected to computer.
- **Migration path:** If GPIO becomes a constraint, the Seeed XIAO nRF52840 Sense (~$15) adds an onboard IMU and microphone without changing the pinout. Alternatively, the nRF52840 DK (~$40) provides ~48 GPIO but is much larger. The BLE GATT profile and Protobuf encoding are hardware-agnostic — firmware ports cleanly between boards.

## Open Questions

1. **Enclosure design:** Material, color, texture. Should align with design philosophy (wabi-sabi suggests natural materials — wood? concrete?). Deferred to a separate design session.
2. ~~**BLE GATT profile detail:**~~ Resolved — see [ADR-013: BLE GATT Protocol Design](../decisions/013-ble-gatt-protocol-design.md) and [Design: BLE GATT Protocol](./ble-gatt-protocol-design.md). Defines 5 GATT services, 9 characteristics, Protobuf message schemas, chunked bulk transfer protocol, and connection sync state machine.
3. ~~**Firmware build toolchain:**~~ Resolved — PlatformIO with Arduino framework. See [ADR-015: Device Firmware Toolchain](../decisions/015-device-firmware-toolchain.md). Reproducible builds via `platformio.ini`, CLI for CI, standard Arduino code portable to Arduino IDE as fallback.
4. **E-ink display sourcing:** Decided — GDEQ0426T82 (Good Display) 4.26" 800x480 via Seeed Studio. GxEPD2 has dedicated class `GxEPD2_426_GDEQ0426T82`. Compatible with EN04 board via 24-pin FPC.
5. ~~**Protobuf on nRF52840:**~~ Resolved — Nanopb. See [ADR-015: Device Firmware Toolchain](../decisions/015-device-firmware-toolchain.md). ~2-5KB flash, no dynamic allocation, wire-compatible with standard Protobuf. Full protoc C++ rejected (~150-200KB flash, uses `malloc`).
