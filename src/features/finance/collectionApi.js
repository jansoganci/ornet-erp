import { supabase } from '../../lib/supabase';

// Query keys
export const collectionKeys = {
  all: ['collection'],
  lists: () => [...collectionKeys.all, 'list'],
  list: (filters) => [...collectionKeys.lists(), filters],
  stats: () => [...collectionKeys.all, 'stats'],
  stat: (filters) => [...collectionKeys.stats(), filters],
};

const COLLECTION_SELECT = `
  id,
  subscription_id,
  payment_month,
  amount,
  vat_amount,
  total_amount,
  status,
  payment_date,
  payment_method,
  should_invoice,
  invoice_no,
  subscriptions!inner (
    id,
    billing_frequency,
    vat_rate,
    status,
    official_invoice,
    payment_method_id,
    customer_sites!inner (
      account_no,
      site_name,
      customers!inner ( id, company_name )
    ),
    payment_methods ( label, card_last4, bank_name )
  )
`;

/**
 * Fetch ALL pending subscription payments (including overdue from past months).
 * Optional year/month filter narrows to a specific period.
 * Returns rows with subscription + customer + site info for the Collection Desk.
 */
export async function fetchCollectionPayments(filters = {}) {
  let query = supabase
    .from('subscription_payments')
    .select(COLLECTION_SELECT)
    .eq('status', 'pending');

  // Optional month filter — when not set, shows ALL pending (current + overdue)
  if (filters.year && filters.month) {
    const m = String(filters.month).padStart(2, '0');
    const periodStart = `${filters.year}-${m}-01`;
    const nextMonth = Number(filters.month) === 12
      ? `${Number(filters.year) + 1}-01-01`
      : `${filters.year}-${String(Number(filters.month) + 1).padStart(2, '0')}-01`;
    query = query
      .gte('payment_month', periodStart)
      .lt('payment_month', nextMonth);
  }

  // Search filter (customer name)
  if (filters.search) {
    query = query.ilike('subscriptions.customer_sites.customers.company_name', `%${filters.search}%`);
  }

  const { data, error } = await query
    .order('payment_month', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Compute collection KPI stats.
 * When no filters, stats cover ALL pending payments (including overdue).
 */
export async function fetchCollectionStats(filters = {}) {
  let pendingQuery = supabase
    .from('subscription_payments')
    .select(`
      amount,
      vat_amount,
      total_amount,
      should_invoice,
      subscriptions!inner ( status, official_invoice )
    `)
    .eq('status', 'pending');

  let paidQuery = supabase
    .from('subscription_payments')
    .select('amount, total_amount, should_invoice')
    .eq('status', 'paid');

  // Optional month filter
  if (filters.year && filters.month) {
    const m = String(filters.month).padStart(2, '0');
    const periodStart = `${filters.year}-${m}-01`;
    const nextMonth = Number(filters.month) === 12
      ? `${Number(filters.year) + 1}-01-01`
      : `${filters.year}-${String(Number(filters.month) + 1).padStart(2, '0')}-01`;
    pendingQuery = pendingQuery
      .gte('payment_month', periodStart)
      .lt('payment_month', nextMonth);
    paidQuery = paidQuery
      .gte('payment_month', periodStart)
      .lt('payment_month', nextMonth);
  }

  const [{ data: pending, error: pendingErr }, { data: paid, error: paidErr }] =
    await Promise.all([pendingQuery, paidQuery]);

  if (pendingErr) throw pendingErr;
  if (paidErr) throw paidErr;

  const rows = pending ?? [];
  const paidRows = paid ?? [];

  // Count overdue (payment_month before current month)
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const overdueCount = rows.filter((r) => r.payment_month < currentPeriod).length;

  const pendingCount = rows.length;
  const pendingNetTotal = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingGrossTotal = rows.reduce((sum, r) => {
    const invoice = r.subscriptions?.official_invoice ?? r.should_invoice;
    return sum + (invoice ? Number(r.total_amount || 0) : Number(r.amount || 0));
  }, 0);

  const collectedCount = paidRows.length;
  const collectedNetTotal = paidRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return {
    pendingCount,
    pendingNetTotal,
    pendingGrossTotal,
    overdueCount,
    collectedCount,
    collectedNetTotal,
    totalCount: pendingCount + collectedCount,
  };
}
