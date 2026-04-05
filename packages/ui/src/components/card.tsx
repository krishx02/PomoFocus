import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

export type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const cardStyle: ViewStyle = {
  padding: 16,
  borderRadius: 12,
  backgroundColor: '#ffffff',
  borderWidth: 1,
  borderColor: '#e5e7eb',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};

export function Card({ children, style, testID }: CardProps): React.JSX.Element {
  return (
    <View style={[cardStyle, style]} testID={testID ?? 'card'}>
      {children}
    </View>
  );
}
