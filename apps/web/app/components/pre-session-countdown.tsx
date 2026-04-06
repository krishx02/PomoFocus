import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const DEFAULT_COUNTDOWN_SECONDS = 30;

const PROGRESS_TRACK_WIDTH = 240;

type PreSessionCountdownProps = {
  goalId: string;
  intentionText?: string | undefined;
  onComplete: (goalId: string, intentionText?: string) => void;
  onCancel: () => void;
  durationSeconds?: number | undefined;
};

export function PreSessionCountdown(
  props: PreSessionCountdownProps,
): React.JSX.Element {
  const {
    goalId,
    intentionText,
    onComplete,
    onCancel,
    durationSeconds = DEFAULT_COUNTDOWN_SECONDS,
  } = props;

  const [remaining, setRemaining] = useState<number>(durationSeconds);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (remaining <= 0) {
      onCompleteRef.current(goalId, intentionText);
      return;
    }

    const handle = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return (): void => {
      clearInterval(handle);
    };
  }, [remaining, goalId, intentionText]);

  const progressPercent: number = Math.max(
    0,
    Math.min(100, Math.round(((durationSeconds - remaining) / durationSeconds) * 100)),
  );
  const progressFillWidth: number = Math.round((PROGRESS_TRACK_WIDTH * progressPercent) / 100);

  return (
    <View testID="pre-session-countdown" style={styles.container}>
      <Text testID="pre-session-countdown-label" style={styles.label}>
        Starting in
      </Text>
      <Text testID="pre-session-countdown-value" style={styles.value}>
        {remaining}
      </Text>
      <View
        testID="pre-session-countdown-progress"
        accessibilityRole="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={styles.progressTrack}
      >
        <View
          testID="pre-session-countdown-progress-fill"
          style={[styles.progressFill, { width: progressFillWidth }]}
        />
      </View>
      <Pressable
        role="button"
        accessibilityLabel="Cancel"
        onPress={onCancel}
        style={styles.cancelButton}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  value: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  progressTrack: {
    width: PROGRESS_TRACK_WIDTH,
    height: 6,
    backgroundColor: '#e5e5e5',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 16,
  },
});
