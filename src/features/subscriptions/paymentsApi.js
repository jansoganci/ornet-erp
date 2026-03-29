import { supabase } from '../../lib/supabase';
import i18next from 'i18next';

/**
 * Fetch the full billing schedule for a subscription in a given year.
 * Calls get_subscription_year_schedule() — a pure-read RPC that merges real
 * subscription_payments rows with projected (virtual) rows for months not yet
 * generated.  Projected rows carry status = 'projected' and payment_id = null.
 *
 * Maps payment_id → id so downstream components (PaymentRecordModal etc.)
 * that expect a .id field continue to work without changes.
 */
export async function fetchSubscriptionYearSchedule(subscriptionId, year) {
  const { data, error } = await supabase.rpc('get_subscription_year_schedule', {
    p_subscription_id: subscriptionId,
    p_year: year,
  });

  if (error) throw error;
  return (data || []).map((row) => ({ ...row, id: row.payment_id }));
}

/**
 * Record a payment atomically via fn_record_payment RPC.
 *
 * The DB function acquires a row-level lock (SELECT FOR UPDATE) before any
 * read or write, so two concurrent requests for the same payment cannot both
 * pass the immutability check. All logic (VAT calc, UPDATE, audit insert)
 * runs in a single transaction.
 */
export async function recordPayment(paymentId, paymentData) {
  const { data: { user } } = await supabase.auth.getUser();

  // Resolve invoice flag (card always invoiced)
  const isCard = paymentData.payment_method === 'card';
  const shouldInvoice = isCard ? true : !!paymentData.should_invoice;

  // Resolve vat_rate client-side so the DB function receives a concrete value.
  // When no explicit rate is provided we need the existing payment to derive it.
  // Fetch only if vat_rate is missing — this read is outside the lock, but it's
  // read-only and only used for the fallback; the DB still enforces immutability.
  let vatRate = paymentData.vat_rate ?? null;
  if (shouldInvoice && vatRate == null) {
    const { data: current, error: fetchErr } = await supabase
      .from('subscription_payments')
      .select('amount, vat_amount')
      .eq('id', paymentId)
      .single();
    if (fetchErr) throw fetchErr;
    vatRate = current.vat_amount > 0
      ? Math.round((current.vat_amount / current.amount) * 10000) / 100
      : 20;
  }

  const paymentDate = paymentData.payment_date || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc('fn_record_payment', {
    p_payment_id:     paymentId,
    p_payment_date:   paymentDate,
    p_payment_method: paymentData.payment_method,
    p_should_invoice: shouldInvoice,
    p_vat_rate:       shouldInvoice ? vatRate : 0,
    p_invoice_no:     paymentData.invoice_no   || null,
    p_invoice_type:   paymentData.invoice_type || null,
    p_notes:          paymentData.notes        || null,
    p_reference_no:   paymentData.reference_no || null,
    p_user_id:        user?.id || null,
  });

  if (error) {
    // Translate DB exceptions to user-friendly messages
    if (error.message?.includes('payment_locked')) {
      throw new Error(i18next.t('subscriptions:payment.errors.paymentLocked'));
    }
    if (error.message?.includes('payment_not_found')) {
      throw new Error(i18next.t('subscriptions:payment.errors.paymentNotFound'));
    }
    if (error.message?.includes('Unauthorized')) {
      throw new Error(i18next.t('errors:common.unauthorized'));
    }
    throw error;
  }

  // RPC returns SETOF — unwrap single row
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Revert a write_off payment back to pending via fn_revert_write_off RPC.
 */
export async function revertWriteOff(paymentId) {
  const { data, error } = await supabase.rpc('fn_revert_write_off', {
    p_payment_id: paymentId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Count pending payments for a single subscription.
 * Uses a HEAD-only request — no rows transferred, just the count.
 * Used by CancelSubscriptionModal to warn before cancellation.
 */
export async function fetchPendingPaymentsCount(subscriptionId) {
  const { count, error } = await supabase
    .from('subscription_payments')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_id', subscriptionId)
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Get overdue invoices (paid >7 days without invoice, where should_invoice=true)
 */
export async function fetchOverdueInvoices() {
  const { data, error } = await supabase.rpc('get_overdue_invoices');
  if (error) throw error;
  return data;
}

/**
 * Get subscription dashboard stats
 */
export async function fetchSubscriptionStats() {
  const { data, error } = await supabase.rpc('get_subscription_stats');
  if (error) throw error;
  return data;
}

