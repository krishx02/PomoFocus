// PomoFocus Device Firmware — BLE GATT UUID Definitions
// Custom 128-bit UUIDs for all PomoFocus GATT services and characteristics.
// See ADR-013 (GATT protocol) for the UUID scheme and service design.
//
// UUID scheme: 504D4643-XXXX-CAFE-FACE-DEAD00000000
//   504D4643 = "PMFC" (PomoFocus prefix)
//   XXXX     = service/characteristic identifier
//   Services: 0001 (Timer), 0002 (Goal), 0003 (Session Sync)
//   Characteristics: first two hex digits match service (01xx, 02xx, 03xx)
//
// All byte arrays are in little-endian order for the Adafruit Bluefruit API.

#ifndef POMOFOCUS_BLE_UUIDS_H
#define POMOFOCUS_BLE_UUIDS_H

#include <cstdint>

// ── Helper: UUID byte-array layout ──
// 128-bit UUID: 504D4643-XXXX-CAFE-FACE-DEAD00000000
// Written as bytes (big-endian): 50 4D 46 43 XX XX CA FE FA CE DE AD 00 00 00 00
// Bluefruit expects little-endian order (last byte first):
//   bytes[0..3]   = last 4 bytes   = 00 00 00 00 → DEAD
//   bytes[4..5]   = DEAD            → FACE
//   bytes[6..7]   = FACE            → CAFE
//   bytes[8..9]   = CAFE            → XXXX
//   bytes[10..11] = XXXX            → 504D4643
//   bytes[12..15] = 504D4643
//
// Little-endian: 00 00 00 00  AD DE  CE FA  FE CA  XX XX  43 46 4D 50

// ══════════════════════════════════════════════════════════════════════
// Timer Service (0001)
// ══════════════════════════════════════════════════════════════════════

// Timer Service UUID: 504D4643-0001-CAFE-FACE-DEAD00000000
constexpr uint8_t UUID_TIMER_SERVICE[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x00, 0x43, 0x46, 0x4D, 0x50
};

// Timer State Characteristic UUID: 504D4643-0101-CAFE-FACE-DEAD00000000
// Properties: Read, Notify
constexpr uint8_t UUID_TIMER_STATE_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x01, 0x43, 0x46, 0x4D, 0x50
};

// Timer Command Characteristic UUID: 504D4643-0102-CAFE-FACE-DEAD00000000
// Properties: Write
constexpr uint8_t UUID_TIMER_COMMAND_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x02, 0x01, 0x43, 0x46, 0x4D, 0x50
};

// ══════════════════════════════════════════════════════════════════════
// Goal Service (0002)
// ══════════════════════════════════════════════════════════════════════

// Goal Service UUID: 504D4643-0002-CAFE-FACE-DEAD00000000
constexpr uint8_t UUID_GOAL_SERVICE[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x02, 0x00, 0x43, 0x46, 0x4D, 0x50
};

// Goal List Characteristic UUID: 504D4643-0201-CAFE-FACE-DEAD00000000
// Properties: Write
constexpr uint8_t UUID_GOAL_LIST_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x02, 0x43, 0x46, 0x4D, 0x50
};

// Selected Goal Characteristic UUID: 504D4643-0202-CAFE-FACE-DEAD00000000
// Properties: Read, Notify
constexpr uint8_t UUID_GOAL_SELECTED_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x02, 0x02, 0x43, 0x46, 0x4D, 0x50
};

// ══════════════════════════════════════════════════════════════════════
// Session Sync Service (0003)
// ══════════════════════════════════════════════════════════════════════

// Session Sync Service UUID: 504D4643-0003-CAFE-FACE-DEAD00000000
constexpr uint8_t UUID_SESSION_SYNC_SERVICE[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x03, 0x00, 0x43, 0x46, 0x4D, 0x50
};

// Sync Status Characteristic UUID: 504D4643-0301-CAFE-FACE-DEAD00000000
// Properties: Read, Notify
constexpr uint8_t UUID_SYNC_STATUS_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x01, 0x03, 0x43, 0x46, 0x4D, 0x50
};

// Session Data Characteristic UUID: 504D4643-0302-CAFE-FACE-DEAD00000000
// Properties: Notify (bulk TX — device streams sessions to phone)
constexpr uint8_t UUID_SESSION_DATA_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x02, 0x03, 0x43, 0x46, 0x4D, 0x50
};

// Sync Control Characteristic UUID: 504D4643-0303-CAFE-FACE-DEAD00000000
// Properties: Write (bulk RX — phone sends sync commands to device)
constexpr uint8_t UUID_SYNC_CONTROL_CHAR[16] = {
    0x00, 0x00, 0x00, 0x00, 0xAD, 0xDE, 0xCE, 0xFA,
    0xFE, 0xCA, 0x03, 0x03, 0x43, 0x46, 0x4D, 0x50
};

#endif // POMOFOCUS_BLE_UUIDS_H
