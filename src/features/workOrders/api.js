import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export async function fetchWorkOrders(filters = {}) {
  let query = supabase
    .from('work_orders_detail')
    .select('*');

  if (filters.search) {
    query = query.or(`company_name.ilike.%${filters.search}%,account_no.ilike.%${filters.search}%,form_no.ilike.%${filters.search}%`);
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.work_type && filters.work_type !== 'all') {
    query = query.eq('work_type', filters.work_type);
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

  if (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }

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
  console.log('[WORK_ORDER_DELETE_API] 1. Başladı, id:', id, 'tip:', typeof id);
  if (!id) {
    console.error('[WORK_ORDER_DELETE_API] id yok, çıkıyorum');
    throw new Error('Work order id is required');
  }

  // Delete materials first (some setups may not CASCADE)
  const { error: materialsError } = await supabase
    .from('work_order_materials')
    .delete()
    .eq('work_order_id', id);

  console.log('[WORK_ORDER_DELETE_API] 2. work_order_materials silindi, hata:', materialsError?.message || 'yok');

  if (materialsError) {
    console.error('[WORK_ORDER_DELETE_API] materialsError:', materialsError);
    throw materialsError;
  }

  const { data: deletedRows, error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', id)
    .select('id');

  console.log('[WORK_ORDER_DELETE_API] 3. work_orders delete sonucu, hata:', error?.message || 'yok', 'silinen satır sayısı:', deletedRows?.length ?? 0);

  if (error) {
    console.error('[WORK_ORDER_DELETE_API] work_orders error (tam obje):', JSON.stringify(error, null, 2));
    throw error;
  }

  // RLS izin vermezse Supabase hata fırlatmayabilir, 0 satır silinir
  if (!deletedRows || deletedRows.length === 0) {
    const permissionError = new Error('DELETE_PERMISSION_DENIED');
    permissionError.code = 'DELETE_PERMISSION_DENIED';
    throw permissionError;
  }

  console.log('[WORK_ORDER_DELETE_API] 4. Silme tamamlandı, id:', id);
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
