// PomoFocus — Session outbox implementation for nRF52840 firmware.
// FIFO queue with flash backing, circular buffer, and sync cursor.
// Encodes SessionRecord via Nanopb and writes to flash storage.
// See outbox.h for API documentation.

#include "outbox.h"
#include "flash_storage.h"

#include <Arduino.h>
#include <pb_encode.h>
#include <pb_decode.h>
#include <cstring>

// nRF52840 SoftDevice random number API.
// When the SoftDevice (BLE stack) is active, the hardware RNG is managed
// by the SoftDevice. Application code must use sd_rand_application_vector()
// to request random bytes — direct NVMC/RNG register access is blocked.
// Reference: nRF5 SDK SoftDevice Specification, Section 2.7 (RNG).
extern "C" {
#include "nrf_sdm.h"
#include "nrf_soc.h"
}

namespace {

// ── Flash layout constants ──

// Data region: pages 0 through 62 (63 pages).
constexpr uint32_t DATA_REGION_SIZE =
    Outbox::DATA_REGION_PAGES * FlashStorage::PAGE_SIZE; // 258048 bytes

// Metadata page: page 63 (absolute address).
constexpr uint32_t META_PAGE_ADDR =
    FlashStorage::REGION_START +
    (Outbox::META_PAGE_INDEX * FlashStorage::PAGE_SIZE);

// ── Metadata persistence ──
// Queue metadata is stored as log-structured entries in the metadata page.
// Each write appends a new entry. On init, the last valid entry is used.
// When the page fills, it is erased and the current state is written fresh.

// Magic number to validate metadata entries.
constexpr uint32_t META_MAGIC = 0x504D4654; // "PMFT" in ASCII

struct MetaEntry {
    uint32_t magic;         // META_MAGIC for validation
    uint32_t head;          // Byte offset of oldest record in data region
    uint32_t tail;          // Byte offset of next write position
    uint32_t count;         // Total records in queue
    uint32_t syncedCount;   // Records synced from head
    uint32_t checksum;      // XOR of all preceding fields
};

constexpr uint32_t META_ENTRY_SIZE = sizeof(MetaEntry); // 24 bytes
constexpr uint32_t META_MAX_ENTRIES =
    FlashStorage::PAGE_SIZE / META_ENTRY_SIZE; // 170 entries per page

// ── Module state (all static, no dynamic allocation — NAT-F01) ──

Outbox::QueueMeta g_meta = {};
uint32_t g_lastRecordSize = 0;

// Static encode buffer — avoids heap allocation.
uint8_t g_encodeBuffer[Outbox::ENCODE_BUFFER_SIZE];

// Static decode buffer for reading records.
uint8_t g_decodeBuffer[Outbox::ENCODE_BUFFER_SIZE];

// Current metadata entry index within the metadata page.
uint32_t g_metaEntryIndex = 0;

// ── Metadata checksum ──

uint32_t computeChecksum(const MetaEntry& entry) {
    return entry.magic ^ entry.head ^ entry.tail ^
           entry.count ^ entry.syncedCount;
}

// ── Metadata flash operations ──

// Read a metadata entry at the given index within the metadata page.
// Returns true if the entry is valid (magic and checksum match).
bool readMetaEntry(uint32_t index, MetaEntry& entry) {
    if (index >= META_MAX_ENTRIES) {
        return false;
    }

    uint32_t addr = META_PAGE_ADDR + (index * META_ENTRY_SIZE);
    const volatile uint32_t* ptr =
        reinterpret_cast<const volatile uint32_t*>(addr);

    // Check if the slot is erased (first word = 0xFFFFFFFF)
    if (*ptr == 0xFFFFFFFF) {
        return false;
    }

    memcpy(&entry, reinterpret_cast<const void*>(addr), META_ENTRY_SIZE);

    if (entry.magic != META_MAGIC) {
        return false;
    }

    if (entry.checksum != computeChecksum(entry)) {
        return false;
    }

    return true;
}

// Write a metadata entry at the given index within the metadata page.
// Uses word-by-word flash writes (same as flash_storage).
void writeMetaEntry(uint32_t index, const MetaEntry& entry) {
    if (index >= META_MAX_ENTRIES) {
        return;
    }

    uint32_t addr = META_PAGE_ADDR + (index * META_ENTRY_SIZE);

    // Write word-by-word using the same NVMC technique as flash_storage.
    // MetaEntry is 24 bytes = 6 words.
    const uint32_t* words = reinterpret_cast<const uint32_t*>(&entry);
    constexpr uint32_t WORD_COUNT = META_ENTRY_SIZE / 4;

    // Enable NVMC write mode
    constexpr uint32_t NVMC_BASE = 0x4001E000UL;
    volatile uint32_t* nvmcConfig =
        reinterpret_cast<volatile uint32_t*>(NVMC_BASE + 0x504);
    volatile uint32_t* nvmcReady =
        reinterpret_cast<volatile uint32_t*>(NVMC_BASE + 0x400);

    for (uint32_t i = 0; i < WORD_COUNT; i++) {
        *nvmcConfig = 1; // Write enable
        __DSB();
        *reinterpret_cast<volatile uint32_t*>(addr + (i * 4)) = words[i];
        while (*nvmcReady == 0) {} // Wait for completion
        *nvmcConfig = 0; // Read-only
        __DSB();
    }
}

// Erase the metadata page.
void eraseMetaPage() {
    // Use FlashStorage::erasePage which handles NVMC erase correctly.
    FlashStorage::erasePage(Outbox::META_PAGE_INDEX);
}

// Persist the current queue metadata to flash.
// Appends a new entry to the metadata page log. If the page is full,
// erases it and writes fresh.
void persistMeta() {
    if (g_metaEntryIndex >= META_MAX_ENTRIES) {
        // Page is full — erase and start fresh.
        eraseMetaPage();
        g_metaEntryIndex = 0;
    }

    MetaEntry entry = {};
    entry.magic = META_MAGIC;
    entry.head = g_meta.head;
    entry.tail = g_meta.tail;
    entry.count = g_meta.count;
    entry.syncedCount = g_meta.syncedCount;
    entry.checksum = computeChecksum(entry);

    writeMetaEntry(g_metaEntryIndex, entry);
    g_metaEntryIndex++;
}

// ── UUID generation ──

// Generate a UUID v4 using the nRF52840 hardware true random number generator.
// When SoftDevice is enabled, uses sd_rand_application_vector().
// When SoftDevice is not enabled, falls back to analogRead-based entropy.
// Sets version (4) and variant (RFC 4122) bits per UUID v4 spec.
// Returns true on success, false if RNG fails.
bool generateUuidV4(uint8_t uuid[16]) {
    // Check if SoftDevice is enabled
    uint8_t sdEnabled = 0;
    uint32_t err = sd_softdevice_is_enabled(&sdEnabled);

    if (err == NRF_SUCCESS && sdEnabled != 0) {
        // SoftDevice is active — use its RNG API.
        // sd_rand_application_vector may need multiple calls if the pool
        // is temporarily empty. Retry briefly.
        uint8_t bytesAvailable = 0;
        uint32_t retries = 0;
        constexpr uint32_t MAX_RETRIES = 1000;

        // Wait for enough random bytes in the pool
        while (retries < MAX_RETRIES) {
            sd_rand_application_bytes_available_get(&bytesAvailable);
            if (bytesAvailable >= 16) {
                break;
            }
            retries++;
            delayMicroseconds(100);
        }

        if (bytesAvailable < 16) {
            return false;
        }

        err = sd_rand_application_vector_get(uuid, 16);
        if (err != NRF_SUCCESS) {
            return false;
        }
    } else {
        // SoftDevice not enabled — fallback to analogRead entropy.
        // This path is primarily for testing without BLE.
        for (uint8_t i = 0; i < 16; i++) {
            uuid[i] = static_cast<uint8_t>(analogRead(A0) ^ (micros() & 0xFF));
            delayMicroseconds(10);
        }
    }

    // Set UUID version 4 (bits 4-7 of byte 6 = 0100)
    uuid[6] = (uuid[6] & 0x0F) | 0x40;

    // Set UUID variant RFC 4122 (bits 6-7 of byte 8 = 10)
    uuid[8] = (uuid[8] & 0x3F) | 0x80;

    return true;
}

// ── Record offset walking ──
// Walk the data region from a starting offset, counting records.
// Returns the byte offset of the record at the given index (0-based
// from startOffset). Returns DATA_REGION_SIZE if not found.

uint32_t walkToRecord(uint32_t startOffset, uint32_t skipCount) {
    uint32_t offset = startOffset;
    uint32_t skipped = 0;

    while (skipped < skipCount && offset < DATA_REGION_SIZE) {
        if (!FlashStorage::isValidRecord(offset)) {
            // Erased, incomplete, or corrupt — try wrapping.
            if (offset > 0 && startOffset > 0) {
                offset = 0;
                continue;
            }
            break;
        }

        uint32_t payloadLen = FlashStorage::getRecordPayloadLength(offset);
        uint32_t totalSize = FlashStorage::RECORD_HEADER_SIZE + payloadLen;
        totalSize = (totalSize + 3) & ~3U;
        offset += totalSize;

        // Wrap around if we hit the end of the data region
        if (offset >= DATA_REGION_SIZE) {
            offset = 0;
        }

        skipped++;
    }

    return offset;
}

// Get the byte size of the record at the given offset (header + payload, aligned).
// Returns 0 if no valid committed record.
uint32_t recordSizeAt(uint32_t offset) {
    if (offset >= DATA_REGION_SIZE) {
        return 0;
    }

    if (!FlashStorage::isValidRecord(offset)) {
        return 0;
    }

    uint32_t payloadLen = FlashStorage::getRecordPayloadLength(offset);
    uint32_t totalSize = FlashStorage::RECORD_HEADER_SIZE + payloadLen;
    return (totalSize + 3) & ~3U;
}

} // anonymous namespace

namespace Outbox {

void init() {
    // Try to restore queue metadata from the metadata flash page.
    // Walk the log-structured metadata entries to find the last valid one.
    g_meta = {};
    g_lastRecordSize = 0;
    g_metaEntryIndex = 0;

    bool metaFound = false;
    MetaEntry lastValid = {};

    for (uint32_t i = 0; i < META_MAX_ENTRIES; i++) {
        MetaEntry entry = {};
        if (readMetaEntry(i, entry)) {
            lastValid = entry;
            metaFound = true;
            g_metaEntryIndex = i + 1;
        } else {
            // First erased/invalid slot — no more entries.
            break;
        }
    }

    if (metaFound) {
        g_meta.head = lastValid.head;
        g_meta.tail = lastValid.tail;
        g_meta.count = lastValid.count;
        g_meta.syncedCount = lastValid.syncedCount;

        // Validate: tail should be within data region
        if (g_meta.tail > DATA_REGION_SIZE) {
            g_meta.tail = 0;
        }
        if (g_meta.head > DATA_REGION_SIZE) {
            g_meta.head = 0;
        }

        // Check for incomplete write at the tail position.
        // If power was lost after writing length+payload but before the
        // magic commit word, non-erased data sits at tail. Erase that
        // page so the next storeSession can write there.
        if (g_meta.tail + FlashStorage::RECORD_HEADER_SIZE <=
            DATA_REGION_SIZE) {
            uint32_t tailAddr =
                FlashStorage::REGION_START + g_meta.tail;
            uint32_t tailWord =
                *reinterpret_cast<const volatile uint32_t*>(tailAddr);

            if (tailWord != 0xFFFFFFFF &&
                tailWord != FlashStorage::RECORD_MAGIC) {
                // Non-erased, non-committed data — incomplete write.
                uint32_t pageIdx =
                    g_meta.tail / FlashStorage::PAGE_SIZE;
                FlashStorage::erasePage(pageIdx);
                // Snap tail to the start of the erased page.
                g_meta.tail = pageIdx * FlashStorage::PAGE_SIZE;
                persistMeta();
                Serial.print("[outbox] cleaned incomplete write at page ");
                Serial.println(pageIdx);
            }
        }

        Serial.print("[outbox] init from meta: count=");
        Serial.print(g_meta.count);
        Serial.print(" synced=");
        Serial.print(g_meta.syncedCount);
        Serial.print(" head=");
        Serial.print(g_meta.head);
        Serial.print(" tail=");
        Serial.println(g_meta.tail);
    } else {
        // No valid metadata — scan the data region to reconstruct.
        // This handles first boot and corrupt metadata.
        uint32_t offset = 0;
        uint32_t count = 0;

        while (offset + FlashStorage::RECORD_HEADER_SIZE <= DATA_REGION_SIZE) {
            if (!FlashStorage::isValidRecord(offset)) {
                // Not a committed record. Check if this is an incomplete
                // write (power lost mid-write) vs erased space.
                uint32_t absAddr = FlashStorage::REGION_START + offset;
                uint32_t firstWord =
                    *reinterpret_cast<const volatile uint32_t*>(absAddr);

                if (firstWord != 0xFFFFFFFF) {
                    // Non-erased but not a valid record — incomplete write.
                    // Erase the page containing the partial data so the
                    // space can be reused. Data loss accepted over crash.
                    uint32_t pageIdx = offset / FlashStorage::PAGE_SIZE;
                    FlashStorage::erasePage(pageIdx);
                    Serial.print("[outbox] erased incomplete write at page ");
                    Serial.println(pageIdx);
                    // Set tail to start of the erased page (now clean).
                    offset = pageIdx * FlashStorage::PAGE_SIZE;
                }
                break;
            }

            uint32_t payloadLen =
                FlashStorage::getRecordPayloadLength(offset);
            count++;
            g_lastRecordSize = payloadLen;

            uint32_t totalSize =
                FlashStorage::RECORD_HEADER_SIZE + payloadLen;
            totalSize = (totalSize + 3) & ~3U;
            offset += totalSize;
        }

        g_meta.head = 0;
        g_meta.tail = offset;
        g_meta.count = count;
        g_meta.syncedCount = 0; // No sync info — treat all as pending.

        // Persist the reconstructed metadata.
        if (count > 0) {
            persistMeta();
        }

        Serial.print("[outbox] init from scan: ");
        Serial.print(count);
        Serial.print(" records, tail=");
        Serial.println(offset);
    }
}

StoreResult storeSession(const SessionParams& params) {
    // 1. Generate a client UUID for this session (ADR-006: idempotent inserts)
    uint8_t sessionId[16];
    if (!generateUuidV4(sessionId)) {
        Serial.println("[outbox] ERR: RNG failed");
        return StoreResult::ERR_RNG_FAILED;
    }

    // 2. Populate the Nanopb SessionRecord struct
    pomofocus_ble_SessionRecord record = pomofocus_ble_SessionRecord_init_zero;

    // Field 1: id (client-generated UUID)
    record.id.size = 16;
    memcpy(record.id.bytes, sessionId, 16);

    // Field 2: goal_id (optional — only if caller provided one)
    if (params.hasGoalId) {
        record.goal_id.size = 16;
        memcpy(record.goal_id.bytes, params.goalId, 16);
    }

    // Field 3-4: timestamps as Unix seconds since epoch
    record.started_at = params.startedAt;
    record.ended_at = params.endedAt;

    // Field 5-6: durations in seconds
    record.planned_duration = params.plannedDuration;
    record.actual_duration = params.actualDuration;

    // Field 7-8: type and outcome enums
    record.type = params.type;
    record.outcome = params.outcome;

    // Fields 9-12 (focus_quality, intention, reflection, distraction_note):
    // Left at zero/empty — device does not collect reflection data (out of scope).

    // 3. Encode via Nanopb into the static buffer
    pb_ostream_t ostream =
        pb_ostream_from_buffer(g_encodeBuffer, sizeof(g_encodeBuffer));
    if (!pb_encode(&ostream, pomofocus_ble_SessionRecord_fields, &record)) {
        Serial.print("[outbox] ERR: encode failed: ");
        Serial.println(PB_GET_ERROR(&ostream));
        return StoreResult::ERR_ENCODE_FAILED;
    }

    uint32_t encodedSize = static_cast<uint32_t>(ostream.bytes_written);

    // 4. Check capacity
    uint32_t totalNeeded = FlashStorage::RECORD_HEADER_SIZE + encodedSize;
    uint32_t alignedNeeded = (totalNeeded + 3) & ~3U;

    if (getCapacityRemaining() < alignedNeeded) {
        // Try to reclaim synced pages at the head.
        // If head < tail and there are synced records, erase head pages.
        if (g_meta.syncedCount > 0) {
            // Walk synced records to find which pages can be erased.
            uint32_t reclaimOffset = g_meta.head;
            uint32_t reclaimedRecords = 0;
            uint32_t reclaimedPages = 0;
            uint32_t currentPage = g_meta.head / FlashStorage::PAGE_SIZE;

            while (reclaimedRecords < g_meta.syncedCount) {
                uint32_t recSize = recordSizeAt(reclaimOffset);
                if (recSize == 0) {
                    break;
                }

                reclaimOffset += recSize;
                if (reclaimOffset >= DATA_REGION_SIZE) {
                    reclaimOffset = 0;
                }
                reclaimedRecords++;

                // Check if we've moved past a page boundary
                uint32_t newPage = reclaimOffset / FlashStorage::PAGE_SIZE;
                while (currentPage != newPage &&
                       reclaimedPages < DATA_REGION_PAGES) {
                    FlashStorage::erasePage(currentPage);
                    reclaimedPages++;
                    currentPage++;
                    if (currentPage >= DATA_REGION_PAGES) {
                        currentPage = 0;
                    }
                }
            }

            if (reclaimedRecords > 0) {
                g_meta.head = reclaimOffset;
                g_meta.count -= reclaimedRecords;
                g_meta.syncedCount -= reclaimedRecords;

                Serial.print("[outbox] reclaimed ");
                Serial.print(reclaimedPages);
                Serial.print(" pages, ");
                Serial.print(reclaimedRecords);
                Serial.println(" records");
            }
        }

        // Re-check capacity after reclaim
        if (getCapacityRemaining() < alignedNeeded) {
            Serial.println("[outbox] ERR: flash full");
            return StoreResult::ERR_FLASH_FULL;
        }
    }

    // 5. Write encoded record to flash at tail position
    uint32_t writeOffset = g_meta.tail;

    FlashStorage::FlashResult flashResult =
        FlashStorage::writeRecord(writeOffset, g_encodeBuffer, encodedSize);

    if (flashResult == FlashStorage::FlashResult::ERR_PAGE_BOUNDARY) {
        // Record would cross a page boundary — advance to next page and retry.
        uint32_t nextPage =
            ((writeOffset / FlashStorage::PAGE_SIZE) + 1) *
            FlashStorage::PAGE_SIZE;
        if (nextPage >= DATA_REGION_SIZE) {
            nextPage = 0; // Wrap around to start of data region
        }

        // Check if the target page is erased (it should be if properly reclaimed)
        if (nextPage + alignedNeeded > DATA_REGION_SIZE && nextPage != 0) {
            Serial.println("[outbox] ERR: flash full after page advance");
            return StoreResult::ERR_FLASH_FULL;
        }

        Serial.println("[outbox] page boundary, advanced to next page");
        writeOffset = nextPage;
        flashResult =
            FlashStorage::writeRecord(writeOffset, g_encodeBuffer, encodedSize);
    }

    if (flashResult != FlashStorage::FlashResult::OK) {
        Serial.print("[outbox] ERR: flash write failed: ");
        Serial.println(static_cast<uint8_t>(flashResult));
        return StoreResult::ERR_FLASH_WRITE;
    }

    // 6. Update queue metadata
    uint32_t totalWritten = FlashStorage::RECORD_HEADER_SIZE + encodedSize;
    totalWritten = (totalWritten + 3) & ~3U;

    g_meta.tail = writeOffset + totalWritten;
    if (g_meta.tail >= DATA_REGION_SIZE) {
        g_meta.tail = 0; // Wrap around
    }
    g_meta.count++;
    g_lastRecordSize = encodedSize;

    // Persist updated metadata
    persistMeta();

    Serial.print("[outbox] stored session: ");
    Serial.print(encodedSize);
    Serial.print(" bytes, count=");
    Serial.print(g_meta.count);
    Serial.print(" pending=");
    Serial.println(getPendingCount());

    return StoreResult::OK;
}

uint32_t getRecordCount() {
    return g_meta.count;
}

uint32_t getUsedBytes() {
    if (g_meta.count == 0) {
        return 0;
    }
    if (g_meta.tail >= g_meta.head) {
        return g_meta.tail - g_meta.head;
    }
    // Wrapped: data from head to end + start to tail
    return (DATA_REGION_SIZE - g_meta.head) + g_meta.tail;
}

uint32_t getLastRecordSize() {
    return g_lastRecordSize;
}

uint32_t getPendingCount() {
    if (g_meta.syncedCount >= g_meta.count) {
        return 0;
    }
    return g_meta.count - g_meta.syncedCount;
}

ReadResult getNextPending(pomofocus_ble_SessionRecord& record) {
    if (getPendingCount() == 0) {
        return ReadResult::ERR_NO_PENDING;
    }

    // Walk from head, skipping syncedCount records to find the first
    // un-synced record.
    uint32_t offset = walkToRecord(g_meta.head, g_meta.syncedCount);
    if (offset >= DATA_REGION_SIZE) {
        return ReadResult::ERR_FLASH_READ;
    }

    // Read the record from flash
    uint32_t outLen = 0;
    FlashStorage::FlashResult flashResult =
        FlashStorage::readRecord(offset, g_decodeBuffer,
                                 sizeof(g_decodeBuffer), outLen);

    if (flashResult != FlashStorage::FlashResult::OK) {
        Serial.print("[outbox] ERR: read failed at offset ");
        Serial.println(offset);
        return ReadResult::ERR_FLASH_READ;
    }

    // Decode the Protobuf record
    memset(&record, 0, sizeof(record));
    pb_istream_t istream = pb_istream_from_buffer(g_decodeBuffer, outLen);
    if (!pb_decode(&istream, pomofocus_ble_SessionRecord_fields, &record)) {
        Serial.print("[outbox] ERR: decode failed: ");
        Serial.println(PB_GET_ERROR(&istream));
        return ReadResult::ERR_DECODE_FAILED;
    }

    return ReadResult::OK;
}

void markSynced() {
    if (getPendingCount() == 0) {
        return;
    }

    g_meta.syncedCount++;

    // Check if we can reclaim completed pages at the head.
    // If all records in the leading page(s) are synced, erase them
    // and advance head to free space for new records.
    if (g_meta.syncedCount == g_meta.count) {
        // All records synced — we could reclaim everything.
        // But defer actual erasure to storeSession when space is needed.
        // This avoids unnecessary erase cycles (flash wear).
    }

    // Persist updated metadata
    persistMeta();

    Serial.print("[outbox] markSynced: synced=");
    Serial.print(g_meta.syncedCount);
    Serial.print(" pending=");
    Serial.println(getPendingCount());
}

uint32_t getCapacityRemaining() {
    uint32_t used = getUsedBytes();
    if (used >= DATA_REGION_SIZE) {
        return 0;
    }
    return DATA_REGION_SIZE - used;
}

QueueMeta getQueueMeta() {
    return g_meta;
}

} // namespace Outbox
