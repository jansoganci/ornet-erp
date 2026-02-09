import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign up with email and password
 */
export async function signUp(email, password, metadata = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // { full_name: '...' }
      emailRedirectTo: `${window.location.origin}/auth/verify-email`,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 */
export async function resetPassword(email) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/update-password`,
  });

  if (error) throw error;
}

/**
 * Update user's password (after reset link clicked)
 */
export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

/**
 * Sign out
 */
export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/verify-email`,
    },
  });

  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
