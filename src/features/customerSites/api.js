import { supabase } from '../../lib/supabase';

export const siteKeys = {
  all: ['customerSites'],
  lists: () => [...siteKeys.all, 'list'],
  listByCustomer: (customerId) => [...siteKeys.lists(), { customerId }],
  details: () => [...siteKeys.all, 'detail'],
  detail: (id) => [...siteKeys.details(), id],
  byAccountNo: (accountNo) => [...siteKeys.all, 'accountNo', accountNo],
};

export async function fetchSitesByCustomer(customerId) {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*')
    .eq('customer_id', customerId)
    .order('site_name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchSiteByAccountNo(accountNo) {
  if (!accountNo) return null;
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*, customers(*)')
    .eq('account_no', accountNo)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchSite(id) {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*, customers(*)')
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
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function searchSites(query) {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('*, customers(*)')
    .or(`account_no.ilike.%${query}%,site_name.ilike.%${query}%,address.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return data;
}
