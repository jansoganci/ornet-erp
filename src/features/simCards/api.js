import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

/**
 * Inclusive activation_date range from calendar month corners (YYYY-MM-DD).
 * @returns {{ start: string, end: string } | null}
 */
export function resolveActivationMonthRangeBounds(afy, afm, aty, atm) {
  if (!afy || afy === 'all' || !afm || afm === 'all' || !aty || aty === 'all' || !atm || atm === 'all') {
    return null;
  }
  const fy = Number(afy);
  const fm = Number(afm);
  const ty = Number(aty);
  const tm = Number(atm);
  if ([fy, fm, ty, tm].some((n) => Number.isNaN(n))) return null;
  if (fm < 1 || fm > 12 || tm < 1 || tm > 12) return null;

  let fromYm = `${fy}-${String(fm).padStart(2, '0')}`;
  let toYm = `${ty}-${String(tm).padStart(2, '0')}`;
  if (fromYm > toYm) {
    [fromYm, toYm] = [toYm, fromYm];
  }

  const [y2, m2] = toYm.split('-').map(Number);
  const start = `${fromYm}-01`;
  const lastDay = new Date(y2, m2, 0).getDate();
  const end = `${y2}-${String(m2).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { start, end };
}

const SIM_CARD_SELECT = `
  *,
  customers:customer_id (company_name),
  customer_sites:site_id (site_name),
  provider_company:provider_company_id (id, name)
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
  } else if (!filters.status || filters.status === 'all') {
    // Default: exclude cancelled if no specific status filter is applied
    query = query.neq('status', 'cancelled');
  }
  if (filters.operator && filters.operator !== 'all') {
    query = query.eq('operator', filters.operator);
  }
  if (filters.provider_company_id && filters.provider_company_id !== 'all') {
    query = query.eq('provider_company_id', filters.provider_company_id);
  }
  const activationRange = resolveActivationMonthRangeBounds(
    filters.activationFromYear,
    filters.activationFromMonth,
    filters.activationToYear,
    filters.activationToMonth,
  );
  if (activationRange) {
    query = query.gte('activation_date', activationRange.start).lte('activation_date', activationRange.end);
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
  } else if (!filters.status || filters.status === 'all') {
    // Default: exclude cancelled if no specific status filter is applied
    query = query.neq('status', 'cancelled');
  }
  if (filters.operator && filters.operator !== 'all') {
    query = query.eq('operator', filters.operator);
  }
  if (filters.provider_company_id && filters.provider_company_id !== 'all') {
    query = query.eq('provider_company_id', filters.provider_company_id);
  }
  const activationRangePaginated = resolveActivationMonthRangeBounds(
    filters.activationFromYear,
    filters.activationFromMonth,
    filters.activationToYear,
    filters.activationToMonth,
  );
  if (activationRangePaginated) {
    query = query
      .gte('activation_date', activationRangePaginated.start)
      .lte('activation_date', activationRangePaginated.end);
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
  const { error } = await supabase.rpc('soft_delete_sim_card', { sim_card_id: id });
  if (error) throw error;
}

export async function cancelSimCard(id) {
  const { data, error } = await supabase
    .from('sim_cards')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
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

export async function fetchProviderCompanies() {
  const { data, error } = await supabase
    .from('provider_companies')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createProviderCompany({ name }) {
  const { data, error } = await supabase
    .from('provider_companies')
    .insert([{ name: String(name).trim() }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Returns existing phone_number and imsi values for duplicate check (non-deleted only).
 */
export async function fetchExistingSimIdentifiers() {
  const { data, error } = await supabase
    .from('sim_cards')
    .select('phone_number, imsi')
    .is('deleted_at', null);

  if (error) throw error;
  return data ?? [];
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
