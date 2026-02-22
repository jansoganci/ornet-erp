import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

export async function fetchWorkOrders(filters = {}) {
  let query = supabase
    .from('work_orders_detail')
    .select('*');

  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(`company_name_search.ilike.%${normalized}%,account_no_search.ilike.%${normalized}%,form_no_search.ilike.%${normalized}%`);
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.work_type && filters.work_type !== 'all') {
    query = query.eq('work_type', filters.work_type);
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
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchWorkOrder(id) {
  const { data, error } = await supabase
    .from('work_orders_detail')
    .select('*, work_order_materials(*, materials(code, name, description, unit))')
    .eq('id', id)
    .order('sort_order', { ascending: true, foreignTable: 'work_order_materials' })
    .single();

  if (error) throw error;
  return data;
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
    const materialRows = items.map((item, index) => ({
      work_order_id: created.id,
      sort_order: index,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'adet',
      unit_price: item.unit_price ?? 0,
      cost: item.cost ?? null,
      material_id: item.material_id || null,
    }));
    const { error: mError } = await supabase.from('work_order_materials').insert(materialRows);
    if (mError) throw mError;
  }

  return created;
}

export async function updateWorkOrder({ id, items, materials_discount_percent, ...data }) {
  const updatePayload = { ...data };
  if (materials_discount_percent !== undefined) {
    updatePayload.materials_discount_percent = materials_discount_percent;
  }

  const { data: updated, error } = await supabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  if (items !== undefined) {
    await supabase.from('work_order_materials').delete().eq('work_order_id', id);
    if (items.length > 0) {
      const materialRows = items.map((item, index) => ({
        work_order_id: id,
        sort_order: index,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'adet',
        unit_price: item.unit_price ?? 0,
        cost: item.cost ?? null,
        material_id: item.material_id || null,
      }));
      const { error: mError } = await supabase.from('work_order_materials').insert(materialRows);
      if (mError) throw mError;
    }
  }

  return updated;
}

export async function deleteWorkOrder(id) {
  if (!id) throw new Error('Work order id is required');

  const { error } = await supabase
    .from('work_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

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
    .select('*, materials(*)')
    .eq('work_order_id', workOrderId);

  if (error) throw error;
  return data;
}

export async function fetchWorkOrdersBySite(siteId) {
  const { data, error } = await supabase
    .from('work_orders_detail')
    .select('*')
    .eq('site_id', siteId)
    .order('scheduled_date', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchWorkOrdersByCustomer(customerId) {
  const { data, error } = await supabase
    .from('work_orders_detail')
    .select('*')
    .eq('customer_id', customerId)
    .order('scheduled_date', { ascending: false });

  if (error) throw error;
  return data;
}
