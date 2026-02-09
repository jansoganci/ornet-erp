import { supabase } from '../../lib/supabase';

/**
 * Fetch all payment records for a subscription, ordered by month
 */
export async function fetchPaymentsBySubscription(subscriptionId) {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('payment_month', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Record a payment — set status=paid with payment details
 * Validates immutability rule: paid+invoiced payments cannot be modified
 * Handles invoice logic: card=always invoiced, cash/bank=user choice
 */
export async function recordPayment(paymentId, paymentData) {
  // Fetch current payment to check immutability
  const { data: current, error: fetchErr } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (fetchErr) throw fetchErr;

  // Immutability check: paid + invoiced = locked
  if (current.status === 'paid' && current.invoice_no) {
    throw new Error('Bu ödeme faturalanmış ve değiştirilemez.');
  }

  // Build update payload based on invoice logic
  const isCard = paymentData.payment_method === 'card';
  const shouldInvoice = isCard ? true : !!paymentData.should_invoice;

  let vatRate, vatAmount, totalAmount;

  if (shouldInvoice) {
    // Use provided vat_rate; fallback to rate derived from existing amounts or 20%
    vatRate = paymentData.vat_rate != null
      ? paymentData.vat_rate
      : (current.vat_amount > 0
        ? Math.round((current.vat_amount / current.amount) * 10000) / 100
        : 20);
    vatAmount = Math.round(current.amount * vatRate) / 100;
    totalAmount = current.amount + vatAmount;
  } else {
    // No invoice: zero VAT
    vatRate = 0;
    vatAmount = 0;
    totalAmount = current.amount;
  }

  const { data, error } = await supabase
    .from('subscription_payments')
    .update({
      status: 'paid',
      payment_date: paymentData.payment_date,
      payment_method: paymentData.payment_method,
      should_invoice: shouldInvoice,
      payment_vat_rate: vatRate,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      invoice_no: shouldInvoice ? (paymentData.invoice_no || null) : null,
      invoice_type: shouldInvoice ? (paymentData.invoice_type || null) : null,
      invoice_date: shouldInvoice && paymentData.invoice_no ? paymentData.payment_date : null,
      notes: paymentData.notes || null,
      reference_no: paymentData.reference_no || null,
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw error;

  // Audit log
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('audit_logs').insert({
    table_name: 'subscription_payments',
    record_id: paymentId,
    action: 'payment_recorded',
    old_values: { status: current.status },
    new_values: {
      status: 'paid',
      payment_date: paymentData.payment_date,
      payment_method: paymentData.payment_method,
      should_invoice: shouldInvoice,
    },
    user_id: user?.id || null,
    description: `Ödeme kaydedildi: ${current.payment_month}`,
  });

  return data;
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
