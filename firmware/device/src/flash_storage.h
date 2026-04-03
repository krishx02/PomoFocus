// PomoFocus — Flash storage abstraction for nRF52840 internal flash.
// Provides read/write/erase for session data stored in a dedicated
// flash region (~256KB). Sequential writes with page-level erase for
// basic wear leveling. No dynamic allocation (NAT-F01).
// See ADR-010 for capacity (~2500 sessions) and ADR-015 for toolchain.

#ifndef POMOFOCUS_FLASH_STORAGE_H
#define POMOFOCUS_FLASH_STORAGE_H

#include <cstdint>
#include <cstddef>

namespace FlashStorage {

// ── Flash region layout ──
// nRF52840 has 1MB flash total. The session storage region occupies the
// last 256KB, above application code. Flash page size is 4KB.
//
// Memory map:
//   0x00000000 - 0x00026000  SoftDevice (BLE stack, ~152KB)
//   0x00026000 - 0x000C0000  Application code + libraries
//   0x000C0000 - 0x00100000  Session storage (this module)

constexpr uint32_t PAGE_SIZE       = 4096;         // nRF52840 flash page: 4KB
constexpr uint32_t REGION_START    = 0x000C0000;   // Start of session storage
constexpr uint32_t REGION_SIZE     = 256 * 1024;   // 256KB
constexpr uint32_t REGION_END      = REGION_START + REGION_SIZE;
constexpr uint32_t PAGE_COUNT      = REGION_SIZE / PAGE_SIZE; // 64 pages

// ── Record header ──
// Each record written to flash is prefixed with a 4-byte header containing
// the payload length. This enables readRecord to know how many bytes to
// return without the caller tracking sizes externally.

constexpr uint32_t RECORD_HEADER_SIZE = 4; // uint32_t length prefix

// Erased flash reads as 0xFF on nRF52840.
constexpr uint8_t ERASED_BYTE = 0xFF;

// ── Return codes ──

enum class FlashResult : uint8_t {
    OK,
    ERR_OUT_OF_BOUNDS,   // Address or offset outside the storage region
    ERR_PAGE_BOUNDARY,   // Record would cross a page boundary
    ERR_NOT_ERASED,      // Flash not erased at write destination
    ERR_WRITE_FAILED,    // Hardware write failed
    ERR_ERASE_FAILED,    // Hardware erase failed
    ERR_INVALID_RECORD,  // No valid record at read offset (erased or corrupt)
    ERR_BUFFER_TOO_SMALL // Caller buffer too small for the record
};

// ── Public API ──

// Initialize the flash storage module. Scans the region to find the
// current write offset (first erased location after valid records).
// Call once from setup().
void init();

// Write a record at the given byte offset within the storage region.
// The record is stored as: [4-byte length][payload bytes].
// offset is relative to REGION_START (0 = start of storage region).
//
// Returns OK on success, or an error if:
//   - offset + header + len exceeds the region
//   - the write would cross a page boundary
//   - the destination is not erased
//   - the hardware write fails
FlashResult writeRecord(uint32_t offset, const uint8_t* data, uint32_t len);

// Read a record from the given byte offset within the storage region.
// offset is relative to REGION_START.
// buf: caller-provided buffer to receive the payload.
// bufSize: size of buf in bytes.
// outLen: set to the actual payload length on success.
//
// Returns OK on success, or an error if:
//   - offset is outside the region
//   - no valid record header at offset (erased bytes)
//   - buf is too small for the payload
FlashResult readRecord(uint32_t offset, uint8_t* buf, uint32_t bufSize,
                       uint32_t& outLen);

// Erase a single flash page by page index (0-based within the region).
// pageIndex 0 = first page at REGION_START, etc.
//
// Returns OK on success, or an error if:
//   - pageIndex >= PAGE_COUNT
//   - the hardware erase fails
FlashResult erasePage(uint32_t pageIndex);

// Return the current write offset (bytes from REGION_START).
// This is the next location where writeRecord would place data.
// Advances after each successful writeRecord call.
uint32_t getWriteOffset();

// Return the total number of bytes used in the storage region
// (same as getWriteOffset() — sequential layout).
uint32_t getUsedBytes();

// Return true if the byte at the given absolute flash address is erased (0xFF).
bool isByteErased(uint32_t absoluteAddr);

} // namespace FlashStorage

#endif // POMOFOCUS_FLASH_STORAGE_H
