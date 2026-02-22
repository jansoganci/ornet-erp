import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

export const materialKeys = {
  all: ['materials'],
  lists: () => [...materialKeys.all, 'list'],
  list: (filters) => [...materialKeys.lists(), filters],
  active: () => [...materialKeys.lists(), { active: true }],
  details: () => [...materialKeys.all, 'detail'],
  detail: (id) => [...materialKeys.details(), id],
  usage: (id) => [...materialKeys.details(), 'usage', id],
  categories: () => [...materialKeys.all, 'categories'],
};

export async function fetchMaterials(filters = {}) {
  let query = supabase
    .from('materials')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.active !== undefined) {
    query = query.eq('is_active', filters.active);
  }
  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(`name_search.ilike.%${normalized}%,code_search.ilike.%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchActiveMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchMaterial(id) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .is('deleted_at', null)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createMaterial(data) {
  const { data: result, error } = await supabase
    .from('materials')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateMaterial(id, data) {
  const { data: result, error } = await supabase
    .from('materials')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteMaterial(id) {
  const { error } = await supabase
    .from('materials')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Fetch usage history for a material (work orders where it was used).
 * Returns flattened rows: customer, site, work order, date, status.
 */
export async function fetchMaterialUsageHistory(materialId) {
  if (!materialId) return [];

  const { data, error } = await supabase
    .from('work_order_materials')
    .select(
      `
      id,
      quantity,
      description,
      work_orders!inner (
        id,
        form_no,
        work_type,
        status,
        scheduled_date,
        completed_at,
        deleted_at,
        customer_sites (
          site_name,
          account_no,
          customers (
            company_name
          )
        )
      )
    `
    )
    .eq('material_id', materialId)
    .not('material_id', 'is', null);

  if (error) throw error;

  const rows = data ?? [];
  return rows
    .filter((row) => row.work_orders && !row.work_orders.deleted_at)
    .map((row) => {
      const wo = row.work_orders;
      const cs = wo.customer_sites;
      const cust = cs?.customers;
      return {
        id: row.id,
        quantity: row.quantity,
        description: row.description,
        work_order_id: wo.id,
        form_no: wo.form_no,
        work_type: wo.work_type,
        status: wo.status,
        scheduled_date: wo.scheduled_date,
        completed_at: wo.completed_at,
        site_name: cs?.site_name ?? '',
        account_no: cs?.account_no ?? '',
        company_name: cust?.company_name ?? '',
      };
    })
    .sort((a, b) => {
      const dateA = a.completed_at || a.scheduled_date || '';
      const dateB = b.completed_at || b.scheduled_date || '';
      return dateB.localeCompare(dateA);
    });
}

export async function fetchMaterialCategories() {
  const { data, error } = await supabase
    .from('materials')
    .select('category')
    .is('deleted_at', null)
    .not('category', 'is', null);

  if (error) throw error;

  // Return unique categories
  return [...new Set(data.map(item => item.category))].sort();
}

export async function bulkUpsertMaterials(rows) {
  // The full unique constraint on `code` was replaced by a partial unique index
  // (WHERE deleted_at IS NULL) in migration 00086, so ON CONFLICT (code) upsert
  // no longer works. Fetch existing active records and split into update/insert.
  const codes = rows.map((r) => r.code);
  const { data: existing, error: fetchError } = await supabase
    .from('materials')
    .select('id, code')
    .is('deleted_at', null)
    .in('code', codes);

  if (fetchError) throw fetchError;

  const existingMap = new Map((existing || []).map((r) => [r.code, r.id]));
  const toUpdate = rows.filter((r) => existingMap.has(r.code));
  const toInsert = rows.filter((r) => !existingMap.has(r.code));

  const results = [];

  for (const row of toUpdate) {
    const { data, error } = await supabase
      .from('materials')
      .update(row)
      .eq('id', existingMap.get(row.code))
      .select()
      .single();
    if (error) throw error;
    results.push(data);
  }

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('materials')
      .insert(toInsert)
      .select();
    if (error) throw error;
    results.push(...data);
  }

  return results;
}
