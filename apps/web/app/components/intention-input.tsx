import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTimerStore } from '@pomofocus/state';
import { TIMER_STATUS } from '@pomofocus/core';

const MAX_INTENTION_LENGTH = 200;

type IntentionInputProps = {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
};

export function IntentionInput({
  value,
  onChangeText,
}: IntentionInputProps): React.JSX.Element | null {
  const status = useTimerStore((s) => s.state.status);

  if (status !== TIMER_STATUS.IDLE) {
    return null;
  }

  return (
    <View testID="intention-input" style={styles.container}>
      <TextInput
        accessibilityLabel="Session intention"
        placeholder="What will you focus on? (optional)"
        value={value}
        onChangeText={onChangeText}
        maxLength={MAX_INTENTION_LENGTH}
        style={styles.input}
      />
      <Text testID="intention-char-count" style={styles.counter}>
        {`${String(value.length)}/${String(MAX_INTENTION_LENGTH)}`}
      </Text>
    </View>
  );
}

export { MAX_INTENTION_LENGTH };
export type { IntentionInputProps };

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 480,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  counter: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
});
