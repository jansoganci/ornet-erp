import { supabase } from '../../lib/supabase';

/**
 * Fetch the currently active static IP for a SIM card (cancelled_at IS NULL)
 */
export async function fetchActiveStaticIp(simCardId) {
  const { data, error } = await supabase
    .from('sim_static_ips')
    .select('*')
    .eq('sim_card_id', simCardId)
    .is('cancelled_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetch full static IP history for a SIM card (newest first)
 */
export async function fetchStaticIpHistory(simCardId) {
  const { data, error } = await supabase
    .from('sim_static_ips')
    .select('*')
    .eq('sim_card_id', simCardId)
    .order('activated_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Assign a new static IP to a SIM card.
 * Cancels any existing active IP first, then inserts the new record.
 */
export async function assignStaticIp({ sim_card_id, ip_address, notes }) {
  const now = new Date().toISOString();

  // Cancel existing active IP (if any)
  const { error: cancelErr } = await supabase
    .from('sim_static_ips')
    .update({ cancelled_at: now })
    .eq('sim_card_id', sim_card_id)
    .is('cancelled_at', null);

  if (cancelErr) throw cancelErr;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sim_static_ips')
    .insert({
      sim_card_id,
      ip_address: ip_address.trim(),
      notes: notes?.trim() || null,
      activated_at: now,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cancel a static IP record by ID (sets cancelled_at to now)
 */
export async function cancelStaticIp(id) {
  const { data, error } = await supabase
    .from('sim_static_ips')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
