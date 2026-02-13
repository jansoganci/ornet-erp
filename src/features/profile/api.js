import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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
