---
paths:
  - 'firmware/**'
---

# Firmware Standards

Source: research/coding-standards.md Section 4b

C++/Arduino on nRF52840 (EN04 board). 256KB RAM shared with BLE SoftDevice.

- **NAT-F01:** Zero dynamic allocation. No `malloc`, `new`, `String`, `std::string`, `std::vector`. Use fixed-size arrays, static buffers, and stack allocation only. Heap fragmentation will crash the device in the field.
- **NAT-F02:** Every Protobuf field with variable-length data must have `max_size` or `max_count` in the Nanopb `.options` file. Without limits, Nanopb falls back to dynamic allocation (violates NAT-F01).
- **NAT-F03:** Use `constexpr` for all compile-time constants. Never `#define` for values that have a type — `#define` has no type checking or scope.
- **NAT-F04:** Timer FSM must be a direct port of `packages/core/src/timer/` — same states, same events, same transition table. Any TS FSM change must be mirrored in C++.
- **NAT-F05:** System ON sleep only (`sd_app_evt_wait()`). Never System OFF (`sd_power_system_off()`) — it kills BLE discoverability and the phone can't find the device.
- **NAT-F06:** PlatformIO standard layout: `src/` for code, `include/` for headers, `lib/` for project-local libraries, `test/` for unit tests.
- **NAT-F07:** Use BLE NOTIFY for frequent updates (timer state, battery). Use INDICATE only for critical operations requiring ACK (session sync completion, firmware update).
