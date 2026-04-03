/**
 * Type declarations for Expo environment variables.
 * Metro replaces process.env.EXPO_PUBLIC_* at build time.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  };
};
