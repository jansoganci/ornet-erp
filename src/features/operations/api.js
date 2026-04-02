import { supabase } from '../../lib/supabase';

// Query keys
export const operationsItemKeys = {
  all: ['operations_items'],
  lists: () => [...operationsItemKeys.all, 'list'],
  list: (filters) => [...operationsItemKeys.lists(), filters],
  details: () => [...operationsItemKeys.all, 'detail'],
  detail: (id) => [...operationsItemKeys.details(), id],
  stats: (filters) => [...operationsItemKeys.all, 'stats', filters],
};

/** Alias for React Query invalidation (matches common `*.keys.all` naming). */
export const operationsApi = { keys: operationsItemKeys };

// Lightweight SELECT for operations pool (list view) — only columns displayed on cards
const POOL_SELECT = `
  id, customer_id, site_id, work_type, description, status, contact_status,
  priority, region, created_at, created_by, work_order_id, outcome_type,
  customers ( id, company_name, phone ),
  customer_sites ( id, site_name, account_no, city, district, contact_phone ),
  profiles!created_by ( full_name ),
  work_orders ( id, form_no, status )
`;

// Full SELECT for detail view — includes all fields
const ITEM_DETAIL_SELECT = `
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
export async function fetchOperationsItems(filters = {}) {
  let query = supabase
    .from('operations_items')
    .select(POOL_SELECT)
    .is('deleted_at', null);

  // Status: multi-value (pool + archive), single eq, or default open
  if (Array.isArray(filters.statusIn) && filters.statusIn.length > 0) {
    query = query.in('status', filters.statusIn);
  } else if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters.status && !filters.statusIn) {
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
 * Fetch a single operations item by ID.
 */
export async function fetchOperationsItem(id) {
  const { data, error } = await supabase
    .from('operations_items')
    .select(ITEM_DETAIL_SELECT)
    .is('deleted_at', null)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new operations item (quick entry from phone call).
 */
export async function createOperationsItem(requestData) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('operations_items')
    .insert([{
      ...requestData,
      created_by: user?.id,
    }])
    .select(ITEM_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an operations item (contact status, priority, region, etc.).
 */
export async function updateOperationsItem({ id, ...updates }) {
  const { data, error } = await supabase
    .from('operations_items')
    .update(updates)
    .eq('id', id)
    .select(ITEM_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft-delete an operations item.
 */
export async function deleteOperationsItem(id) {
  const { error } = await supabase.rpc('soft_delete_operations_item', { p_id: id });

  if (error) throw error;
  return { success: true };
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
      .from('operations_items')
      .select('contact_attempts')
      .eq('id', id)
      .single();

    updates.contact_attempts = (current?.contact_attempts || 0) + 1;
  }

  const { data, error } = await supabase
    .from('operations_items')
    .update(updates)
    .eq('id', id)
    .select(ITEM_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Convert a confirmed operations item to a work order via RPC.
 * Returns the new work order ID.
 */
export async function convertItemToWorkOrder(itemId, scheduleData) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('fn_convert_item_to_work_order', {
    p_item_id: itemId,
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
 * Boomerang a failed operations item back to the pool via RPC.
 */
export async function boomerangItem(itemId, failureReason = null) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.rpc('fn_boomerang_failed_item', {
    p_item_id: itemId,
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
 * Cancel an operations item.
 */
export async function cancelOperationsItem(id) {
  const { data, error } = await supabase
    .from('operations_items')
    .update({
      status: 'closed',
      outcome_type: 'cancelled',
    })
    .eq('id', id)
    .select(ITEM_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Close an operations item with an explicit outcome.
 */
export async function closeOperationsItem(id, outcomeType, contactNotes = null) {
  const updates = {
    status: 'closed',
    outcome_type: outcomeType,
  };

  if (contactNotes) {
    updates.contact_notes = contactNotes;
  }

  const { data, error } = await supabase
    .from('operations_items')
    .update(updates)
    .eq('id', id)
    .select(ITEM_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}
