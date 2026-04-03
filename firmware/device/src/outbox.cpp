// PomoFocus — Session outbox implementation for nRF52840 firmware.
// Encodes SessionRecord via Nanopb and writes to flash storage.
// See outbox.h for API documentation.

#include "outbox.h"
#include "flash_storage.h"

#include <Arduino.h>
#include <pb_encode.h>
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

// ── Module state (all static, no dynamic allocation — NAT-F01) ──

uint32_t g_recordCount = 0;
uint32_t g_lastRecordSize = 0;

// Static encode buffer — avoids heap allocation.
uint8_t g_encodeBuffer[Outbox::ENCODE_BUFFER_SIZE];

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

} // anonymous namespace

namespace Outbox {

void init() {
    // Scan existing flash records to count them.
    // Walk through flash from offset 0, counting valid records.
    g_recordCount = 0;
    g_lastRecordSize = 0;

    uint32_t offset = 0;
    while (offset + FlashStorage::RECORD_HEADER_SIZE <= FlashStorage::REGION_SIZE) {
        uint32_t absAddr = FlashStorage::REGION_START + offset;
        uint32_t headerVal = *reinterpret_cast<const volatile uint32_t*>(absAddr);

        if (headerVal == 0xFFFFFFFF) {
            // Reached erased space — no more records.
            break;
        }

        // Sanity check
        if (headerVal > FlashStorage::REGION_SIZE) {
            break;
        }

        g_recordCount++;
        g_lastRecordSize = headerVal;

        // Advance past this record (header + payload, aligned to 4 bytes)
        uint32_t totalSize = FlashStorage::RECORD_HEADER_SIZE + headerVal;
        totalSize = (totalSize + 3) & ~3U;
        offset += totalSize;
    }

    Serial.print("[outbox] init: ");
    Serial.print(g_recordCount);
    Serial.println(" records found");
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
    pb_ostream_t ostream = pb_ostream_from_buffer(g_encodeBuffer, sizeof(g_encodeBuffer));
    if (!pb_encode(&ostream, pomofocus_ble_SessionRecord_fields, &record)) {
        Serial.print("[outbox] ERR: encode failed: ");
        Serial.println(PB_GET_ERROR(&ostream));
        return StoreResult::ERR_ENCODE_FAILED;
    }

    uint32_t encodedSize = static_cast<uint32_t>(ostream.bytes_written);

    // 4. Write encoded record to flash
    uint32_t writeOffset = FlashStorage::getWriteOffset();

    // Check if there is enough space (record header + payload)
    uint32_t totalNeeded = FlashStorage::RECORD_HEADER_SIZE + encodedSize;
    uint32_t alignedNeeded = (totalNeeded + 3) & ~3U;
    if (writeOffset + alignedNeeded > FlashStorage::REGION_SIZE) {
        Serial.println("[outbox] ERR: flash full");
        return StoreResult::ERR_FLASH_FULL;
    }

    FlashStorage::FlashResult flashResult =
        FlashStorage::writeRecord(writeOffset, g_encodeBuffer, encodedSize);

    if (flashResult != FlashStorage::FlashResult::OK) {
        Serial.print("[outbox] ERR: flash write failed: ");
        Serial.println(static_cast<uint8_t>(flashResult));
        return StoreResult::ERR_FLASH_WRITE;
    }

    // 5. Update tracking state
    g_recordCount++;
    g_lastRecordSize = encodedSize;

    Serial.print("[outbox] stored session: ");
    Serial.print(encodedSize);
    Serial.print(" bytes, total=");
    Serial.println(g_recordCount);

    return StoreResult::OK;
}

uint32_t getRecordCount() {
    return g_recordCount;
}

uint32_t getUsedBytes() {
    return FlashStorage::getUsedBytes();
}

uint32_t getLastRecordSize() {
    return g_lastRecordSize;
}

} // namespace Outbox
