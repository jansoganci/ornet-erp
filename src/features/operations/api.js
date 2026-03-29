import { supabase } from '../../lib/supabase';

// Query keys
export const serviceRequestKeys = {
  all: ['service_requests'],
  lists: () => [...serviceRequestKeys.all, 'list'],
  list: (filters) => [...serviceRequestKeys.lists(), filters],
  details: () => [...serviceRequestKeys.all, 'detail'],
  detail: (id) => [...serviceRequestKeys.details(), id],
  stats: (filters) => [...serviceRequestKeys.all, 'stats', filters],
};

// Lightweight SELECT for operations pool (list view) — only columns displayed on cards
const POOL_SELECT = `
  id, customer_id, site_id, work_type, description, status, contact_status, 
  priority, created_at, created_by, work_order_id,
  customers ( id, company_name, phone ),
  customer_sites ( id, site_name, account_no, city, district, contact_phone ),
  profiles!created_by ( full_name ),
  work_orders ( id, form_no, status )
`;

// Full SELECT for detail view — includes all fields
const REQUEST_DETAIL_SELECT = `
  *,
  customers ( id, company_name, phone ),
  customer_sites ( id, site_name, account_no, city, district, contact_phone ),
  profiles!created_by ( full_name ),
  work_orders ( id, form_no, status )
`;

/**
 * Fetch service requests with optional filters.
 * Default: all open requests (the pool).
 */
export async function fetchServiceRequests(filters = {}) {
  let query = supabase
    .from('service_requests')
    .select(POOL_SELECT)
    .is('deleted_at', null);

  // Status filter (default: open)
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters.status) {
    query = query.eq('status', 'open');
  }

  // Region filter
  if (filters.region && filters.region !== 'all') {
    query = query.eq('region', filters.region);
  }

  // Contact status filter
  if (filters.contactStatus && filters.contactStatus !== 'all') {
    query = query.eq('contact_status', filters.contactStatus);
  }

  // Priority filter
  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  // Search (customer name)
  if (filters.search) {
    query = query.ilike('customers.company_name', `%${filters.search}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(0, 99); // Safety cap — add proper pagination if list exceeds 100 rows

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch a single service request by ID.
 */
export async function fetchServiceRequest(id) {
  const { data, error } = await supabase
    .from('service_requests')
    .select(REQUEST_DETAIL_SELECT)
    .is('deleted_at', null)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new service request (quick entry from phone call).
 */
export async function createServiceRequest(requestData) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('service_requests')
    .insert([{
      ...requestData,
      created_by: user?.id,
    }])
    .select(REQUEST_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a service request (contact status, priority, region, etc.).
 */
export async function updateServiceRequest({ id, ...updates }) {
  const { data, error } = await supabase
    .from('service_requests')
    .update(updates)
    .eq('id', id)
    .select(REQUEST_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft-delete a service request.
 */
export async function deleteServiceRequest(id) {
  const { error } = await supabase
    .from('service_requests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Update contact status (traffic light) with attempt tracking.
 */
export async function updateContactStatus(id, contactStatus, contactNotes = null) {
  const updates = {
    contact_status: contactStatus,
    last_contact_at: new Date().toISOString(),
  };

  if (contactNotes) {
    updates.contact_notes = contactNotes;
  }

  // Increment contact_attempts for actual contact attempts
  if (contactStatus !== 'cancelled') {
    // Fetch current attempts first
    const { data: current } = await supabase
      .from('service_requests')
      .select('contact_attempts')
      .eq('id', id)
      .single();

    updates.contact_attempts = (current?.contact_attempts || 0) + 1;
  }

  const { data, error } = await supabase
    .from('service_requests')
    .update(updates)
    .eq('id', id)
    .select(REQUEST_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Convert a confirmed request to a work order via RPC.
 * Returns the new work order ID.
 */
export async function convertRequestToWorkOrder(requestId, scheduleData) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('fn_convert_request_to_work_order', {
    p_request_id: requestId,
    p_scheduled_date: scheduleData.scheduled_date,
    p_scheduled_time: scheduleData.scheduled_time || null,
    p_work_type: scheduleData.work_type || null,
    p_notes: scheduleData.notes || null,
    p_user_id: user?.id,
  });

  if (error) throw error;
  return data; // UUID of new work order
}

/**
 * Boomerang a failed request back to the pool via RPC.
 */
export async function boomerangRequest(requestId, failureReason = null) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.rpc('fn_boomerang_failed_request', {
    p_request_id: requestId,
    p_failure_reason: failureReason,
    p_user_id: user?.id,
  });

  if (error) throw error;
}

/**
 * Fetch operations stats via RPC.
 */
export async function fetchOperationsStats(dateFrom, dateTo) {
  const { data, error } = await supabase.rpc('fn_get_operations_stats', {
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });

  if (error) throw error;
  return data;
}

/**
 * Cancel a service request.
 */
export async function cancelServiceRequest(id) {
  const { data, error } = await supabase
    .from('service_requests')
    .update({
      status: 'cancelled',
      contact_status: 'cancelled',
    })
    .eq('id', id)
    .select(REQUEST_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}
