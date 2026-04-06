import type { ReactNode } from 'react';
import { Text, TextInput as RNTextInput, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

// ── Props ──

export type TextInputProps = {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly maxLength?: number;
  readonly showCharacterCount?: boolean;
  readonly multiline?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

// ── Styles (inline so tests can inspect via element.style) ──

const containerStyle: ViewStyle = {
  width: '100%',
};

const labelStyle: TextStyle = {
  fontSize: 14,
  fontWeight: '500',
  color: '#374151',
  marginBottom: 4,
};

const baseInputStyle: TextStyle = {
  borderWidth: 1,
  borderColor: '#D1D5DB',
  borderRadius: 6,
  paddingHorizontal: 12,
  paddingVertical: 8,
  fontSize: 16,
  color: '#111827',
  backgroundColor: '#FFFFFF',
};

const multilineInputStyle: TextStyle = {
  minHeight: 80,
  textAlignVertical: 'top',
};

const errorBorderStyle: TextStyle = {
  borderColor: '#DC2626',
};

const counterStyle: TextStyle = {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 4,
  alignSelf: 'flex-end',
};

const errorTextStyle: TextStyle = {
  fontSize: 12,
  color: '#DC2626',
  marginTop: 4,
};

// ── Component ──

export function TextInput({
  value,
  onChangeText,
  label,
  placeholder,
  error,
  maxLength,
  showCharacterCount = false,
  multiline = false,
  accessibilityLabel,
  testID,
}: TextInputProps): ReactNode {
  const hasError = error !== undefined && error.length > 0;
  const shouldShowCounter = showCharacterCount && maxLength !== undefined;

  const inputStyle: StyleProp<TextStyle> = {
    ...baseInputStyle,
    ...(multiline ? multilineInputStyle : null),
    ...(hasError ? errorBorderStyle : null),
  };

  return (
    <View style={containerStyle} testID={testID}>
      {label !== undefined ? <Text style={labelStyle}>{label}</Text> : null}
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
        multiline={multiline}
        accessibilityLabel={accessibilityLabel ?? label}
        style={inputStyle}
      />
      {shouldShowCounter ? (
        <Text style={counterStyle}>
          {value.length}/{maxLength}
        </Text>
      ) : null}
      {hasError ? <Text style={errorTextStyle}>{error}</Text> : null}
    </View>
  );
}
