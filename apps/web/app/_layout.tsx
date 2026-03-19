import { Slot } from 'expo-router';
import { AppProviders } from './providers';

export default function RootLayout(): React.JSX.Element {
  return (
    <AppProviders>
      <Slot />
    </AppProviders>
  );
}
