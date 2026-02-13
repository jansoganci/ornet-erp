import { supabase } from '../../lib/supabase';

export const materialKeys = {
  all: ['materials'],
  lists: () => [...materialKeys.all, 'list'],
  list: (filters) => [...materialKeys.lists(), filters],
  active: () => [...materialKeys.lists(), { active: true }],
  details: () => [...materialKeys.all, 'detail'],
  detail: (id) => [...materialKeys.details(), id],
  categories: () => [...materialKeys.all, 'categories'],
};

export async function fetchMaterials(filters = {}) {
  let query = supabase
    .from('materials')
    .select('*')
    .order('name', { ascending: true });

  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.active !== undefined) {
    query = query.eq('is_active', filters.active);
  }
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchActiveMaterials() {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

export async function fetchMaterial(id) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
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
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchMaterialCategories() {
  const { data, error } = await supabase
    .from('materials')
    .select('category')
    .not('category', 'is', null);

  if (error) throw error;

  // Return unique categories
  return [...new Set(data.map(item => item.category))].sort();
}

export async function bulkUpsertMaterials(rows) {
  const { data, error } = await supabase
    .from('materials')
    .upsert(rows, { onConflict: 'code' })
    .select();

  if (error) throw error;
  return data;
}
