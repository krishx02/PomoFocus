import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createApiClient } from '@pomofocus/data-access';
import { useTimerStore } from '@pomofocus/state';
import { TIMER_STATUS } from '@pomofocus/core';
import type { ProcessGoal } from '@pomofocus/core';
import { TimerDisplay } from './components/timer-display';
import { TimerControls } from './components/timer-controls';
import { SessionList } from './components/session-list';
import { GoalSelector } from './components/goal-selector';

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

// Mocked goal data until Stream C delivers the goals state hooks.
// See issue #385: "If not yet available, mock the data for now and wire later."
const MOCK_GOALS: readonly ProcessGoal[] = [
  {
    id: 'mock-goal-1',
    longTermGoalId: 'mock-lt-1',
    userId: 'mock-user',
    title: 'Deep work',
    targetSessionsPerDay: 4,
    recurrence: 'daily',
    status: 'active',
    sortOrder: 0,
    createdAt: '2026-04-05T00:00:00Z',
    updatedAt: '2026-04-05T00:00:00Z',
  },
  {
    id: 'mock-goal-2',
    longTermGoalId: 'mock-lt-1',
    userId: 'mock-user',
    title: 'Writing practice',
    targetSessionsPerDay: 2,
    recurrence: 'daily',
    status: 'active',
    sortOrder: 1,
    createdAt: '2026-04-05T00:00:00Z',
    updatedAt: '2026-04-05T00:00:00Z',
  },
];

export default function HomeScreen(): React.JSX.Element {
  const client = useMemo(() => createApiClient(API_BASE_URL), []);
  const timerStatus = useTimerStore((s) => s.state.status);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const isIdle = timerStatus === TIMER_STATUS.IDLE;

  return (
    <View style={styles.container}>
      <View style={styles.timerSection}>
        <Text style={styles.title}>PomoFocus</Text>
        <TimerDisplay />
        {isIdle && (
          <GoalSelector
            goals={MOCK_GOALS}
            selectedGoalId={selectedGoalId}
            onSelect={setSelectedGoalId}
          />
        )}
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
