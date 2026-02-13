import { supabase } from '../../lib/supabase';

export async function fetchActiveNotifications(page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  const { data, error } = await supabase
    .from('v_active_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return data;
}

export async function fetchBadgeCount() {
  const { data, error } = await supabase.rpc('get_notification_badge_count');

  if (error) throw error;
  return data;
}

export async function resolveNotification(id) {
  const { error } = await supabase.rpc('fn_resolve_notification', {
    p_notification_id: id,
  });

  if (error) throw error;
}

export async function fetchReminders() {
  const { data, error } = await supabase
    .from('user_reminders')
    .select('*')
    .order('remind_date');

  if (error) throw error;
  return data;
}

export async function createReminder(payload) {
  const { title, content, remind_date, remind_time, created_by } = payload;

  const { data, error } = await supabase
    .from('user_reminders')
    .insert({
      title,
      content: content || null,
      remind_date,
      remind_time: remind_time || '09:00',
      created_by,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeReminder(id) {
  const { error } = await supabase
    .from('user_reminders')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchSubscriptionIdByPaymentId(paymentId) {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('subscription_id')
    .eq('id', paymentId)
    .single();

  if (error) return null;
  return data?.subscription_id;
}
