import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

// Query keys
export const assetKeys = {
  all: ['site_assets'],
  lists: () => [...assetKeys.all, 'list'],
  list: (filters) => [...assetKeys.lists(), filters],
  details: () => [...assetKeys.all, 'detail'],
  detail: (id) => [...assetKeys.details(), id],
  bySite: (siteId) => [...assetKeys.all, 'site', siteId],
  byCustomer: (custId) => [...assetKeys.all, 'customer', custId],
  byWorkOrder: (woId) => [...assetKeys.all, 'workOrder', woId],
  history: (assetId) => [...assetKeys.all, 'history', assetId],
};

const ASSET_DETAIL_VIEW = 'site_assets_detail';

// ─── List / Filter ─────────────────────────────────────────

export async function fetchAssets(filters = {}) {
  let query = supabase
    .from(ASSET_DETAIL_VIEW)
    .select('*')
    .order('status', { ascending: true })
    .order('asset_type', { ascending: true })
    .order('installed_at', { ascending: false });

  if (filters.site_id) {
    query = query.eq('site_id', filters.site_id);
  }
  if (filters.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.asset_type) {
    query = query.eq('asset_type', filters.asset_type);
  }
  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(
      `serial_number_search.ilike.%${normalized}%,brand_search.ilike.%${normalized}%,model_search.ilike.%${normalized}%`
    );
  }
  if (filters.dateFrom) {
    query = query.gte('installed_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('installed_at', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchAsset(id) {
  const { data, error } = await supabase
    .from(ASSET_DETAIL_VIEW)
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAssetsBySite(siteId) {
  return fetchAssets({ site_id: siteId });
}

export async function fetchAssetsByCustomer(customerId) {
  return fetchAssets({ customer_id: customerId });
}

export async function fetchAssetsByWorkOrder(workOrderId) {
  const { data, error } = await supabase
    .from('work_order_assets')
    .select('*, site_assets:asset_id(*, customer_sites:site_id(site_name, account_no))')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ─── CRUD ──────────────────────────────────────────────────

export async function createAsset(data) {
  // Clean empty strings to null
  const payload = { ...data };
  for (const key of ['brand', 'model', 'serial_number', 'material_id', 'installed_at', 'location_note', 'warranty_expires_at', 'notes', 'ownership_type', 'subscription_id']) {
    if (payload[key] === '') payload[key] = null;
  }

  const { data: result, error } = await supabase
    .from('site_assets')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return result;
}

export async function bulkCreateAssets(items) {
  // Clean each item
  const cleaned = items.map((item) => {
    const payload = { ...item };
    for (const key of ['brand', 'model', 'serial_number', 'material_id', 'installed_at', 'location_note', 'warranty_expires_at', 'notes', 'ownership_type', 'subscription_id']) {
      if (payload[key] === '') payload[key] = null;
    }
    return payload;
  });

  const { data, error } = await supabase
    .from('site_assets')
    .insert(cleaned)
    .select('*');

  if (error) throw error;
  return data;
}

export async function updateAsset(id, data) {
  const payload = { ...data };
  for (const key of ['brand', 'model', 'serial_number', 'material_id', 'installed_at', 'location_note', 'warranty_expires_at', 'notes', 'ownership_type', 'subscription_id']) {
    if (payload[key] === '') payload[key] = null;
  }

  const { data: result, error } = await supabase
    .from('site_assets')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return result;
}

export async function removeAsset(id, { removed_at, removed_by_work_order_id, replaced_by_asset_id } = {}) {
  const payload = {
    status: replaced_by_asset_id ? 'replaced' : 'removed',
    removed_at: removed_at || new Date().toISOString().split('T')[0],
  };
  if (removed_by_work_order_id) payload.removed_by_work_order_id = removed_by_work_order_id;
  if (replaced_by_asset_id) payload.replaced_by_asset_id = replaced_by_asset_id;

  const { data, error } = await supabase
    .from('site_assets')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAsset(id) {
  const { error } = await supabase
    .from('site_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ─── Work Order ↔ Asset Links ──────────────────────────────

export async function linkAssetToWorkOrder(workOrderId, assetId, action, notes) {
  const { data, error } = await supabase
    .from('work_order_assets')
    .insert({ work_order_id: workOrderId, asset_id: assetId, action, notes })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAssetHistory(assetId) {
  const { data, error } = await supabase
    .from('work_order_assets')
    .select('*, work_orders:work_order_id(id, form_no, work_type, status, scheduled_date, completed_at)')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
