import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

export type TimerDisplayProps = {
  /** Remaining time in seconds. Will be formatted as MM:SS. */
  timeRemaining: number;
  /** Human-readable status label to show (e.g., "Focusing", "Break"). */
  status: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Formats seconds as MM:SS (e.g., 1500 → "25:00", 299 → "04:59"). */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const containerStyle: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
};

export function TimerDisplay({
  timeRemaining,
  status,
  style,
  testID,
}: TimerDisplayProps): React.JSX.Element {
  return (
    <View style={[containerStyle, style]} testID={testID ?? 'timer-display'}>
      <Text testID={testID !== undefined ? `${testID}-status` : undefined}>{status}</Text>
      <Text testID={testID !== undefined ? `${testID}-countdown` : undefined}>{formatTime(timeRemaining)}</Text>
    </View>
  );
}
