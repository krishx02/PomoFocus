import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createApiClient } from '@pomofocus/data-access';
import { TimerDisplay } from './components/timer-display';
import { TimerControls } from './components/timer-controls';
import { SessionList } from './components/session-list';

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export default function HomeScreen(): React.JSX.Element {
  const client = useMemo(() => createApiClient(API_BASE_URL), []);

  return (
    <View style={styles.container}>
      <View style={styles.timerSection}>
        <Text style={styles.title}>PomoFocus</Text>
        <TimerDisplay />
        <TimerControls />
      </View>
      <View style={styles.sessionsSection}>
        <Text style={styles.sectionHeading}>Sessions</Text>
        <SessionList client={client} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  timerSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sessionsSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
});
