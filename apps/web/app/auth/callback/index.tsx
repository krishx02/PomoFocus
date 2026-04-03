import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthClient } from '../../providers';

type CallbackStatus = 'exchanging' | 'success' | 'error';

export default function AuthCallback(): React.JSX.Element {
  const router = useRouter();
  const authClient = useAuthClient();
  const [status, setStatus] = useState<CallbackStatus>('exchanging');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    async function exchangeCode(): Promise<void> {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code === null || code.length === 0) {
        const errorParam = params.get('error_description') ?? params.get('error') ?? 'No authorization code found in URL';
        setErrorMessage(errorParam);
        setStatus('error');
        return;
      }

      const { error } = await authClient.auth.exchangeCodeForSession(code);

      if (error) {
        setErrorMessage(error.message);
        setStatus('error');
        return;
      }

      setStatus('success');
      router.replace('/');
    }

    void exchangeCode();
  }, [authClient, router]);

  return (
    <View style={styles.container}>
      {status === 'exchanging' && (
        <Text style={styles.text}>Signing in...</Text>
      )}
      {status === 'error' && (
        <View>
          <Text style={styles.errorTitle}>Sign-in failed</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
