import type { SupabaseClient, AuthError, Session } from '@supabase/supabase-js';

type SignUpResult = {
  readonly session: Session | null;
  readonly userId: string | null;
  readonly error: AuthError | null;
};

type SignInResult = {
  readonly session: Session | null;
  readonly userId: string | null;
  readonly error: AuthError | null;
};

async function signUpWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
  displayName: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error !== null) {
    return { session: null, userId: null, error };
  }

  return {
    session: data.session,
    userId: data.user?.id ?? null,
    error: null,
  };
}

async function signInWithEmail(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<SignInResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error !== null) {
    return { session: null, userId: null, error };
  }

  return {
    session: data.session,
    userId: data.user.id,
    error: null,
  };
}

export { signUpWithEmail, signInWithEmail };
export type { SignUpResult, SignInResult };
