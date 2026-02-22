import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from "@sentry/react";
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as authApi from '../features/auth/api';

/**
 * Authentication hook providing user state and auth methods.
 *
 * @returns {Object} Auth state and methods
 * @property {Object|null} user - Current user object or null
 * @property {Object|null} session - Current session object or null
 * @property {boolean} loading - True while checking auth state
 * @property {Error|null} error - Last auth error or null
 * @property {boolean} isAuthenticated - True if user is logged in
 * @property {boolean} isEmailVerified - True if user's email is verified
 * @property {Function} signIn - Sign in with email/password
 * @property {Function} signUp - Sign up with email/password
 * @property {Function} signOut - Sign out current user
 * @property {Function} resetPassword - Send password reset email
 * @property {Function} updatePassword - Update user password
 * @property {Function} clearError - Clear current error
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(!!isSupabaseConfigured && !!supabase);
  const [error, setError] = useState(null);

  // Initialize session and listen for auth changes — setState in effect is intentional
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        Sentry.setUser({
          id: currentUser.id,
          email: currentUser.email,
          username: currentUser.user_metadata?.full_name,
        });
      }

      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          Sentry.setUser({
            id: currentUser.id,
            email: currentUser.email,
            username: currentUser.user_metadata?.full_name,
          });
        } else if (event === 'SIGNED_OUT') {
          Sentry.setUser(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email and password
  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await authApi.signIn(email, password);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email, password, metadata = {}) => {
    setError(null);
    try {
      const data = await authApi.signUp(email, password, metadata);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Send password reset email
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      await authApi.resetPassword(email);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Update password (after reset)
  const updatePassword = useCallback(async (newPassword) => {
    setError(null);
    try {
      await authApi.updatePassword(newPassword);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setError(null);
    try {
      await authApi.signOut();
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Derived state
  const isAuthenticated = !!user;
  const isEmailVerified = user?.email_confirmed_at != null;

  return useMemo(
    () => ({
      user,
      session,
      loading,
      error,
      isAuthenticated,
      isEmailVerified,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      clearError,
    }),
    [
      user,
      session,
      loading,
      error,
      isAuthenticated,
      isEmailVerified,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      clearError,
    ]
  );
}
