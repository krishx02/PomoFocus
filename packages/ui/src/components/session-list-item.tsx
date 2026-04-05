import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { FocusQuality, Session } from '@pomofocus/types';

export type SessionListItemProps = {
  readonly session: Session;
  readonly goalName: string;
};

function focusQualityLabel(quality: FocusQuality): string {
  switch (quality) {
    case 'locked_in':
      return 'Locked in';
    case 'decent':
      return 'Decent';
    case 'struggled':
      return 'Struggled';
  }
}

/**
 * Format a session duration in milliseconds as "Xh Ym" or "Ym" or "Zs".
 * Returns "--" when the duration is not available (e.g. a session that
 * has started but not ended yet).
 */
function formatDuration(startedAt: string, endedAt: string | null): string {
  if (endedAt === null) {
    return '--';
  }

  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return '--';
  }

  const elapsedMs = Math.max(0, endMs - startMs);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m`;
  }
  if (minutes > 0) {
    return `${String(minutes)}m`;
  }
  return `${String(seconds)}s`;
}

/**
 * Format an ISO timestamp as a locale date (YYYY-MM-DD fallback if invalid).
 * Uses en-CA to get a stable, sortable date format regardless of host locale,
 * so this component renders identically in tests and in production.
 */
function formatDate(isoTimestamp: string): string {
  const ms = Date.parse(isoTimestamp);
  if (Number.isNaN(ms)) {
    return isoTimestamp;
  }
  return new Date(ms).toLocaleDateString('en-CA');
}

function formatFocusQuality(quality: FocusQuality | null): string {
  if (quality === null) {
    return '--';
  }
  return focusQualityLabel(quality);
}

/**
 * A single row in a session history list. Renders date, duration, focus
 * quality, and goal name for one completed (or abandoned) session.
 *
 * This component is pure presentation — the session row and the goal name
 * are supplied via props. Sessions only store `process_goal_id`; callers
 * are responsible for resolving the human-readable goal name.
 */
export function SessionListItem({
  session,
  goalName,
}: SessionListItemProps): ReactNode {
  const dateText = formatDate(session.started_at);
  const durationText = formatDuration(session.started_at, session.ended_at);
  const focusQualityText = formatFocusQuality(session.focus_quality);

  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={`Session on ${dateText} for ${goalName}, ${durationText}, ${focusQualityText}`}
      testID={`session-list-item-${session.id}`}
    >
      <Text>{dateText}</Text>
      <Text>{durationText}</Text>
      <Text testID={`session-focus-quality-${session.id}`}>
        {focusQualityText}
      </Text>
      <Text>{goalName}</Text>
    </View>
  );
}
