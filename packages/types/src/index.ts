// Auto-generated from Postgres schema via `supabase gen types`.
// Do not edit database.ts manually — see issue #43.
// Barrel exports added in issue #44.

export type { Database } from './database.js';

import type { Database } from './database.js';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

// ── Row type aliases (all 11 tables) ──

export type Profile = Tables['profiles']['Row'];
export type UserPreferences = Tables['user_preferences']['Row'];
export type LongTermGoal = Tables['long_term_goals']['Row'];
export type ProcessGoal = Tables['process_goals']['Row'];
export type Session = Tables['sessions']['Row'];
export type Break = Tables['breaks']['Row'];
export type Device = Tables['devices']['Row'];
export type DeviceSyncLog = Tables['device_sync_log']['Row'];
export type FriendRequest = Tables['friend_requests']['Row'];
export type Friendship = Tables['friendships']['Row'];
export type EncouragementTap = Tables['encouragement_taps']['Row'];

// ── Enum type aliases (all 9 enums) ──

export type GoalStatus = Enums['goal_status'];
export type RecurrenceType = Enums['recurrence_type'];
export type AbandonmentReason = Enums['abandonment_reason'];
export type FocusQuality = Enums['focus_quality'];
export type DistractionType = Enums['distraction_type'];
export type BreakType = Enums['break_type'];
export type BreakUsefulness = Enums['break_usefulness'];
export type RequestStatus = Enums['request_status'];
export type SyncDirection = Enums['sync_direction'];
