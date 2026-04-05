import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createApiClient } from '@pomofocus/data-access';
import { useTimerStore } from '@pomofocus/state';
import { TIMER_STATUS } from '@pomofocus/core';
import { TimerDisplay } from './components/timer-display';
import { TimerControls } from './components/timer-controls';
import { SessionList } from './components/session-list';
import { PreSessionCountdown } from './components/pre-session-countdown';

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

type PreSessionPhase = 'idle' | 'countdown';

// Placeholder goal id used until the real goal selector (#385) lands.
const PLACEHOLDER_GOAL_ID = 'placeholder-goal';

export default function HomeScreen(): React.JSX.Element {
  const client = useMemo(() => createApiClient(API_BASE_URL), []);
  const status = useTimerStore((s) => s.state.status);
  const start = useTimerStore((s) => s.start);

  const [phase, setPhase] = useState<PreSessionPhase>('idle');
  // Goal id and intention text are tracked locally during the pre-session flow.
  // They will be wired to the goal selector (#385) and intention input (#386)
  // once those components land, and passed to the session on save (Stream C).
  const [pendingGoalId, setPendingGoalId] = useState<string>(PLACEHOLDER_GOAL_ID);
  const [pendingIntention, setPendingIntention] = useState<string | undefined>(undefined);

  const isIdle = status === TIMER_STATUS.IDLE;

  function handleBeginSession(): void {
    setPendingGoalId(PLACEHOLDER_GOAL_ID);
    setPendingIntention(undefined);
    setPhase('countdown');
  }

  function handleCountdownComplete(): void {
    start();
    setPhase('idle');
  }

  function handleCountdownCancel(): void {
    setPhase('idle');
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerSection}>
        <Text style={styles.title}>PomoFocus</Text>
        {isIdle && phase === 'countdown' ? (
          <PreSessionCountdown
            goalId={pendingGoalId}
            intentionText={pendingIntention}
            onComplete={handleCountdownComplete}
            onCancel={handleCountdownCancel}
          />
        ) : (
          <>
            <TimerDisplay />
            {isIdle && phase === 'idle' ? (
              <Pressable
                role="button"
                accessibilityLabel="Begin Session"
                onPress={handleBeginSession}
              >
                <Text>Begin Session</Text>
              </Pressable>
            ) : (
              <TimerControls />
            )}
          </>
        )}
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
