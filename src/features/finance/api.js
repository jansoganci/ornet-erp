import { supabase } from '../../lib/supabase';

// Query keys
export const transactionKeys = {
  all: ['financial_transactions'],
  lists: () => [...transactionKeys.all, 'list'],
  list: (filters) => [...transactionKeys.lists(), filters],
  details: () => [...transactionKeys.all, 'detail'],
  detail: (id) => [...transactionKeys.details(), id],
};

export const categoryKeys = {
  all: ['expense_categories'],
  lists: () => [...categoryKeys.all, 'list'],
  list: (filters) => [...categoryKeys.lists(), filters],
  detail: (id) => [...categoryKeys.all, 'detail', id],
};

export const rateKeys = {
  all: ['exchange_rates'],
  lists: () => [...rateKeys.all, 'list'],
  list: (filters) => [...rateKeys.lists(), filters],
  latest: (currency) => [...rateKeys.all, 'latest', currency],
};

export const profitAndLossKeys = {
  all: ['profit_and_loss'],
  list: (period, viewMode) => [...profitAndLossKeys.all, period, viewMode],
};

export const vatReportKeys = {
  all: ['vat_report'],
  list: (period, viewMode, periodType) => [...vatReportKeys.all, period, viewMode, periodType],
};

export const financeDashboardKeys = {
  all: ['finance_dashboard'],
  kpis: (period, viewMode) => [...financeDashboardKeys.all, 'kpis', period, viewMode],
  revenueExpenses: (period, viewMode) => [...financeDashboardKeys.all, 'revenueExpenses', period, viewMode],
  expenseByCategory: (period, viewMode) => [...financeDashboardKeys.all, 'expenseByCategory', period, viewMode],
  recentTransactions: (limit) => [...financeDashboardKeys.all, 'recentTransactions', limit],
};

function getLastNMonths(n) {
  const periods = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    periods.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return periods;
}

function quarterToMonths(q) {
  const match = q?.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return [];
  const year = parseInt(match[1], 10);
  const quarter = parseInt(match[2], 10);
  const startMonth = (quarter - 1) * 3 + 1;
  return [1, 2, 3].map((offset) => {
    const m = startMonth + offset - 1;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
}

// financial_transactions
const TRANSACTION_SELECT = '*, customers(company_name), customer_sites(site_name, account_no), expense_categories(name_tr, code)';

export async function fetchTransactions(filters = {}) {
  let query = supabase
    .from('financial_transactions')
    .select(TRANSACTION_SELECT)
    .order('transaction_date', { ascending: false });

  if (filters.direction) {
    query = query.eq('direction', filters.direction);
  }
  if (filters.period) {
    query = query.eq('period', filters.period);
  }
  if (filters.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }
  if (filters.site_id) {
    query = query.eq('site_id', filters.site_id);
  }
  if (filters.expense_category_id) {
    query = query.eq('expense_category_id', filters.expense_category_id);
  }
  if (filters.payment_method) {
    query = query.eq('payment_method', filters.payment_method);
  }

  if (filters.viewMode === 'official' || filters.viewMode === 'unofficial') {
    const val = filters.viewMode === 'official';
    if (filters.direction === 'income') {
      query = query.eq('should_invoice', val);
    } else if (filters.direction === 'expense') {
      query = query.eq('has_invoice', val);
    }
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchTransaction(id) {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select(TRANSACTION_SELECT)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

function cleanTransactionPayload(data) {
  const uuidKeys = ['customer_id', 'site_id', 'expense_category_id', 'work_order_id', 'proposal_id', 'created_by'];
  const out = { ...data };
  uuidKeys.forEach((k) => {
    if (k in out && (out[k] === '' || out[k] === undefined)) {
      out[k] = null;
    }
  });
  if (out.direction === 'income') {
    out.has_invoice = null;
  } else if (out.direction === 'expense') {
    out.should_invoice = null;
  }
  return out;
}

export async function createTransaction(data) {
  const cleaned = cleanTransactionPayload(data);
  const { data: result, error } = await supabase
    .from('financial_transactions')
    .insert(cleaned)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateTransaction(id, data) {
  const cleaned = cleanTransactionPayload(data);
  const { data: result, error } = await supabase
    .from('financial_transactions')
    .update(cleaned)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('financial_transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// expense_categories
export async function fetchCategories(filters = {}) {
  let query = supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true });

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCategory(data) {
  const { data: result, error } = await supabase
    .from('expense_categories')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateCategory(id, data) {
  const { data: result, error } = await supabase
    .from('expense_categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

// exchange_rates
export async function fetchRates(filters = {}) {
  let query = supabase
    .from('exchange_rates')
    .select('*')
    .order('rate_date', { ascending: false });

  if (filters.currency) {
    query = query.eq('currency', filters.currency);
  }
  if (filters.date_from) {
    query = query.gte('rate_date', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('rate_date', filters.date_to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createRate(data) {
  const { data: result, error } = await supabase
    .from('exchange_rates')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getLatestRate(currency = 'USD') {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('currency', currency)
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Invoke Edge Function to fetch TCMB rates and upsert into exchange_rates */
export async function fetchTcmbRates() {
  const { data, error } = await supabase.functions.invoke('fetch-tcmb-rates', {
    body: {},
  });
  if (error) throw error;
  return data;
}

// Recent transactions from v_profit_and_loss (subscription payments + financial_transactions)
export async function fetchRecentTransactions(limit = 10) {
  const { data, error } = await supabase
    .from('v_profit_and_loss')
    .select('source_id, source_type, direction, period_date, amount_try, customer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// v_profit_and_loss
export async function fetchProfitAndLoss(period, viewMode = 'total') {
  let query = supabase
    .from('v_profit_and_loss')
    .select('*')
    .order('period_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (period) {
    query = query.eq('period', period);
  }
  if (viewMode === 'official') {
    query = query.eq('is_official', true);
  } else if (viewMode === 'unofficial') {
    query = query.eq('is_official', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// vat_report (aggregated from v_profit_and_loss)
export async function fetchVatReport({ period, viewMode = 'total', periodType = 'month' } = {}) {
  let query = supabase
    .from('v_profit_and_loss')
    .select('period, output_vat, input_vat');

  if (periodType === 'quarter' && period) {
    const months = quarterToMonths(period);
    if (months.length) {
      query = query.in('period', months);
    }
  } else if (period) {
    query = query.eq('period', period);
  }

  if (viewMode === 'official') {
    query = query.eq('is_official', true);
  } else if (viewMode === 'unofficial') {
    query = query.eq('is_official', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  const byPeriod = {};
  for (const row of data || []) {
    const p = row.period;
    if (!byPeriod[p]) {
      byPeriod[p] = { period: p, output_vat: 0, input_vat: 0 };
    }
    byPeriod[p].output_vat += Number(row.output_vat || 0);
    byPeriod[p].input_vat += Number(row.input_vat || 0);
  }

  return Object.values(byPeriod)
    .map((r) => ({
      ...r,
      net_vat: Math.round((r.output_vat - r.input_vat) * 100) / 100,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// finance_dashboard
export async function fetchFinanceDashboardKpis({ period, viewMode = 'total' } = {}) {
  const [statsRes, plRes] = await Promise.all([
    supabase.rpc('get_subscription_stats'),
    fetchProfitAndLoss(period || null, viewMode),
  ]);
  if (statsRes.error) throw statsRes.error;

  const stats = statsRes.data || {};
  const mrr = Number(stats.mrr) || 0;
  const distinctCustomers = Number(stats.distinct_customer_count) || 0;
  const arpc = distinctCustomers > 0 ? Math.round((mrr / distinctCustomers) * 100) / 100 : 0;

  let revenue = 0;
  let expenses = 0;
  let cogs = 0;
  let outputVat = 0;
  let inputVat = 0;

  for (const row of plRes || []) {
    const amt = Number(row.amount_try) || 0;
    if (amt > 0) {
      revenue += amt;
      cogs += Number(row.cogs_try) || 0;
    } else {
      expenses += Math.abs(amt);
    }
    outputVat += Number(row.output_vat) || 0;
    inputVat += Number(row.input_vat) || 0;
  }

  const grossMarginPct = revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 10000) / 100 : null;
  const netProfit = Math.round((revenue - expenses) * 100) / 100;
  const vatPayable = Math.round((outputVat - inputVat) * 100) / 100;
  const materialCostPct = revenue > 0 ? Math.round((cogs / revenue) * 10000) / 100 : null;

  let simNetProfit = 0;
  let subscriptionNetProfit = 0;

  for (const row of plRes || []) {
    const amt = Number(row.amount_try) || 0;
    const st = row.source_type || '';

    if (st === 'sim_rental') simNetProfit += amt;
    else if (st === 'sim_operator') simNetProfit -= Math.abs(amt);

    if (st === 'subscription') subscriptionNetProfit += amt;
    else if (st === 'subscription_cogs') subscriptionNetProfit -= Math.abs(amt);
  }

  simNetProfit = Math.round(simNetProfit * 100) / 100;
  subscriptionNetProfit = Math.round(subscriptionNetProfit * 100) / 100;

  return {
    mrr,
    arpc,
    grossMarginPct,
    netProfit,
    vatPayable,
    materialCostPct,
    simNetProfit,
    subscriptionNetProfit,
  };
}

export async function fetchRevenueExpensesByMonth({ months = 6, viewMode = 'total' } = {}) {
  const periodList = getLastNMonths(months);
  const data = await fetchProfitAndLoss(null, viewMode);
  const byPeriod = {};

  for (const p of periodList) {
    byPeriod[p] = { period: p, revenue: 0, expenses: 0 };
  }

  for (const row of data || []) {
    const p = row.period;
    if (!byPeriod[p]) continue;
    const amt = Number(row.amount_try) || 0;
    if (amt > 0) {
      byPeriod[p].revenue += amt;
    } else {
      byPeriod[p].expenses += Math.abs(amt);
    }
  }

  return periodList.map((p) => ({
    period: p,
    revenue: Math.round((byPeriod[p].revenue || 0) * 100) / 100,
    expenses: Math.round((byPeriod[p].expenses || 0) * 100) / 100,
  })).reverse();
}

export async function fetchExpenseByCategory({ period, viewMode = 'total' } = {}) {
  let query = supabase
    .from('v_profit_and_loss')
    .select('source_type, amount_try')
    .eq('direction', 'expense');

  if (period) {
    query = query.eq('period', period);
  }
  if (viewMode === 'official') {
    query = query.eq('is_official', true);
  } else if (viewMode === 'unofficial') {
    query = query.eq('is_official', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  const byCat = {};
  for (const row of data || []) {
    const cat = row.source_type || 'other';
    if (!byCat[cat]) byCat[cat] = 0;
    byCat[cat] += Math.abs(Number(row.amount_try) || 0);
  }

  return Object.entries(byCat).map(([name, amount]) => ({
    name,
    amount: Math.round(amount * 100) / 100,
  })).sort((a, b) => b.amount - a.amount);
}
