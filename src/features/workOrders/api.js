import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';
import { resolveProposalItemCost, resolveProposalItemUnitPrice } from '../../lib/proposalCalc';

/**
 * Dual-column model for work_order_materials (same idea as proposal_items):
 * USD → unit_price_usd + cost_usd (TRY columns zero/null); TRY → unit_price + cost (USD columns zero/null).
 * Inserting only unit_price for a USD WO breaks resolveProposalItemUnitPrice() (reads unit_price_usd first).
 */
function splitWorkOrderMaterialAmounts(currency, unitPrice, cost) {
  const cur = (currency || 'TRY').toUpperCase();
  const price = Number(unitPrice);
  const safePrice = Number.isFinite(price) ? price : 0;
  let c = null;
  if (cost !== null && cost !== undefined && cost !== '') {
    const n = Number(cost);
    if (Number.isFinite(n)) c = n;
  }

  if (cur === 'USD') {
    return {
      unit_price: 0,
      unit_price_usd: safePrice,
      cost: null,
      cost_usd: c,
    };
  }
  return {
    unit_price: safePrice,
    unit_price_usd: 0,
    cost: c,
    cost_usd: null,
  };
}

/** Subset of work_orders_detail for list/calendar/combobox/scoped lists (keeps UI fields used in those surfaces). */
export const WO_LIST_SELECT = [
  'id',
  'site_id',
  'form_no',
  'work_type',
  'status',
  'priority',
  'scheduled_date',
  'scheduled_time',
  'description',
  'amount',
  'currency',
  'assigned_workers',
  'account_no',
  'site_name',
  'site_address',
  'city',
  'district',
  'company_name',
].join(',');

/** Full selection for work order detail view. */
export const WO_DETAIL_SELECT = `
  *,
  work_order_materials (
    id, work_order_id, sort_order, description, quantity, unit, material_id,
    unit_price, unit_price_usd,
    cost, cost_usd,
    materials ( code, name, description, unit )
  )
`.replace(/\s+/g, ' ').trim();

const WO_LIST_FETCH_LIMIT = 150;

export async function fetchWorkOrders(filters = {}) {
  let query = supabase
    .from('work_orders_detail')
    .select(WO_LIST_SELECT);

  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(`company_name_search.ilike.%${normalized}%,account_no_search.ilike.%${normalized}%,form_no_search.ilike.%${normalized}%`);
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const workType = filters.work_type ?? filters.type;
  if (workType && workType !== 'all') {
    query = query.eq('work_type', workType);
  }

  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  if (filters.dateFrom) {
    query = query.gte('scheduled_date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('scheduled_date', filters.dateTo);
  }

  const { data, error } = await query
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(WO_LIST_FETCH_LIMIT);

  if (error) throw error;
  return data;
}

export async function fetchWorkOrdersPaginated(filters = {}, page = 0, pageSize = 50) {
  let query = supabase
    .from('work_orders_detail')
    .select(WO_LIST_SELECT, { count: 'exact' });

  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(`company_name_search.ilike.%${normalized}%,account_no_search.ilike.%${normalized}%,form_no_search.ilike.%${normalized}%`);
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  const paginatedWorkType = filters.work_type ?? filters.type;
  if (paginatedWorkType && paginatedWorkType !== 'all') {
    query = query.eq('work_type', paginatedWorkType);
  }

  if (filters.priority && filters.priority !== 'all') {
    query = query.eq('priority', filters.priority);
  }

  if (filters.dateFrom) {
    query = query.gte('scheduled_date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('scheduled_date', filters.dateTo);
  }

  // Year + month filter on scheduled_date (server-side)
  if (filters.year && filters.year !== 'all') {
    query = query
      .gte('scheduled_date', `${filters.year}-01-01`)
      .lte('scheduled_date', `${filters.year}-12-31`);
  }
  if (filters.month && filters.month !== 'all') {
    const m = String(filters.month).padStart(2, '0');
    const year = filters.year && filters.year !== 'all' ? filters.year : new Date().getFullYear();
    const nextMonth = Number(m) === 12
      ? `${Number(year) + 1}-01`
      : `${year}-${String(Number(m) + 1).padStart(2, '0')}`;
    query = query
      .gte('scheduled_date', `${year}-${m}-01`)
      .lt('scheduled_date', `${nextMonth}-01`);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order('scheduled_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function fetchWorkOrder(id) {
  const { data, error } = await supabase
    .from('work_orders_detail')
    .select(WO_DETAIL_SELECT)
    .eq('id', id)
    .order('sort_order', { ascending: true, foreignTable: 'work_order_materials' })
    .single();

  if (error) throw error;
  return data;
}

const WORK_ORDER_AUDIT_LIMIT = 50;

/**
 * Audit timeline for a work order. RLS: audit_select_work_orders + admin audit_select.
 */
export async function fetchWorkOrderAuditLogs(workOrderId) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(
      `
      id,
      action,
      old_values,
      new_values,
      user_id,
      description,
      created_at,
      profiles ( full_name )
    `
    )
    .eq('table_name', 'work_orders')
    .eq('record_id', workOrderId)
    .order('created_at', { ascending: false })
    .limit(WORK_ORDER_AUDIT_LIMIT);

  if (error) throw error;
  return data ?? [];
}

export async function createWorkOrder(data) {
  const { items, materials_discount_percent, ...workOrderData } = data;

  const payload = {
    ...workOrderData,
    materials_discount_percent: materials_discount_percent ?? 0,
  };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  payload.created_by = user.id;

  const { data: created, error } = await supabase
    .from('work_orders')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  if (items && items.length > 0) {
    const cur = payload.currency || 'TRY';
    const materialRows = items.map((item, index) => ({
      work_order_id: created.id,
      sort_order: index,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'adet',
      material_id: item.material_id || null,
      ...splitWorkOrderMaterialAmounts(cur, item.unit_price ?? 0, item.cost),
    }));
    const { error: mError } = await supabase.from('work_order_materials').insert(materialRows);
    if (mError) throw mError;
  }

  return created;
}

/**
 * Create a work order from a proposal: insert work order, copy items to work_order_materials,
 * link via proposal_work_orders, set work_orders.proposal_id.
 * @returns {Promise<{ id: string }>} The new work order (with id)
 */
export async function createWorkOrderFromProposal({
  proposalId,
  siteId,
  workType,
  scheduledDate = null,
  scheduledTime = null,
  assignedTo = [],
  amount = null,
  currency = 'TRY',
  materialsDiscountPercent = 0,
  vatRate = 20,
  hasTevkifat = false,
  description = null,
  notes = null,
  items = [],
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const workOrderPayload = {
    site_id: siteId,
    work_type: workType,
    status: 'pending',
    priority: 'normal',
    scheduled_date: scheduledDate || null,
    scheduled_time: scheduledTime || null,
    assigned_to: Array.isArray(assignedTo) && assignedTo.length > 0 ? assignedTo.filter(Boolean) : [],
    amount: amount != null ? parseFloat(amount) : null,
    currency: currency || 'TRY',
    materials_discount_percent: materialsDiscountPercent ?? 0,
    vat_rate: vatRate ?? 20,
    has_tevkifat: !!hasTevkifat,
    description: description?.trim() || null,
    notes: notes?.trim() || null,
    created_by: user.id,
  };

  const { data: created, error } = await supabase
    .from('work_orders')
    .insert(workOrderPayload)
    .select('id')
    .single();

  if (error) throw error;

  const rowCurrency = currency || 'TRY';

  if (items && items.length > 0) {
    const materialRows = items.map((item, index) => {
      const resolvedPrice = resolveProposalItemUnitPrice(item, rowCurrency);
      const hasCost = item.cost != null || item.cost_usd != null;
      const resolvedCost = hasCost ? resolveProposalItemCost(item, rowCurrency) : null;
      return {
        work_order_id: created.id,
        sort_order: item.sort_order ?? index,
        description: item.description ?? '',
        quantity: item.quantity ?? 1,
        unit: item.unit || 'adet',
        material_id: item.material_id || null,
        ...splitWorkOrderMaterialAmounts(rowCurrency, resolvedPrice, resolvedCost),
      };
    });
    const { error: mError } = await supabase.from('work_order_materials').insert(materialRows);
    if (mError) throw mError;
  }

  const { error: junctionError } = await supabase
    .from('proposal_work_orders')
    .insert({ proposal_id: proposalId, work_order_id: created.id });

  if (junctionError) throw junctionError;

  const { error: updateError } = await supabase
    .from('work_orders')
    .update({ proposal_id: proposalId })
    .eq('id', created.id);

  if (updateError) throw updateError;

  return { ...created, id: created.id };
}

export async function updateWorkOrder({ id, items, materials_discount_percent, ...data }) {
  const updatePayload = { ...data };
  if (materials_discount_percent !== undefined) {
    updatePayload.materials_discount_percent = materials_discount_percent;
  }

  // DEBUG: Log payload to verify vat_rate and has_tevkifat are included
  console.log('🔍 updateWorkOrder payload:', {
    id,
    vat_rate: updatePayload.vat_rate,
    has_tevkifat: updatePayload.has_tevkifat,
    scheduled_date: updatePayload.scheduled_date,
    scheduled_time: updatePayload.scheduled_time,
    fullPayload: updatePayload,
  });

  const { data: updated, error } = await supabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  console.log('✅ updateWorkOrder result:', { updated, error });

  if (error) throw error;

  if (items !== undefined) {
    await supabase.from('work_order_materials').delete().eq('work_order_id', id);
    if (items.length > 0) {
      const cur = data.currency || updated.currency || 'TRY';
      const materialRows = items.map((item, index) => ({
        work_order_id: id,
        sort_order: index,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'adet',
        material_id: item.material_id || null,
        ...splitWorkOrderMaterialAmounts(cur, item.unit_price ?? 0, item.cost),
      }));
      const { error: mError } = await supabase.from('work_order_materials').insert(materialRows);
      if (mError) throw mError;
    }
  }

  return updated;
}

export async function deleteWorkOrder(id) {
  if (!id) throw new Error('Work order id is required');

  const { error } = await supabase.rpc('soft_delete_work_order', { p_id: id });

  if (error) throw error;

  return { id };
}

export async function fetchDailyWorkList(date, workerId) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_daily_work_list', {
    target_date: date,
    worker_id: workerId || null
  });
  if (error) throw error;
  return data;
}

export async function fetchWorkOrderMaterials(workOrderId) {
  const { data, error } = await supabase
    .from('work_order_materials')
    .select(`
      id, work_order_id, sort_order, description, quantity, unit, material_id,
      unit_price, unit_price_usd,
      cost, cost_usd,
      materials(*)
    `)
    .eq('work_order_id', workOrderId);

  if (error) throw error;
  return data;
}

export async function fetchWorkOrdersBySite(siteId) {
  const { data, error } = await supabase
    .from('work_orders_detail')
    .select(WO_LIST_SELECT)
    .eq('site_id', siteId)
    .order('scheduled_date', { ascending: false })
    .limit(WO_LIST_FETCH_LIMIT);

  if (error) throw error;
  return data;
}

export async function fetchWorkOrdersByCustomer(customerId) {
  const { data, error } = await supabase
    .from('work_orders_detail')
    .select(WO_LIST_SELECT)
    .eq('customer_id', customerId)
    .order('scheduled_date', { ascending: false })
    .limit(WO_LIST_FETCH_LIMIT);

  if (error) throw error;
  return data;
}
