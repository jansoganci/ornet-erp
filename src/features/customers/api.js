import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

/**
 * Fetch all customers with optional search
 */
export async function fetchCustomers({ search = '' } = {}) {
  let query = supabase
    .from('customers')
    .select('*, customer_sites(city, subscriptions(status), work_orders(status))')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search) {
    const normalized = normalizeForSearch(search);
    query = query.or(`company_name_search.ilike.%${normalized}%,phone_search.ilike.%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  // Map site count, city, and derived counts for UI
  return data.map(customer => {
    const sites = customer.customer_sites || [];
    const siteCount = sites.length;

    const city = sites.map(site => site.city).find(c => c) || null;

    const activeSubscriptionsCount = sites
      .flatMap(s => s.subscriptions || [])
      .filter(s => s.status === 'active').length;

    const openWorkOrdersCount = sites
      .flatMap(s => s.work_orders || [])
      .filter(wo => !['completed', 'cancelled'].includes(wo.status)).length;

    return {
      ...customer,
      site_count: siteCount,
      city,
      active_subscriptions_count: activeSubscriptionsCount,
      open_work_orders_count: openWorkOrdersCount,
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
 * Fetch all existing customer company_names (for duplicate detection in import).
 */
export async function fetchExistingCustomerNames() {
  const { data, error } = await supabase
    .from('customers')
    .select('company_name')
    .is('deleted_at', null);
  if (error) throw error;
  return data.map((r) => r.company_name).filter(Boolean);
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
