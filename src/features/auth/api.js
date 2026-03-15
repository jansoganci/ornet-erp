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
 * Change password from profile — requires current password re-authentication.
 * Used by authenticated users who know their current password.
 * (updatePassword above is for the email reset-link flow only.)
 */
export async function changePassword(currentPassword, newPassword) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) throw userError || new Error('USER_NOT_FOUND');

  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reAuthError) throw reAuthError;

  const { error } = await supabase.auth.updateUser({ password: newPassword });
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
 * Get current session (returns session object only)
 */
export async function getSession() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Raw getSession — returns the full Supabase response { data: { session }, error }.
 * Used by auth page components that need to handle the error branch themselves.
 */
export const getRawSession = () => supabase.auth.getSession();

/**
 * Thin wrapper for supabase.auth.onAuthStateChange.
 * Allows page components to subscribe to auth events without importing supabase directly.
 */
export const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback);

/**
 * Re-export isSupabaseConfigured so page components never import from lib/supabase directly.
 */
export { isSupabaseConfigured };
