import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

const SIM_CARD_SELECT = `
  *,
  buyer:buyer_id (company_name),
  customers:customer_id (company_name),
  customer_sites:site_id (site_name)
`;

export async function fetchSimCards(filters = {}) {
  let query = supabase
    .from('sim_cards')
    .select(SIM_CARD_SELECT)
    .is('deleted_at', null);

  if (filters.search) {
    const term = normalizeForSearch(filters.search);
    query = query.or(
      `phone_number.ilike.%${term}%`
    );
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.operator && filters.operator !== 'all') {
    query = query.eq('operator', filters.operator);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo + 'T23:59:59');
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Paginated SIM cards fetch. Returns { data, count }.
 * Keeps fetchSimCards() intact for export and other non-paginated callers.
 */
export async function fetchSimCardsPaginated(filters = {}, page = 0, pageSize = 100) {
  let query = supabase
    .from('sim_cards')
    .select(SIM_CARD_SELECT, { count: 'exact' })
    .is('deleted_at', null);

  if (filters.search) {
    const term = normalizeForSearch(filters.search);
    query = query.ilike('phone_number', `%${term}%`);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.operator && filters.operator !== 'all') {
    query = query.eq('operator', filters.operator);
  }
  if (filters.year && filters.year !== 'all') {
    query = query
      .gte('activation_date', `${filters.year}-01-01`)
      .lte('activation_date', `${filters.year}-12-31`);
  }
  if (filters.month && filters.month !== 'all') {
    const m = String(filters.month).padStart(2, '0');
    const year = filters.year && filters.year !== 'all' ? filters.year : new Date().getFullYear();
    const nextMonth = Number(m) === 12
      ? `${Number(year) + 1}-01`
      : `${year}-${String(Number(m) + 1).padStart(2, '0')}`;
    query = query
      .gte('activation_date', `${year}-${m}-01`)
      .lt('activation_date', `${nextMonth}-01`);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function fetchSimCardById(id) {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(SIM_CARD_SELECT)
    .is('deleted_at', null)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSimCard(simCardData) {
  const { data, error } = await supabase
    .from('sim_cards')
    .insert([simCardData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSimCard({ id, ...updates }) {
  const { data, error } = await supabase
    .from('sim_cards')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSimCard(id) {
  const { error } = await supabase
    .from('sim_cards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchSimCardHistory(simCardId) {
  const { data, error } = await supabase
    .from('sim_card_history')
    .select(`
      *,
      profiles:changed_by (full_name)
    `)
    .eq('sim_card_id', simCardId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function bulkCreateSimCards(simCardsArray) {
  const { data, error } = await supabase
    .from('sim_cards')
    .insert(simCardsArray)
    .select();

  if (error) throw error;
  return data;
}

export async function fetchSimCardsByCustomer(customerId) {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`
      *,
      buyer:buyer_id (company_name),
      customer_sites:site_id (site_name)
    `)
    .is('deleted_at', null)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetch SIMs eligible for subscription assignment: available (unassigned) OR already at this site
 */
export async function fetchSimCardsBySite(siteId) {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`
      *,
      buyer:buyer_id (company_name),
      customer_sites:site_id (site_name)
    `)
    .is('deleted_at', null)
    .or(`site_id.eq.${siteId},status.eq.available`)
    .order('phone_number', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Fetch SIMs for subscription with search (phone_number, buyer name, customer name)
 */
export async function fetchSimCardsForSubscription(siteId, search = '') {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`
      *,
      buyer:buyer_id (company_name),
      customer_sites:site_id (site_name)
    `)
    .is('deleted_at', null)
    .or(`site_id.eq.${siteId},status.eq.available`)
    .order('phone_number', { ascending: true });

  if (error) throw error;

  if (!search.trim()) return data;

  const normalizedTerm = normalizeForSearch(search.trim());
  return (data || []).filter(
    (s) =>
      normalizeForSearch(s.phone_number).includes(normalizedTerm) ||
      normalizeForSearch(s.buyer?.company_name).includes(normalizedTerm)
  );
}

/**
 * Fetch ALL Turkcell SIM cards for invoice analysis (bypasses default pagination).
 */
export async function fetchAllTurkcellSimCards() {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(SIM_CARD_SELECT)
    .is('deleted_at', null)
    .eq('operator', 'TURKCELL')
    .order('phone_number', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchSimFinancialStats() {
  const { data: stats, error: statsError } = await supabase
    .from('view_sim_card_stats')
    .select('*')
    .single();

  const { data: financials, error: finError } = await supabase
    .from('view_sim_card_financials')
    .select('*')
    .single();

  if (statsError) throw statsError;
  if (finError) throw finError;

  return {
    ...stats,
    ...financials
  };
}
