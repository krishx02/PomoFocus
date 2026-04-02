// Protobuf encode/decode round-trip tests for Nanopb-generated messages.
// Verifies that all message types survive a serialize/deserialize cycle
// and that .options sizing limits are respected.
//
// Issue: #228 (7A.5)
// ADR: ADR-015 (Nanopb API: pb_encode/pb_decode with field descriptors)

#include <unity.h>
#include <pb_encode.h>
#include <pb_decode.h>
#include <string.h>
#include "pomofocus.pb.h"

// Helper: a fake 16-byte UUID for testing
static const uint8_t FAKE_UUID[16] = {
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10
};

static const uint8_t FAKE_UUID_2[16] = {
    0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8,
    0xA9, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF, 0xB0
};

static const uint8_t FAKE_UUID_3[16] = {
    0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8,
    0xC9, 0xCA, 0xCB, 0xCC, 0xCD, 0xCE, 0xCF, 0xD0
};

// --- TimerState round-trip ---

void test_timer_state_round_trip(void) {
    // Encode
    pomofocus_ble_TimerState src = pomofocus_ble_TimerState_init_zero;
    src.phase = pomofocus_ble_TimerPhase_TIMER_PHASE_FOCUSING;
    src.remaining_seconds = 1500;
    src.elapsed_seconds = 300;
    src.goal_id.size = 16;
    memcpy(src.goal_id.bytes, FAKE_UUID, 16);
    src.session_count = 3;

    uint8_t buffer[pomofocus_ble_TimerState_size];
    pb_ostream_t ostream = pb_ostream_from_buffer(buffer, sizeof(buffer));
    TEST_ASSERT_TRUE_MESSAGE(
        pb_encode(&ostream, pomofocus_ble_TimerState_fields, &src),
        "TimerState encode failed"
    );
    TEST_ASSERT_GREATER_THAN(0, ostream.bytes_written);

    // Decode
    pomofocus_ble_TimerState dst = pomofocus_ble_TimerState_init_zero;
    pb_istream_t istream = pb_istream_from_buffer(buffer, ostream.bytes_written);
    TEST_ASSERT_TRUE_MESSAGE(
        pb_decode(&istream, pomofocus_ble_TimerState_fields, &dst),
        "TimerState decode failed"
    );

    // Verify all fields
    TEST_ASSERT_EQUAL(pomofocus_ble_TimerPhase_TIMER_PHASE_FOCUSING, dst.phase);
    TEST_ASSERT_EQUAL_UINT32(1500, dst.remaining_seconds);
    TEST_ASSERT_EQUAL_UINT32(300, dst.elapsed_seconds);
    TEST_ASSERT_EQUAL_UINT32(16, dst.goal_id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID, dst.goal_id.bytes, 16);
    TEST_ASSERT_EQUAL_UINT32(3, dst.session_count);
}

// --- TimerCommand round-trip ---

void test_timer_command_start_with_goal(void) {
    // Encode START action with a goal_id and focus_duration
    pomofocus_ble_TimerCommand src = pomofocus_ble_TimerCommand_init_zero;
    src.action = pomofocus_ble_TimerAction_TIMER_ACTION_START;
    src.goal_id.size = 16;
    memcpy(src.goal_id.bytes, FAKE_UUID, 16);
    src.focus_duration = 1500;

    uint8_t buffer[pomofocus_ble_TimerCommand_size];
    pb_ostream_t ostream = pb_ostream_from_buffer(buffer, sizeof(buffer));
    TEST_ASSERT_TRUE_MESSAGE(
        pb_encode(&ostream, pomofocus_ble_TimerCommand_fields, &src),
        "TimerCommand encode failed"
    );

    // Decode
    pomofocus_ble_TimerCommand dst = pomofocus_ble_TimerCommand_init_zero;
    pb_istream_t istream = pb_istream_from_buffer(buffer, ostream.bytes_written);
    TEST_ASSERT_TRUE_MESSAGE(
        pb_decode(&istream, pomofocus_ble_TimerCommand_fields, &dst),
        "TimerCommand decode failed"
    );

    // Verify
    TEST_ASSERT_EQUAL(pomofocus_ble_TimerAction_TIMER_ACTION_START, dst.action);
    TEST_ASSERT_EQUAL_UINT32(16, dst.goal_id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID, dst.goal_id.bytes, 16);
    TEST_ASSERT_EQUAL_UINT32(1500, dst.focus_duration);
}

// --- SessionRecord round-trip (all 12 fields) ---

void test_session_record_round_trip(void) {
    pomofocus_ble_SessionRecord src = pomofocus_ble_SessionRecord_init_zero;

    // Field 1: id (bytes)
    src.id.size = 16;
    memcpy(src.id.bytes, FAKE_UUID, 16);

    // Field 2: goal_id (bytes)
    src.goal_id.size = 16;
    memcpy(src.goal_id.bytes, FAKE_UUID_2, 16);

    // Field 3: started_at (int64)
    src.started_at = 1711929600LL; // 2024-04-01 00:00:00 UTC

    // Field 4: ended_at (int64)
    src.ended_at = 1711931100LL; // 25 min later

    // Field 5: planned_duration (uint32)
    src.planned_duration = 1500;

    // Field 6: actual_duration (uint32)
    src.actual_duration = 1500;

    // Field 7: type (enum)
    src.type = pomofocus_ble_SessionType_SESSION_TYPE_FOCUS;

    // Field 8: outcome (enum)
    src.outcome = pomofocus_ble_SessionOutcome_SESSION_OUTCOME_COMPLETED;

    // Field 9: focus_quality (uint32)
    src.focus_quality = 4;

    // Field 10: intention (string)
    strncpy(src.intention, "Write proto tests", sizeof(src.intention) - 1);

    // Field 11: reflection (string)
    strncpy(src.reflection, "Good focus, no distractions", sizeof(src.reflection) - 1);

    // Field 12: distraction_note (string)
    strncpy(src.distraction_note, "Phone buzzed once", sizeof(src.distraction_note) - 1);

    // Encode
    uint8_t buffer[pomofocus_ble_SessionRecord_size];
    pb_ostream_t ostream = pb_ostream_from_buffer(buffer, sizeof(buffer));
    TEST_ASSERT_TRUE_MESSAGE(
        pb_encode(&ostream, pomofocus_ble_SessionRecord_fields, &src),
        "SessionRecord encode failed"
    );

    // Decode
    pomofocus_ble_SessionRecord dst = pomofocus_ble_SessionRecord_init_zero;
    pb_istream_t istream = pb_istream_from_buffer(buffer, ostream.bytes_written);
    TEST_ASSERT_TRUE_MESSAGE(
        pb_decode(&istream, pomofocus_ble_SessionRecord_fields, &dst),
        "SessionRecord decode failed"
    );

    // Verify all 12 fields
    TEST_ASSERT_EQUAL_UINT32(16, dst.id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID, dst.id.bytes, 16);

    TEST_ASSERT_EQUAL_UINT32(16, dst.goal_id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID_2, dst.goal_id.bytes, 16);

    TEST_ASSERT_EQUAL_INT64(1711929600LL, dst.started_at);
    TEST_ASSERT_EQUAL_INT64(1711931100LL, dst.ended_at);

    TEST_ASSERT_EQUAL_UINT32(1500, dst.planned_duration);
    TEST_ASSERT_EQUAL_UINT32(1500, dst.actual_duration);

    TEST_ASSERT_EQUAL(pomofocus_ble_SessionType_SESSION_TYPE_FOCUS, dst.type);
    TEST_ASSERT_EQUAL(pomofocus_ble_SessionOutcome_SESSION_OUTCOME_COMPLETED, dst.outcome);

    TEST_ASSERT_EQUAL_UINT32(4, dst.focus_quality);

    TEST_ASSERT_EQUAL_STRING("Write proto tests", dst.intention);
    TEST_ASSERT_EQUAL_STRING("Good focus, no distractions", dst.reflection);
    TEST_ASSERT_EQUAL_STRING("Phone buzzed once", dst.distraction_note);
}

// --- GoalList round-trip (3 goals in repeated field) ---

void test_goal_list_round_trip(void) {
    pomofocus_ble_GoalList src = pomofocus_ble_GoalList_init_zero;
    src.goals_count = 3;

    // Goal 0
    src.goals[0].id.size = 16;
    memcpy(src.goals[0].id.bytes, FAKE_UUID, 16);
    strncpy(src.goals[0].title, "Ship MVP", sizeof(src.goals[0].title) - 1);
    src.goals[0].type = pomofocus_ble_GoalType_GOAL_TYPE_LONG_TERM;
    src.goals[0].target_sessions = 100;
    src.goals[0].completed_today = 2;

    // Goal 1
    src.goals[1].id.size = 16;
    memcpy(src.goals[1].id.bytes, FAKE_UUID_2, 16);
    strncpy(src.goals[1].title, "Daily coding", sizeof(src.goals[1].title) - 1);
    src.goals[1].type = pomofocus_ble_GoalType_GOAL_TYPE_PROCESS;
    src.goals[1].target_sessions = 4;
    src.goals[1].completed_today = 1;

    // Goal 2
    src.goals[2].id.size = 16;
    memcpy(src.goals[2].id.bytes, FAKE_UUID_3, 16);
    strncpy(src.goals[2].title, "Read research papers", sizeof(src.goals[2].title) - 1);
    src.goals[2].type = pomofocus_ble_GoalType_GOAL_TYPE_PROCESS;
    src.goals[2].target_sessions = 2;
    src.goals[2].completed_today = 0;

    // Encode
    uint8_t buffer[pomofocus_ble_GoalList_size];
    pb_ostream_t ostream = pb_ostream_from_buffer(buffer, sizeof(buffer));
    TEST_ASSERT_TRUE_MESSAGE(
        pb_encode(&ostream, pomofocus_ble_GoalList_fields, &src),
        "GoalList encode failed"
    );

    // Decode
    pomofocus_ble_GoalList dst = pomofocus_ble_GoalList_init_zero;
    pb_istream_t istream = pb_istream_from_buffer(buffer, ostream.bytes_written);
    TEST_ASSERT_TRUE_MESSAGE(
        pb_decode(&istream, pomofocus_ble_GoalList_fields, &dst),
        "GoalList decode failed"
    );

    // Verify repeated field count
    TEST_ASSERT_EQUAL_UINT32(3, dst.goals_count);

    // Verify Goal 0
    TEST_ASSERT_EQUAL_UINT32(16, dst.goals[0].id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID, dst.goals[0].id.bytes, 16);
    TEST_ASSERT_EQUAL_STRING("Ship MVP", dst.goals[0].title);
    TEST_ASSERT_EQUAL(pomofocus_ble_GoalType_GOAL_TYPE_LONG_TERM, dst.goals[0].type);
    TEST_ASSERT_EQUAL_UINT32(100, dst.goals[0].target_sessions);
    TEST_ASSERT_EQUAL_UINT32(2, dst.goals[0].completed_today);

    // Verify Goal 1
    TEST_ASSERT_EQUAL_UINT32(16, dst.goals[1].id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID_2, dst.goals[1].id.bytes, 16);
    TEST_ASSERT_EQUAL_STRING("Daily coding", dst.goals[1].title);
    TEST_ASSERT_EQUAL(pomofocus_ble_GoalType_GOAL_TYPE_PROCESS, dst.goals[1].type);
    TEST_ASSERT_EQUAL_UINT32(4, dst.goals[1].target_sessions);
    TEST_ASSERT_EQUAL_UINT32(1, dst.goals[1].completed_today);

    // Verify Goal 2
    TEST_ASSERT_EQUAL_UINT32(16, dst.goals[2].id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID_3, dst.goals[2].id.bytes, 16);
    TEST_ASSERT_EQUAL_STRING("Read research papers", dst.goals[2].title);
    TEST_ASSERT_EQUAL(pomofocus_ble_GoalType_GOAL_TYPE_PROCESS, dst.goals[2].type);
    TEST_ASSERT_EQUAL_UINT32(2, dst.goals[2].target_sessions);
    TEST_ASSERT_EQUAL_UINT32(0, dst.goals[2].completed_today);
}

// --- SyncStatus round-trip ---

void test_sync_status_round_trip(void) {
    pomofocus_ble_SyncStatus src = pomofocus_ble_SyncStatus_init_zero;
    src.pending_sessions = 5;
    src.total_stored = 42;
    src.last_synced_id.size = 16;
    memcpy(src.last_synced_id.bytes, FAKE_UUID, 16);
    src.state = pomofocus_ble_SyncState_SYNC_STATE_READY;

    // Encode
    uint8_t buffer[pomofocus_ble_SyncStatus_size];
    pb_ostream_t ostream = pb_ostream_from_buffer(buffer, sizeof(buffer));
    TEST_ASSERT_TRUE_MESSAGE(
        pb_encode(&ostream, pomofocus_ble_SyncStatus_fields, &src),
        "SyncStatus encode failed"
    );

    // Decode
    pomofocus_ble_SyncStatus dst = pomofocus_ble_SyncStatus_init_zero;
    pb_istream_t istream = pb_istream_from_buffer(buffer, ostream.bytes_written);
    TEST_ASSERT_TRUE_MESSAGE(
        pb_decode(&istream, pomofocus_ble_SyncStatus_fields, &dst),
        "SyncStatus decode failed"
    );

    // Verify
    TEST_ASSERT_EQUAL_UINT32(5, dst.pending_sessions);
    TEST_ASSERT_EQUAL_UINT32(42, dst.total_stored);
    TEST_ASSERT_EQUAL_UINT32(16, dst.last_synced_id.size);
    TEST_ASSERT_EQUAL_MEMORY(FAKE_UUID, dst.last_synced_id.bytes, 16);
    TEST_ASSERT_EQUAL(pomofocus_ble_SyncState_SYNC_STATE_READY, dst.state);
}

// --- Buffer overflow: encoding into a too-small buffer ---

void test_encode_fails_on_buffer_overflow(void) {
    // SessionRecord is the largest single message (~989 bytes max).
    // Try encoding it into a 4-byte buffer, which should fail.
    pomofocus_ble_SessionRecord src = pomofocus_ble_SessionRecord_init_zero;
    src.id.size = 16;
    memcpy(src.id.bytes, FAKE_UUID, 16);
    src.goal_id.size = 16;
    memcpy(src.goal_id.bytes, FAKE_UUID_2, 16);
    src.started_at = 1711929600LL;
    src.ended_at = 1711931100LL;
    src.planned_duration = 1500;
    src.actual_duration = 1500;
    src.type = pomofocus_ble_SessionType_SESSION_TYPE_FOCUS;
    src.outcome = pomofocus_ble_SessionOutcome_SESSION_OUTCOME_COMPLETED;
    src.focus_quality = 4;
    strncpy(src.intention, "Test overflow", sizeof(src.intention) - 1);
    strncpy(src.reflection, "Should not fit", sizeof(src.reflection) - 1);
    strncpy(src.distraction_note, "Nope", sizeof(src.distraction_note) - 1);

    // Buffer far too small to hold the encoded message
    uint8_t tiny_buffer[4];
    pb_ostream_t ostream = pb_ostream_from_buffer(tiny_buffer, sizeof(tiny_buffer));
    bool result = pb_encode(&ostream, pomofocus_ble_SessionRecord_fields, &src);

    TEST_ASSERT_FALSE_MESSAGE(result, "Encode should fail when buffer is too small");
}

// --- Entry point ---

void setUp(void) {}
void tearDown(void) {}

int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_timer_state_round_trip);
    RUN_TEST(test_timer_command_start_with_goal);
    RUN_TEST(test_session_record_round_trip);
    RUN_TEST(test_goal_list_round_trip);
    RUN_TEST(test_sync_status_round_trip);
    RUN_TEST(test_encode_fails_on_buffer_overflow);

    return UNITY_END();
}
