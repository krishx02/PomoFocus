import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import type { StyleProp, ViewStyle, TextStyle } from 'react-native';

// ── Variants ──

export const BUTTON_VARIANT = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  GHOST: 'ghost',
} as const;

export type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

// ── Props ──

export type ButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

// ── Variant styles (inline so tests can inspect them via element.style) ──

const baseContainer: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
};

const baseText: TextStyle = {
  fontSize: 16,
  fontWeight: '600',
};

const variantContainer: Record<ButtonVariant, ViewStyle> = {
  [BUTTON_VARIANT.PRIMARY]: { backgroundColor: '#1F2937' },
  [BUTTON_VARIANT.SECONDARY]: { backgroundColor: '#E5E7EB' },
  [BUTTON_VARIANT.GHOST]: { backgroundColor: 'transparent' },
};

const variantText: Record<ButtonVariant, TextStyle> = {
  [BUTTON_VARIANT.PRIMARY]: { color: '#FFFFFF' },
  [BUTTON_VARIANT.SECONDARY]: { color: '#1F2937' },
  [BUTTON_VARIANT.GHOST]: { color: '#1F2937' },
};

// ── Component ──

export function Button({
  label,
  onPress,
  variant = BUTTON_VARIANT.PRIMARY,
  disabled = false,
  accessibilityLabel,
  testID,
}: ButtonProps): ReactNode {
  const containerStyle: StyleProp<ViewStyle> = {
    ...baseContainer,
    ...variantContainer[variant],
    ...(disabled ? { opacity: 0.5 } : null),
  };

  const textStyle: StyleProp<TextStyle> = {
    ...baseText,
    ...variantText[variant],
  };

  return (
    <Pressable
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={containerStyle}
      testID={testID}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}
