import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { createPaymentMethod } from './paymentMethodsApi';

/**
 * Clean string/uuid fields: empty string -> null for subscription payloads
 */
function cleanSubscriptionPayload(payload) {
  const cleaned = { ...payload };
  const stringFields = [
    'payment_method_id', 'sold_by', 'managed_by', 'notes', 'setup_notes',
    'service_type', 'cash_collector_id', 'card_bank_name', 'card_last4',
    'sim_card_id',
  ];
  stringFields.forEach((key) => {
    if (key in cleaned && (cleaned[key] === '' || cleaned[key] === undefined)) {
      cleaned[key] = null;
    }
  });
  return cleaned;
}

/**
 * Insert an audit log entry
 */
async function insertAuditLog(tableName, recordId, action, oldValues, newValues, description) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_logs').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    old_values: oldValues,
    new_values: newValues,
    user_id: user?.id || null,
    description,
  });
}

/**
 * Fetch all subscriptions with filters (uses subscriptions_detail view)
 */
export async function fetchSubscriptions(filters = {}) {
  let query = supabase
    .from('subscriptions_detail')
    .select('*');

  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(
      `company_name_search.ilike.%${normalized}%,account_no_search.ilike.%${normalized}%,site_name_search.ilike.%${normalized}%`
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.managedBy) {
    query = query.eq('managed_by', filters.managedBy);
  }

  if (filters.service_type && filters.service_type !== 'all') {
    query = query.eq('service_type', filters.service_type);
  }

  if (filters.billing_frequency && filters.billing_frequency !== 'all') {
    query = query.eq('billing_frequency', filters.billing_frequency);
  }

  if (filters.site_id) {
    query = query.eq('site_id', filters.site_id);
  }

  if (filters.dateFrom) {
    query = query.gte('start_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('start_date', filters.dateTo);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false });

  if (error) throw error;

  const startMonth = filters.start_month != null ? Number(filters.start_month) : null;
  if (startMonth >= 1 && startMonth <= 12 && Array.isArray(data)) {
    return data.filter((row) => new Date(row.start_date).getMonth() + 1 === startMonth);
  }
  return data;
}

/**
 * Paginated version of fetchSubscriptions.
 * Returns { data, count } where count is the total matching rows.
 * All filters applied server-side (no client-side post-processing).
 */
export async function fetchSubscriptionsPaginated(filters = {}, page = 0, pageSize = 50) {
  let query = supabase
    .from('subscriptions_detail')
    .select('*', { count: 'exact' });

  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(
      `company_name_search.ilike.%${normalized}%,account_no_search.ilike.%${normalized}%,site_name_search.ilike.%${normalized}%`
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.managedBy) {
    query = query.eq('managed_by', filters.managedBy);
  }

  if (filters.service_type && filters.service_type !== 'all') {
    query = query.eq('service_type', filters.service_type);
  }

  if (filters.billing_frequency && filters.billing_frequency !== 'all') {
    query = query.eq('billing_frequency', filters.billing_frequency);
  }

  if (filters.site_id) {
    query = query.eq('site_id', filters.site_id);
  }

  if (filters.dateFrom) {
    query = query.gte('start_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('start_date', filters.dateTo);
  }

  if (filters.overdue) {
    query = query.eq('has_overdue_pending', true);
  }

  // Year + month filter on start_date (server-side)
  if (filters.year && filters.year !== 'all') {
    query = query
      .gte('start_date', `${filters.year}-01-01`)
      .lte('start_date', `${filters.year}-12-31`);
  }
  if (filters.month && filters.month !== 'all') {
    const m = String(filters.month).padStart(2, '0');
    const year = filters.year && filters.year !== 'all' ? filters.year : new Date().getFullYear();
    const nextMonth = Number(m) === 12 ? `${Number(year) + 1}-01` : `${year}-${String(Number(m) + 1).padStart(2, '0')}`;
    query = query
      .gte('start_date', `${year}-${m}-01`)
      .lt('start_date', `${nextMonth}-01`);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

/**
 * Fetch subscriptions for a specific customer (uses subscriptions_detail view).
 * Optimized for CustomerDetailPage — avoids fetching all subscriptions.
 */
export async function fetchSubscriptionsByCustomer(customerId) {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from('subscriptions_detail')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single subscription by ID
 */
export async function fetchSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions_detail')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new subscription + generate payment records + audit log
 */
export async function createSubscription(subscriptionData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let payload = cleanSubscriptionPayload(subscriptionData);

  // Card + inline: create payment_method and set payment_method_id if not provided
  if (
    payload.card_bank_name &&
    payload.card_last4 &&
    (!payload.payment_method_id || payload.payment_method_id === null)
  ) {
    const { data: site, error: siteErr } = await supabase
      .from('customer_sites')
      .select('customer_id')
      .eq('id', payload.site_id)
      .single();
    if (siteErr || !site?.customer_id) throw new Error('Site or customer not found');
    const pm = await createPaymentMethod({
      customer_id: site.customer_id,
      method_type: 'card',
      bank_name: payload.card_bank_name,
      card_last4: String(payload.card_last4).slice(-4),
      is_default: true,
    });
    payload = { ...payload, payment_method_id: pm.id };
  }

  const dataWithCreator = {
    ...payload,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('subscriptions')
    .insert(dataWithCreator)
    .select()
    .single();

  if (error) throw error;

  // Generate 12 monthly payment records (or 1 for annual)
  const { error: rpcError } = await supabase.rpc('generate_subscription_payments', {
    p_subscription_id: data.id,
  });
  if (rpcError) throw rpcError;

  await insertAuditLog('subscriptions', data.id, 'insert', null, dataWithCreator, 'Abonelik oluşturuldu');

  return data;
}

/**
 * Update a subscription + recalculate pending payments if price changed + audit log
 */
export async function updateSubscription({ id, ...updateData }) {
  // Fetch current subscription for audit log comparison
  const { data: current, error: fetchErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr) throw fetchErr;

  let payload = cleanSubscriptionPayload(updateData);

  // Automatically set timestamps when status changes
  if (payload.status && payload.status !== current.status) {
    const now = new Date().toISOString();
    if (payload.status === 'cancelled') {
      payload.cancelled_at = now;
    } else if (payload.status === 'paused') {
      payload.paused_at = now;
    } else if (payload.status === 'active' && (current.status === 'paused' || current.status === 'cancelled')) {
      payload.reactivated_at = now;
    }
  }

  // Card + inline: create payment_method and set payment_method_id if not provided
  if (
    payload.card_bank_name &&
    payload.card_last4 &&
    (!payload.payment_method_id || payload.payment_method_id === null)
  ) {
    const siteId = payload.site_id ?? current.site_id;
    const { data: site, error: siteErr } = await supabase
      .from('customer_sites')
      .select('customer_id')
      .eq('id', siteId)
      .single();
    if (siteErr || !site?.customer_id) throw new Error('Site or customer not found');
    const pm = await createPaymentMethod({
      customer_id: site.customer_id,
      method_type: 'card',
      bank_name: payload.card_bank_name,
      card_last4: String(payload.card_last4).slice(-4),
      is_default: true,
    });
    payload = { ...payload, payment_method_id: pm.id };
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Check if pricing changed — recalculate pending payment amounts atomically
  const priceFields = ['base_price', 'sms_fee', 'line_fee', 'static_ip_fee', 'sim_amount', 'vat_rate'];
  const priceChanged = priceFields.some(
    (field) => updateData[field] !== undefined && Number(updateData[field]) !== Number(current[field])
  );

  if (priceChanged) {
    // fn_update_subscription_price locks the subscription row, updates prices,
    // and recalculates all pending payments in a single transaction — preventing
    // a concurrent update from producing inconsistent payment amounts.
    const { data: { user } } = await supabase.auth.getUser();
    const { error: rpcErr } = await supabase.rpc('fn_update_subscription_price', {
      p_subscription_id: id,
      p_base_price:      Number(data.base_price),
      p_sms_fee:         Number(data.sms_fee),
      p_line_fee:        Number(data.line_fee),
      p_static_ip_fee:   Number(data.static_ip_fee),
      p_sim_amount:      Number(data.sim_amount) || 0,
      p_vat_rate:        Number(data.vat_rate),
      p_cost:            Number(data.cost),
      p_old_prices: {
        base_price:    current.base_price,
        sms_fee:       current.sms_fee,
        line_fee:      current.line_fee,
        static_ip_fee: current.static_ip_fee,
        sim_amount:    current.sim_amount,
        vat_rate:      current.vat_rate,
      },
      p_user_id: user?.id || null,
    });
    // Subscription header is already saved — do not throw and roll back the
    // whole update. Instead signal partial failure so the hook can warn the user.
    if (rpcErr) return { ...data, _priceUpdateFailed: true };
  } else {
    await insertAuditLog('subscriptions', id, 'update', current, data, 'Abonelik güncellendi');
  }

  return data;
}

/**
 * Pause a subscription — set status=paused, mark future pending→skipped
 */
export async function pauseSubscription(id, reason) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ 
      status: 'paused', 
      pause_reason: reason,
      paused_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Mark future pending payments as skipped (current month is NOT skipped)
  const now = new Date();
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString().slice(0, 10);
  const { error: skipErr } = await supabase
    .from('subscription_payments')
    .update({ status: 'skipped' })
    .eq('subscription_id', id)
    .eq('status', 'pending')
    .gte('payment_month', nextMonthStart);

  if (skipErr) throw skipErr;

  await insertAuditLog('subscriptions', id, 'pause', null, { reason }, 'Abonelik duraklatıldı');

  return data;
}

/**
 * Cancel a subscription — optionally write off unpaid amounts.
 * Uses fn_cancel_subscription RPC so both the status update and the
 * payment write-off execute inside a single DB transaction.
 */
export async function cancelSubscription(id, { reason, writeOffUnpaid = false }) {
  const { data, error } = await supabase.rpc('fn_cancel_subscription', {
    p_subscription_id:  id,
    p_reason:           reason ?? null,
    p_write_off_unpaid: writeOffUnpaid,
  });

  if (error) throw error;

  // RPC returns SETOF — unwrap the single row
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Reactivate a paused subscription — regenerate payments from current month
 */
export async function reactivateSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      reactivated_at: new Date().toISOString(),
      // Clear stale pause/cancel fields so the status history is unambiguous
      pause_reason: null,
      paused_at: null,
      cancel_reason: null,
      cancelled_at: null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Generate new payment records from current month forward
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  const { error: rpcError } = await supabase.rpc('generate_subscription_payments', {
    p_subscription_id: id,
    p_start_date: currentMonth,
  });
  if (rpcError) throw rpcError;

  await insertAuditLog('subscriptions', id, 'reactivate', null, null, 'Abonelik yeniden etkinleştirildi');

  return data;
}

/**
 * Bulk-update subscription prices (and recalc pending payment amounts) via RPC.
 * @param {Array<{ id: string, base_price: number, sms_fee: number, line_fee: number, vat_rate: number, cost: number }>} updates
 * @returns {Promise<number>} Number of subscriptions updated
 */
export async function bulkUpdateSubscriptionPrices(updates) {
  const { data, error } = await supabase.rpc('bulk_update_subscription_prices', {
    p_updates: updates,
  });
  if (error) throw error;
  return data;
}

/**
 * Fetch revision notes for a subscription (timeline, ordered by revision_date DESC).
 * @param {string} subscriptionId
 * @returns {Promise<Array<{ id: string, note: string, revision_date: string, created_at: string, created_by: string | null }>>}
 */
export async function fetchRevisionNotes(subscriptionId) {
  const { data, error } = await supabase
    .from('subscription_price_revision_notes')
    .select('id, note, revision_date, created_at, created_by')
    .eq('subscription_id', subscriptionId)
    .order('revision_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a revision note for a subscription.
 * @param {{ subscription_id: string, note: string, revision_date: string }} payload
 * @returns {Promise<object>} Inserted row
 */
export async function getSubscriptionUpdatedAt(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data?.updated_at;
}

export async function createRevisionNote({ subscription_id, note, revision_date }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('subscription_price_revision_notes')
    .insert({
      subscription_id,
      note,
      revision_date,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
