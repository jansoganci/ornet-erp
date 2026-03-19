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
};

const ASSET_DETAIL_VIEW = 'site_assets_detail';

// ─── List / Filter ─────────────────────────────────────────

export async function fetchAssets(filters = {}) {
  let query = supabase
    .from(ASSET_DETAIL_VIEW)
    .select('*')
    .order('company_name', { ascending: true })
    .order('site_name', { ascending: true })
    .order('equipment_name', { ascending: true });

  if (filters.site_id) {
    query = query.eq('site_id', filters.site_id);
  }
  if (filters.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }
  if (filters.subscription_status) {
    if (filters.subscription_status === 'none') {
      query = query.is('subscription_status', null);
    } else {
      query = query.eq('subscription_status', filters.subscription_status);
    }
  }
  if (filters.search) {
    const normalized = normalizeForSearch(filters.search);
    query = query.or(
      `company_name.ilike.%${normalized}%,account_no.ilike.%${normalized}%,equipment_name.ilike.%${normalized}%`
    );
  }
  if (filters.dateFrom) {
    query = query.gte('installation_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('installation_date', filters.dateTo);
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

// ─── CRUD ──────────────────────────────────────────────────

export async function createAsset(data) {
  const payload = {
    site_id: data.site_id,
    equipment_name: data.equipment_name?.trim() || null,
    quantity: data.quantity ?? 1,
    installation_date: data.installation_date || null,
  };

  const { data: result, error } = await supabase
    .from('site_assets')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return result;
}

export async function bulkCreateAssets(items) {
  const payload = items.map((item) => ({
    site_id: item.site_id,
    equipment_name: item.equipment_name?.trim() || '',
    quantity: item.quantity ?? 1,
    installation_date: item.installation_date || null,
  }));

  const { data, error } = await supabase.rpc('fn_upsert_site_assets_batch', {
    p_items: payload,
  });

  if (error) throw error;
  return { count: data?.count ?? items.length };
}

export async function updateAsset(id, data) {
  const payload = {
    equipment_name: data.equipment_name?.trim() ?? undefined,
    quantity: data.quantity ?? undefined,
    installation_date: data.installation_date || null,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { data: result, error } = await supabase
    .from('site_assets')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return result;
}

export async function deleteAsset(id) {
  const { error } = await supabase.from('site_assets').delete().eq('id', id);

  if (error) throw error;
}

/**
 * Fetch sites by list of account numbers. Returns map account_no -> { id, site_name, ... }.
 * When multiple sites share the same account_no, the last one wins (no disambiguation).
 */
export async function fetchSitesByAccountNos(accountNos) {
  if (!accountNos?.length) return {};
  const unique = [...new Set(accountNos.filter(Boolean))];
  const { data, error } = await supabase
    .from('customer_sites')
    .select('id, account_no, site_name')
    .is('deleted_at', null)
    .in('account_no', unique);

  if (error) throw error;
  const map = {};
  for (const s of data || []) {
    map[s.account_no] = s;
  }
  return map;
}

/**
 * Resolve site_id for each asset import row. Handles duplicate ACC numbers by
 * using company_name (MÜŞTERİ) when multiple sites share the same account_no.
 *
 * @param {Array<{account_no, company_name?}>} rows - Rows from validateAndMapRows
 * @returns {{ rowToSite: Map<number, {id, site_name}>, unresolvedIndices: Set<number> }}
 */
export async function resolveSitesForAssetRows(rows) {
  const rowToSite = new Map();
  const unresolvedIndices = new Set();

  if (!rows?.length) return { rowToSite, unresolvedIndices };

  const accountNos = [...new Set(rows.map((r) => r.account_no).filter(Boolean))];
  if (!accountNos.length) {
    rows.forEach((_, i) => unresolvedIndices.add(i));
    return { rowToSite, unresolvedIndices };
  }

  const { data: sites, error } = await supabase
    .from('customer_sites')
    .select('id, account_no, site_name, customer_id, customers!inner(company_name)')
    .is('deleted_at', null)
    .in('account_no', accountNos);

  if (error) throw error;

  const byAcc = new Map();
  for (const s of sites || []) {
    const acc = s.account_no;
    if (!byAcc.has(acc)) byAcc.set(acc, []);
    byAcc.get(acc).push({
      id: s.id,
      site_name: s.site_name,
      company_name: s.customers?.company_name?.trim() || '',
    });
  }

  rows.forEach((row, i) => {
    const acc = row.account_no;
    if (!acc) {
      unresolvedIndices.add(i);
      return;
    }

    const candidates = byAcc.get(acc);
    if (!candidates?.length) {
      unresolvedIndices.add(i);
      return;
    }

    if (candidates.length === 1) {
      rowToSite.set(i, { id: candidates[0].id, site_name: candidates[0].site_name });
      return;
    }

    const rowCompany = (row.company_name || '').trim();
    if (rowCompany) {
      const normRow = normalizeForSearch(rowCompany);
      const match = candidates.find((c) => normalizeForSearch(c.company_name) === normRow);
      if (match) {
        rowToSite.set(i, { id: match.id, site_name: match.site_name });
        return;
      }
    }

    unresolvedIndices.add(i);
  });

  return { rowToSite, unresolvedIndices };
}
