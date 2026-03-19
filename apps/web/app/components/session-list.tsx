import { StyleSheet, Text, View } from 'react-native';
import { useSessions } from '@pomofocus/state';

type SessionListProps = {
  readonly client: Parameters<typeof useSessions>[0];
};

function formatDuration(startedAt: string, endedAt: string): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const minutes = Math.round((end - start) / 60_000);

  return `${String(minutes)}m`;
}

function formatStartTime(startedAt: string): string {
  const date = new Date(startedAt);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SessionList({ client }: SessionListProps): React.JSX.Element {
  const { data, isLoading, isError } = useSessions(client);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading sessions...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text>Failed to load sessions</Text>
      </View>
    );
  }

  const sessions = data?.data;

  if (sessions === undefined || sessions.length === 0) {
    return (
      <View style={styles.container}>
        <Text>No sessions yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {sessions.map((session) => (
        <View key={session.id} style={styles.sessionRow}>
          <Text>
            {session.ended_at !== null
              ? formatDuration(session.started_at, session.ended_at)
              : 'In progress'}
          </Text>
          <Text>{formatStartTime(session.started_at)}</Text>
          {session.focus_quality !== null && (
            <Text>{session.focus_quality}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
});

export { SessionList };
export type { SessionListProps };
