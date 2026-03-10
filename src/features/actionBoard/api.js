import { supabase } from '../../lib/supabase';

export async function fetchLateWorkOrders() {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('work_orders_detail')
    .select('id, company_name, site_name, work_type, scheduled_date')
    .lt('scheduled_date', today)
    .not('status', 'in', '("completed","cancelled")')
    .order('scheduled_date', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    daysLate: Math.floor(
      (new Date(today) - new Date(row.scheduled_date)) / (1000 * 60 * 60 * 24)
    ),
  }));
}

export async function fetchOverduePayments() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('subscription_payments')
    .select(`
      id,
      subscription_id,
      payment_month,
      amount,
      subscriptions!inner (
        id,
        customer_sites!inner (
          site_name,
          customers!inner (
            company_name
          )
        )
      )
    `)
    .eq('status', 'pending')
    .lt('payment_month', cutoff)
    .order('payment_month', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    subscription_id: row.subscription_id,
    payment_month: row.payment_month,
    amount: row.amount,
    company_name: row.subscriptions?.customer_sites?.customers?.company_name ?? '—',
    site_name: row.subscriptions?.customer_sites?.site_name ?? '—',
    daysOverdue: Math.floor(
      (new Date(todayStr) - new Date(row.payment_month)) / (1000 * 60 * 60 * 24)
    ),
  }));
}

export async function fetchAcceptedProposalsWithoutWO() {
  const { data, error } = await supabase
    .from('proposals_detail')
    .select('id, customer_company_name, proposal_no, title, created_at')
    .eq('status', 'accepted')
    .eq('work_order_count', 0)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
