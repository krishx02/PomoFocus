// PomoFocus — Flash storage implementation for nRF52840 internal flash.
// Uses the nRF52 NVMC (Non-Volatile Memory Controller) peripheral for
// read/write/erase of the dedicated session storage region.
// See flash_storage.h for API documentation.

#include "flash_storage.h"
#include <Arduino.h>
#include <cstring>

// nRF52840 NVMC (Non-Volatile Memory Controller) registers.
// These are memory-mapped hardware registers for flash operations.
// Reference: nRF52840 Product Specification, Section 4.3 (NVMC).
#ifndef NRF_NVMC_BASE
#define NRF_NVMC_BASE 0x4001E000UL
#endif

// NVMC register offsets
constexpr uint32_t NVMC_READY    = 0x400;  // Ready flag (1 = ready)
constexpr uint32_t NVMC_CONFIG   = 0x504;  // Configuration register
constexpr uint32_t NVMC_ERASEPAGE = 0x508; // Erase page register

// NVMC CONFIG values
constexpr uint32_t NVMC_CONFIG_REN  = 0; // Read-only (default)
constexpr uint32_t NVMC_CONFIG_WEN  = 1; // Write enable
constexpr uint32_t NVMC_CONFIG_EEN  = 2; // Erase enable

namespace {

// Access NVMC registers via memory-mapped IO.
volatile uint32_t& nvmcReg(uint32_t offset) {
    return *reinterpret_cast<volatile uint32_t*>(NRF_NVMC_BASE + offset);
}

// Wait for the NVMC to become ready (previous operation complete).
void waitReady() {
    while (nvmcReg(NVMC_READY) == 0) {
        // Spin — typically takes ~85us for a word write, ~85ms for a page erase.
    }
}

// Enable write mode on NVMC.
void enableWrite() {
    nvmcReg(NVMC_CONFIG) = NVMC_CONFIG_WEN;
    __DSB(); // Data synchronization barrier
}

// Enable erase mode on NVMC.
void enableErase() {
    nvmcReg(NVMC_CONFIG) = NVMC_CONFIG_EEN;
    __DSB();
}

// Return NVMC to read-only mode.
void disableWrite() {
    nvmcReg(NVMC_CONFIG) = NVMC_CONFIG_REN;
    __DSB();
}

// Write a single 32-bit word to flash. Flash must be erased first.
// addr must be 4-byte aligned.
void writeWord(uint32_t addr, uint32_t value) {
    enableWrite();
    *reinterpret_cast<volatile uint32_t*>(addr) = value;
    waitReady();
    disableWrite();
}

// Current write offset within the region (bytes from REGION_START).
// Initialized by init() scanning for the first erased location.
uint32_t g_writeOffset = 0;

} // anonymous namespace

namespace FlashStorage {

bool isByteErased(uint32_t absoluteAddr) {
    return *reinterpret_cast<const volatile uint8_t*>(absoluteAddr) == ERASED_BYTE;
}

void init() {
    // Scan the storage region to find the write offset.
    // Walk forward from REGION_START, looking for the first 4-byte-aligned
    // position where the record header reads as erased (0xFFFFFFFF).
    g_writeOffset = 0;

    while (g_writeOffset + RECORD_HEADER_SIZE <= REGION_SIZE) {
        uint32_t addr = REGION_START + g_writeOffset;
        uint32_t headerVal = *reinterpret_cast<const volatile uint32_t*>(addr);

        if (headerVal == 0xFFFFFFFF) {
            // Found erased space — this is the next write position.
            break;
        }

        // Valid record header: skip past header + payload.
        // Round up to 4-byte alignment for the next record.
        uint32_t payloadLen = headerVal;

        // Sanity check: if payloadLen is unreasonably large, the region
        // is corrupt. Stop scanning here.
        if (payloadLen > REGION_SIZE) {
            break;
        }

        uint32_t totalSize = RECORD_HEADER_SIZE + payloadLen;
        // Align up to 4 bytes
        totalSize = (totalSize + 3) & ~3U;
        g_writeOffset += totalSize;
    }

    Serial.print("[flash] init: write offset = ");
    Serial.println(g_writeOffset);
}

FlashResult writeRecord(uint32_t offset, const uint8_t* data, uint32_t len) {
    uint32_t totalSize = RECORD_HEADER_SIZE + len;
    // Align total size to 4 bytes for next record alignment
    uint32_t alignedSize = (totalSize + 3) & ~3U;

    // Bounds check: record must fit within the region
    if (offset + alignedSize > REGION_SIZE) {
        return FlashResult::ERR_OUT_OF_BOUNDS;
    }

    uint32_t absAddr = REGION_START + offset;

    // Page boundary check: record must not cross a page boundary.
    // This simplifies erase — a page can be erased without splitting records.
    uint32_t pageStart = absAddr & ~(PAGE_SIZE - 1);
    uint32_t pageEnd = pageStart + PAGE_SIZE;
    if (absAddr + alignedSize > pageEnd) {
        return FlashResult::ERR_PAGE_BOUNDARY;
    }

    // Verify destination is erased
    for (uint32_t i = 0; i < alignedSize; i++) {
        if (!isByteErased(absAddr + i)) {
            return FlashResult::ERR_NOT_ERASED;
        }
    }

    // Write the header (4-byte length prefix)
    writeWord(absAddr, len);

    // Write the payload in 4-byte words.
    // If len is not a multiple of 4, the last word is padded with 0xFF
    // (erased bits stay high, so writing 0xFF to already-erased bits is safe).
    uint32_t wordCount = (len + 3) / 4;
    for (uint32_t i = 0; i < wordCount; i++) {
        uint32_t word = 0xFFFFFFFF; // Default: all bits high (erased)
        uint32_t bytesLeft = len - (i * 4);
        uint32_t bytesToCopy = bytesLeft < 4 ? bytesLeft : 4;
        memcpy(&word, data + (i * 4), bytesToCopy);
        writeWord(absAddr + RECORD_HEADER_SIZE + (i * 4), word);
    }

    // Verify the write by reading back
    uint32_t readHeader = *reinterpret_cast<const volatile uint32_t*>(absAddr);
    if (readHeader != len) {
        return FlashResult::ERR_WRITE_FAILED;
    }

    // Advance the write offset past this record
    if (offset + alignedSize > g_writeOffset) {
        g_writeOffset = offset + alignedSize;
    }

    return FlashResult::OK;
}

FlashResult readRecord(uint32_t offset, uint8_t* buf, uint32_t bufSize,
                       uint32_t& outLen) {
    // Bounds check: at least the header must be within the region
    if (offset + RECORD_HEADER_SIZE > REGION_SIZE) {
        return FlashResult::ERR_OUT_OF_BOUNDS;
    }

    uint32_t absAddr = REGION_START + offset;

    // Read the header
    uint32_t headerVal = *reinterpret_cast<const volatile uint32_t*>(absAddr);

    // Check if this location is erased (no record)
    if (headerVal == 0xFFFFFFFF) {
        return FlashResult::ERR_INVALID_RECORD;
    }

    uint32_t payloadLen = headerVal;

    // Sanity check payload length
    if (offset + RECORD_HEADER_SIZE + payloadLen > REGION_SIZE) {
        return FlashResult::ERR_INVALID_RECORD;
    }

    // Check caller buffer size
    if (payloadLen > bufSize) {
        outLen = payloadLen; // Report actual size so caller knows
        return FlashResult::ERR_BUFFER_TOO_SMALL;
    }

    // Read the payload.
    // Cast away volatile — flash reads are stable after NVMC is idle.
    const void* src = reinterpret_cast<const void*>(absAddr + RECORD_HEADER_SIZE);
    memcpy(buf, src, payloadLen);
    outLen = payloadLen;

    return FlashResult::OK;
}

FlashResult erasePage(uint32_t pageIndex) {
    if (pageIndex >= PAGE_COUNT) {
        return FlashResult::ERR_OUT_OF_BOUNDS;
    }

    uint32_t pageAddr = REGION_START + (pageIndex * PAGE_SIZE);

    enableErase();
    nvmcReg(NVMC_ERASEPAGE) = pageAddr;
    waitReady();
    disableWrite();

    // Verify erase: check first and last words
    uint32_t firstWord = *reinterpret_cast<const volatile uint32_t*>(pageAddr);
    uint32_t lastWord = *reinterpret_cast<const volatile uint32_t*>(
        pageAddr + PAGE_SIZE - 4);
    if (firstWord != 0xFFFFFFFF || lastWord != 0xFFFFFFFF) {
        return FlashResult::ERR_ERASE_FAILED;
    }

    return FlashResult::OK;
}

uint32_t getWriteOffset() {
    return g_writeOffset;
}

uint32_t getUsedBytes() {
    return g_writeOffset;
}

} // namespace FlashStorage
