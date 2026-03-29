import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

export const siteKeys = {
  all: ['customerSites'],
  lists: () => [...siteKeys.all, 'list'],
  listByCustomer: (customerId) => [...siteKeys.lists(), { customerId }],
  listAll: (filters) => [...siteKeys.lists(), 'all', filters],
  details: () => [...siteKeys.all, 'detail'],
  detail: (id) => [...siteKeys.details(), id],
  byAccountNo: (accountNo) => [...siteKeys.all, 'accountNo', accountNo],
};

/**
 * Targeted selection for site list views to improve performance.
 */
export const SITE_LIST_SELECT = 'id, customer_id, account_no, site_name, city, district, created_at, customers ( company_name, subscriber_title )';

export async function fetchSitesByCustomer(customerId) {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('id, account_no, site_name, city, district')
    .is('deleted_at', null)
    .eq('customer_id', customerId)
    .order('site_name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchSiteByAccountNo(accountNo) {
  if (!accountNo) return null;
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*, customers ( id, company_name, phone )')
    .is('deleted_at', null)
    .eq('account_no', accountNo)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSite(id) {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*, customers ( id, company_name, phone )')
    .is('deleted_at', null)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSite(data) {
  const { data: result, error } = await supabase
    .from('customer_sites')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateSite(id, data) {
  const { data: result, error } = await supabase
    .from('customer_sites')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteSite(id) {
  const { error } = await supabase
    .from('customer_sites')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchAllSites({ search = '' } = {}) {
  if (search && search.trim()) {
    const { data, error } = await supabase.rpc('search_customer_sites', {
      search_query: search.trim(),
    });
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await supabase
    .from('customer_sites')
    .select(SITE_LIST_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function searchSites(query) {
  const normalized = normalizeForSearch(query);
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*, customers(*)')
    .is('deleted_at', null)
    .or(`account_no_search.ilike.%${normalized}%,site_name_search.ilike.%${normalized}%,address_search.ilike.%${normalized}%`)
    .limit(10);

  if (error) throw error;
  return data;
}
