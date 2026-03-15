import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Fetch the currently authenticated user's profile row.
 * Used by useCurrentProfile() in subscriptions/hooks.js.
 */
export async function getCurrentUserProfile() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update current user's profile (full_name, phone).
 * RLS: users can only update their own profile.
 */
export async function updateProfile(id, { full_name, phone }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: full_name || null,
      phone: phone || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
