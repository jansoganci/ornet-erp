import { supabase, isSupabaseConfigured } from '../../lib/supabase';

/**
 * Fetch all customers with optional search
 */
export async function fetchCustomers({ search = '' } = {}) {
  let query = supabase
    .from('customers')
    .select('*, customer_sites(count)')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  // Map site count for UI
  return data.map(customer => ({
    ...customer,
    sites_count: customer.customer_sites?.[0]?.count || 0
  }));
}

/**
 * Fetch a single customer by ID
 */
export async function fetchCustomer(id) {
  const { data, error } = await supabase
    .from('customers')
    .select('*, customer_sites(*)')
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
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
