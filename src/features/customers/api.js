import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

/**
 * Targeted selection for customer list views to improve performance.
 */
export const CUSTOMER_LIST_SELECT = `
  id, company_name, phone, created_at,
  customer_sites ( city, subscriptions ( status ), work_orders ( status ) )
`.replace(/\s+/g, ' ').trim();

/**
 * Fetch all customers with optional search
 */
export async function fetchCustomers({ search = '' } = {}) {
  let query = supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search) {
    const normalized = normalizeForSearch(search);
    query = query.or(`company_name_search.ilike.%${normalized}%,phone_search.ilike.%${normalized}%`);
  }

  const { data, error } = await query.limit(200);
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

  if (error?.status === 406 || error?.code === 'PGRST116') {
    return null;
  }

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
 * Soft-delete a customer (and cascade to sites / subscriptions).
 * Uses SECURITY DEFINER RPC to bypass RLS evaluation-order issues.
 */
export async function deleteCustomer(id) {
  const { error } = await supabase.rpc('soft_delete_customer', {
    p_customer_id: id,
  });

  if (error) throw error;
  return { success: true };
}

/**
 * Audit log rows related to a customer (customer row + subscription rows).
 * RLS: admin-only SELECT on audit_logs.
 */
export async function fetchCustomerRelatedAuditLogs(customerId, subscriptionIds = []) {
  const customerQuery = supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'customers')
    .eq('record_id', customerId)
    .order('created_at', { ascending: false })
    .limit(40);

  const subscriptionQuery =
    subscriptionIds.length > 0
      ? supabase
          .from('audit_logs')
          .select('*')
          .eq('table_name', 'subscriptions')
          .in('record_id', subscriptionIds)
          .order('created_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [], error: null });

  const [cRes, sRes] = await Promise.all([customerQuery, subscriptionQuery]);
  if (cRes.error) throw cRes.error;
  if (sRes.error) throw sRes.error;

  const merged = [...(cRes.data || []), ...(sRes.data || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  return merged.slice(0, 100);
}
