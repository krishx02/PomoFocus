// Smoke test: verify that @pomofocus/types barrel exports resolve
// across the monorepo dependency chain. Safe to delete once real
// domain code imports these types.

import type { Database, Session, Profile, GoalStatus } from '@pomofocus/types';

/** Proves Row types resolve — a session has a started_at field. */
type _SessionStarted = Session['started_at'];

/** Proves enum types resolve — GoalStatus is a string union. */
type _StatusCheck = GoalStatus extends string ? true : false;

/** Proves the root Database type resolves. */
type _DbCheck = Database['public']['Tables'];

/** Proves Profile Row type resolves. */
type _ProfileName = Profile['display_name'];
