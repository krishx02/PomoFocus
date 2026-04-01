# PomoFocus

A multi-platform Pomodoro productivity system spanning 9 targets: iOS, Android, web, macOS menu bar, iOS home screen widget, Apple Watch, VS Code extension, Claude Code (MCP), and a custom BLE-connected physical device with an e-ink display.

Cloud sync is a paid subscription feature. The app works fully offline on every platform.

## Status

**Foundation phase.** Core domain logic, database schema, API layer, firmware drivers, and AI-agent development infrastructure are implemented. UI and platform shell integration are next.

## Architecture

```
                   ┌─────────────────────────────────┐
                   │       Hono REST API (CF Workers) │
                   │   OpenAPI 3.1 + Zod validation   │
                   └──────────┬──────────────────────┘
                              │ JWT forwarding
                   ┌──────────▼──────────────────────┐
                   │   Supabase (Postgres + RLS)      │
                   │   12 tables, 14 migrations       │
                   └──────────────────────────────────┘

   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐
   │  iOS/Android│  │    Web     │  │  VS Code   │  │ macOS Widget │
   │  (Expo/RN) │  │ (Next.js)  │  │ Extension  │  │  (SwiftUI)   │
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
              ┌──────────▼──────────┐
              │   Shared Packages   │
              │  types | core | ui  │
              │ analytics | state   │
              │ data-access | ble   │
              └──────────┬──────────┘
                         │ BLE
              ┌──────────▼──────────┐
              │   Physical Device   │
              │  nRF52840 + e-ink   │
              │  4.26" 800x480      │
              └─────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Nx + pnpm |
| Language | TypeScript 5.8, Swift, C++ (Arduino) |
| Database | Supabase (Postgres + Row-Level Security) |
| API | Hono on Cloudflare Workers (REST + OpenAPI 3.1) |
| Auth | Supabase Auth (Google, Apple, email) |
| Mobile | Expo / React Native |
| Web | Next.js on Vercel |
| State | Zustand + TanStack Query |
| Device MCU | Seeed XIAO ePaper EN04 (nRF52840 Plus) |
| Display | 4.26" e-ink (GDEQ0426T82, SSD1677, 800x480) |
| BLE | react-native-ble-plx, Web Bluetooth, CoreBluetooth |
| Protobuf | Nanopb (firmware), protoc (TS/Swift) |
| Testing | Vitest, PlatformIO Test |
| CI | GitHub Actions + Nx affected |

## Project Structure

```
pomofocus/
├── packages/
│   ├── types/          # Auto-generated from Postgres schema
│   ├── core/           # Pure domain logic (timer FSM, goals, sync)
│   ├── analytics/      # Metrics computation (3 tiers)
│   ├── data-access/    # API client, auth, sync drivers
│   ├── state/          # Zustand stores + TanStack Query hooks
│   ├── ui/             # Shared React/RN components
│   └── ble-protocol/   # BLE GATT profile + Protobuf types
├── apps/
│   ├── api/            # Hono REST API (Cloudflare Workers)
│   ├── web/            # Web app (Expo/Next.js)
│   └── mobile/         # iOS + Android (Expo)
├── firmware/
│   └── device/         # nRF52840 + e-ink firmware (PlatformIO/C++)
├── supabase/
│   └── migrations/     # 14 SQL migrations (schema + RLS)
└── research/
    ├── decisions/      # 19 Architecture Decision Records
    └── designs/        # Design documents
```

## Core Design Decisions

- **Timer as pure state machine** -- `transition(state, event) -> newState` with discriminated unions. Same FSM ported to TypeScript and C++. No side effects in core.
- **Offline-first sync** -- Custom outbox pattern. Pure sync protocol in `core/`, IO drivers in `data-access/`. Client-generated UUIDs for idempotent retries.
- **API gateway** -- Clients never talk to Supabase directly. Hono API validates with Zod, generates OpenAPI spec, forwards JWTs for RLS defense-in-depth.
- **No composite "focus score"** -- Individual metrics (completion rate, focus quality, consistency, streaks) with trend arrows. Pure functions, computed server-side.
- **Device syncs through phone** -- BLE phone-first hub model. Device never connects to cloud directly. System ON sleep with BLE SoftDevice (~27uA).

All 19 decisions documented as Architecture Decision Records in `research/decisions/`.

## Device Hardware

Custom physical timer built on the Seeed XIAO ePaper EN04 board:

- **MCU:** nRF52840 Plus (64MHz ARM Cortex-M4F, 256KB RAM, 1MB Flash)
- **Display:** 4.26" e-ink (800x480, 219 PPI)
- **Input:** Rotary encoder (KY-040) with hardware debouncing
- **Feedback:** Vibration motor via 2N2222 transistor with flyback diode
- **Power:** 1200mAh LiPo, System ON sleep with BLE advertising
- **Protocol:** 5 custom GATT services, Protobuf encoding, adaptive MTU

Firmware is 1,647 lines of C++ using Arduino framework with zero dynamic allocation.

## Development

```bash
pnpm install
pnpm nx run-many -t test          # run all tests
pnpm nx run-many -t type-check    # type check all packages
pnpm nx run-many -t lint          # lint all packages
pnpm nx affected -t test          # test only changed packages
```

### Firmware

```bash
cd firmware/device
pio run                           # build firmware
pio test                          # run unit tests
pio run -t upload                 # flash to device
```

### Database

```bash
supabase start                    # local Postgres
supabase migration new <name>     # create migration
supabase db push                  # apply migrations
pnpm nx run types:gen:types       # regenerate TS types from schema
```

## Agent-Driven Development

This project uses an AI-agent-first development workflow. The repo includes:

- **17 reusable Claude Code skills** for issue pickup, architecture decisions, code review, and deployment
- **8 platform-specific subagents** scoped to their platform's files and test commands
- **Structured GitHub Issue templates** with verifiable goals, file paths, and test commands
- **Self-healing rules** (13 rules) for automated fix loops with budget caps and escalation ladders
- **Coding standards** enforced via rules files (TypeScript, testing, core package, firmware)

Issues are the unit of work. Each issue is small enough for an agent to pick up, implement, test, and PR autonomously.

## License

All rights reserved.
