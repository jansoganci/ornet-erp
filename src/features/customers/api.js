import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

/**
 * Fetch all customers with optional search
 */
export async function fetchCustomers({ search = '' } = {}) {
  let query = supabase
    .from('customers')
    .select('*, customer_sites(city)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search) {
    const normalized = normalizeForSearch(search);
    query = query.or(`company_name_search.ilike.%${normalized}%,phone_search.ilike.%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  // Map site count and city for UI
  return data.map(customer => {
    const sites = customer.customer_sites || [];
    const sitesCount = sites.length;
    
    // Get first non-null city from sites, or null if no city
    const city = sites
      .map(site => site.city)
      .find(c => c) || null;
    
    return {
      ...customer,
      sites_count: sitesCount,
      city: city
    };
  });
}

/**
 * Fetch a single customer by ID
 */
export async function fetchCustomer(id) {
  const { data, error } = await supabase
    .from('customers')
    .select('*, customer_sites(*)')
    .is('deleted_at', null)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new customer
 */
export async function createCustomer(customerData) {
  const { data, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing customer
 */
export async function updateCustomer({ id, ...customerData }) {
  const { data, error } = await supabase
    .from('customers')
    .update(customerData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a customer
 */
export async function deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
