import { supabase } from '../../lib/supabase';
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
    query = query.or(
      `company_name.ilike.%${filters.search}%,account_no.ilike.%${filters.search}%,site_name.ilike.%${filters.search}%`
    );
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('subscription_type', filters.type);
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
    payload.subscription_type === 'recurring_card' &&
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
  const subscription_type = payload.subscription_type ?? current.subscription_type;

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
    subscription_type === 'recurring_card' &&
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

  // Check if pricing changed — recalculate pending payment amounts
  const priceFields = ['base_price', 'sms_fee', 'line_fee', 'vat_rate'];
  const priceChanged = priceFields.some(
    (field) => updateData[field] !== undefined && Number(updateData[field]) !== Number(current[field])
  );

  if (priceChanged) {
    const subtotal = Number(data.base_price) + Number(data.sms_fee) + Number(data.line_fee);
    const vatAmount = Math.round(subtotal * Number(data.vat_rate) / 100 * 100) / 100;
    const totalAmount = subtotal + vatAmount;

    // Multiply by billing frequency (base_price etc. are always monthly)
    const freq = data.billing_frequency || current.billing_frequency;
    const multiplier = freq === 'yearly' || data.subscription_type === 'annual' ? 12
      : freq === '6_month' ? 6
      : 1;

    const { error: updatePaymentsErr } = await supabase
      .from('subscription_payments')
      .update({
        amount: subtotal * multiplier,
        vat_amount: vatAmount * multiplier,
        total_amount: totalAmount * multiplier,
      })
      .eq('subscription_id', id)
      .eq('status', 'pending');

    if (updatePaymentsErr) throw updatePaymentsErr;

    await insertAuditLog('subscriptions', id, 'price_change', {
      base_price: current.base_price,
      sms_fee: current.sms_fee,
      line_fee: current.line_fee,
      vat_rate: current.vat_rate,
    }, {
      base_price: data.base_price,
      sms_fee: data.sms_fee,
      line_fee: data.line_fee,
      vat_rate: data.vat_rate,
    }, 'Fiyat güncellendi');
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

  // Mark future pending payments as skipped
  const { error: skipErr } = await supabase
    .from('subscription_payments')
    .update({ status: 'skipped' })
    .eq('subscription_id', id)
    .eq('status', 'pending')
    .gte('payment_month', new Date().toISOString().slice(0, 7) + '-01');

  if (skipErr) throw skipErr;

  await insertAuditLog('subscriptions', id, 'pause', null, { reason }, 'Abonelik duraklatıldı');

  return data;
}

/**
 * Cancel a subscription — optionally write off unpaid amounts
 */
export async function cancelSubscription(id, { reason, writeOffUnpaid = false }) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ 
      status: 'cancelled', 
      cancel_reason: reason,
      cancelled_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (writeOffUnpaid) {
    const { error: writeOffErr } = await supabase
      .from('subscription_payments')
      .update({ status: 'write_off' })
      .eq('subscription_id', id)
      .eq('status', 'pending');

    if (writeOffErr) throw writeOffErr;
  }

  await insertAuditLog('subscriptions', id, 'cancel', null, { reason, writeOffUnpaid }, 'Abonelik iptal edildi');

  return data;
}

/**
 * Reactivate a paused subscription — regenerate payments from current month
 */
export async function reactivateSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ 
      status: 'active',
      reactivated_at: new Date().toISOString()
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
