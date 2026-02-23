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
