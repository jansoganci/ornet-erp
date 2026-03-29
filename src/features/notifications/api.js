import { supabase } from '../../lib/supabase';

export async function fetchActiveNotifications(page = 1, pageSize = 20, filters = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('v_active_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function fetchResolvedNotifications(page = 1, pageSize = 20, filters = {}) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from('notifications')
    .select('*')
    .not('resolved_at', 'is', null)
    .order('resolved_at', { ascending: false })
    .range(from, to);

  if (filters.dateFrom) {
    query = query.gte('resolved_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('resolved_at', filters.dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row) => ({
    notification_id: row.id,
    notification_type: row.type,
    title: row.title,
    body: row.body,
    entity_type: row.related_entity_type,
    entity_id: row.related_entity_id,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    notification_source: 'stored',
  }));
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

export async function markAllStoredAsResolved() {
  // No target_role filter is intentional: this is a system-wide "clear all" action.
  // The RLS policy restricts execution to admin/accountant roles only. In this
  // single-team deployment there is at most one admin and one accountant; resolving
  // all unread notifications for both roles simultaneously is acceptable behavior.
  const { error } = await supabase
    .from('notifications')
    .update({ resolved_at: new Date().toISOString() })
    .is('resolved_at', null);

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

export function subscribeToNotifications(onChange) {
  return supabase
    .channel('notifications-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
      },
      onChange
    )
    .subscribe();
}

export function unsubscribeFromNotifications(channel) {
  return supabase.removeChannel(channel);
}