// PomoFocus — Session outbox for nRF52840 firmware.
// FIFO queue with flash backing for session records.
// Encodes completed timer sessions as Protobuf SessionRecord via Nanopb
// and writes them to flash storage for later BLE sync.
// Client-generated UUIDs via nRF52840 hardware RNG (ADR-006).
// See ADR-006 (outbox pattern) and ADR-013 (SessionRecord proto).

#ifndef POMOFOCUS_OUTBOX_H
#define POMOFOCUS_OUTBOX_H

#include <cstdint>
#include "pomofocus.pb.h"

namespace Outbox {

// ── Return codes ──

enum class StoreResult : uint8_t {
    OK,
    ERR_ENCODE_FAILED,  // Nanopb pb_encode returned false
    ERR_FLASH_FULL,     // No space left in flash storage region
    ERR_FLASH_WRITE,    // Flash write failed (hardware error or page boundary)
    ERR_RNG_FAILED,     // Hardware RNG could not generate UUID bytes
};

enum class ReadResult : uint8_t {
    OK,
    ERR_NO_PENDING,     // No un-synced sessions available
    ERR_FLASH_READ,     // Flash read failed
    ERR_DECODE_FAILED,  // Nanopb pb_decode returned false
};

// ── Session parameters ──
// Caller provides raw session data; storeSession handles UUID generation,
// Protobuf encoding, and flash persistence. No dynamic allocation (NAT-F01).

struct SessionParams {
    uint8_t goalId[16];     // UUID of the goal (16 bytes, zeroed if no goal)
    bool hasGoalId;         // true if goalId is set
    int64_t startedAt;      // Unix timestamp (seconds since epoch)
    int64_t endedAt;        // Unix timestamp (seconds since epoch)
    uint32_t plannedDuration; // Planned focus duration in seconds
    uint32_t actualDuration;  // Actual elapsed duration in seconds
    pomofocus_ble_SessionType type;
    pomofocus_ble_SessionOutcome outcome;
};

// ── Queue metadata ──
// Persisted in the last flash page. Tracks FIFO head/tail and sync cursor.

struct QueueMeta {
    uint32_t head;          // Byte offset of oldest record in data region
    uint32_t tail;          // Byte offset of next write position in data region
    uint32_t count;         // Total number of records in queue
    uint32_t syncedCount;   // Number of records synced from head
};

// ── Encode buffer size ──
// Static buffer for Nanopb encoding. SessionRecord max encoded size is
// defined by Nanopb as pomofocus_ble_SessionRecord_size (989 bytes).
// The device only sets numeric/bytes fields (no reflection strings),
// so actual encoded size will be much smaller (~60-80 bytes), but we
// allocate the full max to handle any valid SessionRecord.

constexpr uint32_t ENCODE_BUFFER_SIZE = pomofocus_ble_SessionRecord_size;

// ── Flash layout ──
// Last page of the flash region is reserved for queue metadata.
// Data region is all pages except the last.

constexpr uint32_t META_PAGE_INDEX = 63;   // Last page in the 64-page region
constexpr uint32_t DATA_REGION_PAGES = 63; // Pages 0-62 for session data

// ── Public API ──

// Initialize the outbox module. Call after FlashStorage::init().
// Reads persisted queue metadata from flash. If metadata is invalid
// (first boot or corrupt), scans the data region to reconstruct state.
void init();

// Encode a completed session as a Protobuf SessionRecord and write to flash.
// Generates a client UUID (v4) via the nRF52840 hardware RNG.
// Returns OK on success, or an error code on failure.
StoreResult storeSession(const SessionParams& params);

// Return the number of session records stored in flash.
uint32_t getRecordCount();

// Return the total bytes used in flash by session records
// (including record headers).
uint32_t getUsedBytes();

// Return the size in bytes of the last successfully encoded record
// (Protobuf payload only, excluding the flash record header).
// Returns 0 if no record has been stored yet.
uint32_t getLastRecordSize();

// ── Queue management API ──

// Return the number of un-synced sessions (count - syncedCount).
uint32_t getPendingCount();

// Read the oldest un-synced session record into the provided struct.
// Returns OK on success, ERR_NO_PENDING if all sessions are synced.
ReadResult getNextPending(pomofocus_ble_SessionRecord& record);

// Mark the oldest un-synced session as synced.
// Advances the sync cursor and persists updated metadata to flash.
// If all records on the head page(s) are synced, reclaims them for reuse.
void markSynced();

// Return the number of bytes available for new session records
// in the data region.
uint32_t getCapacityRemaining();

// Return a copy of the current queue metadata (for BLE sync status).
QueueMeta getQueueMeta();

} // namespace Outbox

#endif // POMOFOCUS_OUTBOX_H
