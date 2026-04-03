import { supabase } from '../../lib/supabase';
import { normalizeForSearch } from '../../lib/normalizeForSearch';

const DATE_FIELDS = ['proposal_date', 'survey_date', 'installation_date', 'completion_date'];

function sanitizeDates(data) {
  const result = { ...data };
  for (const field of DATE_FIELDS) {
    if (result[field] === '' || result[field] === undefined) {
      result[field] = null;
    }
  }
  return result;
}

/** Empty string is not a valid UUID for Postgres; coalesce to null for optional FK columns. */
function coalesceUuid(value) {
  if (value == null || value === '') return null;
  return value;
}

function toFiniteNumber(value, fallback = 0) {
  if (value === '' || value === undefined || value === null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(value) {
  if (value === '' || value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build one proposal_items row for insert (numbers + nulls safe for PostgREST / Postgres).
 */
function buildProposalItemInsertRow(proposalId, item, sortOrder, currency) {
  const _currency = currency || 'USD';
  const qty = toFiniteNumber(item.quantity, 1);
  const quantity = qty > 0 ? qty : 1;
  const unitPrice = toFiniteNumber(item.unit_price, 0);
  const cost = toNullableNumber(item.cost);
  const description = String(item.description ?? '').trim() || '—';
  const unit = (item.unit && String(item.unit).trim()) || 'adet';
  const marginPercent = toNullableNumber(item.margin_percent);

  const productCost = toNullableNumber(item.product_cost);
  const laborCost = toNullableNumber(item.labor_cost);
  const shippingCost = toNullableNumber(item.shipping_cost);
  const materialCost = toNullableNumber(item.material_cost);
  const miscCost = toNullableNumber(item.misc_cost);

  return {
    proposal_id: proposalId,
    sort_order: sortOrder,
    description,
    quantity,
    unit,
    unit_price: _currency === 'USD' ? 0 : unitPrice,
    unit_price_usd: _currency === 'USD' ? unitPrice : 0,
    material_id: coalesceUuid(item.material_id),
    cost: _currency === 'USD' ? null : cost,
    cost_usd: _currency === 'USD' ? cost : null,
    margin_percent: marginPercent,
    product_cost: _currency === 'USD' ? null : productCost,
    product_cost_usd: _currency === 'USD' ? productCost : null,
    labor_cost: _currency === 'USD' ? null : laborCost,
    labor_cost_usd: _currency === 'USD' ? laborCost : null,
    shipping_cost: _currency === 'USD' ? null : shippingCost,
    shipping_cost_usd: _currency === 'USD' ? shippingCost : null,
    material_cost: _currency === 'USD' ? null : materialCost,
    material_cost_usd: _currency === 'USD' ? materialCost : null,
    misc_cost: _currency === 'USD' ? null : miscCost,
    misc_cost_usd: _currency === 'USD' ? miscCost : null,
  };
}

function lineTotalForProposalItem(item) {
  return toFiniteNumber(item.quantity, 1) * toFiniteNumber(item.unit_price, 0);
}

const ANNUAL_FIXED_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);

function normalizeAnnualFixedCurrency(value) {
  const c = String(value ?? 'TRY').toUpperCase();
  return ANNUAL_FIXED_CURRENCIES.has(c) ? c : 'TRY';
}

/** Rows to persist: non-empty description after trim. */
export function filterPersistableAnnualFixedRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => String(row?.description ?? '').trim().length > 0);
}

function buildAnnualFixedInsertRow(proposalId, item, sortOrder) {
  const qty = toFiniteNumber(item.quantity, 1);
  const quantity = qty > 0 ? qty : 1;
  const unitPrice = toFiniteNumber(item.unit_price, 0);
  const description = String(item.description ?? '').trim() || '—';
  const unit = String(item.unit ?? 'adet').trim() || 'adet';
  const currency = normalizeAnnualFixedCurrency(item.currency);

  return {
    proposal_id: proposalId,
    sort_order: sortOrder,
    description,
    quantity,
    unit,
    unit_price: unitPrice,
    currency,
  };
}

export async function fetchProposalAnnualFixedCosts(proposalId) {
  const { data, error } = await supabase
    .from('proposal_annual_fixed_costs')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateProposalAnnualFixedCosts(proposalId, rows) {
  const { error: deleteError } = await supabase
    .from('proposal_annual_fixed_costs')
    .delete()
    .eq('proposal_id', proposalId);

  if (deleteError) throw deleteError;

  const toInsert = filterPersistableAnnualFixedRows(rows || []);
  if (toInsert.length > 0) {
    const payload = toInsert.map((row, index) =>
      buildAnnualFixedInsertRow(proposalId, row, index),
    );
    const { error: insertError } = await supabase.from('proposal_annual_fixed_costs').insert(payload);
    if (insertError) throw insertError;
  }

  return { success: true };
}

/**
 * Targeted selection for proposal list views to improve performance.
 */
export const PROPOSAL_LIST_SELECT = `
  id, proposal_no, title, status, created_at, 
  customer_company_name, company_name, site_name, city, 
  total_amount, total_amount_usd, currency, 
  sent_at, accepted_at, rejected_at
`.replace(/\s+/g, ' ').trim();

/**
 * Fetch all proposals with optional filters
 */
export async function fetchProposals({ search = '', status = '', dateFrom = '', dateTo = '', year, month } = {}) {
  let query = supabase
    .from('proposals_detail')
    .select(PROPOSAL_LIST_SELECT)
    .order('created_at', { ascending: false });

  if (search) {
    const normalized = normalizeForSearch(search);
    query = query.or(
      `title_search.ilike.%${normalized}%,customer_company_name_search.ilike.%${normalized}%,proposal_no_search.ilike.%${normalized}%`
    );
  }

  if (status) {
    if (status.includes(',')) {
      query = query.in('status', status.split(','));
    } else {
      query = query.eq('status', status);
    }
  }

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo + 'T23:59:59');
  }

  if (year) {
    query = query.gte('created_at', `${year}-01-01`).lte('created_at', `${year}-12-31T23:59:59`);
  }
  if (month) {
    const m = String(month).padStart(2, '0');
    const y = year || new Date().getFullYear();
    const lastDay = new Date(y, Number(m), 0).getDate();
    query = query.gte('created_at', `${y}-${m}-01`).lte('created_at', `${y}-${m}-${lastDay}T23:59:59`);
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return data;
}

/**
 * Targeted selection for proposal detail views to improve performance.
 */
export const PROPOSAL_DETAIL_SELECT = `
  *
`.replace(/\s+/g, ' ').trim();

/**
 * Fetch a single proposal by ID
 */
export async function fetchProposal(id) {
  const { data, error } = await supabase
    .from('proposals_detail')
    .select(PROPOSAL_DETAIL_SELECT)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch items for a proposal (with material description for PDF)
 */
export async function fetchProposalItems(proposalId) {
  const { data, error } = await supabase
    .from('proposal_items')
    .select(`
      id, proposal_id, sort_order, description, quantity, unit, material_id,
      unit_price, unit_price_usd,
      cost, cost_usd,
      product_cost, product_cost_usd,
      labor_cost, labor_cost_usd,
      shipping_cost, shipping_cost_usd,
      material_cost, material_cost_usd,
      misc_cost, misc_cost_usd,
      margin_percent, line_total, total_usd,
      materials(code, name, description)
    `)
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Create a new proposal with items
 */
export async function createProposal({ items, annual_fixed_costs: annualFixedCosts, ...proposalData }) {
  // Generate proposal number
  const { data: noResult, error: noError } = await supabase.rpc('generate_proposal_no');
  if (noError) throw noError;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  const payload = sanitizeDates({
    ...proposalData,
    proposal_no: noResult,
    created_by: user?.id,
    currency: proposalData.currency || 'USD',
    total_amount: 0,
    total_amount_usd: 0,
  });
  if (payload.site_id === '' || payload.site_id == null) {
    payload.site_id = null;
  }

  // DEBUG: Log proposal payload to verify vat_rate and has_tevkifat
  console.log('🔍 createProposal payload:', {
    vat_rate: payload.vat_rate,
    has_tevkifat: payload.has_tevkifat,
    currency: payload.currency,
    fullPayload: payload,
  });

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert(payload)
    .select(PROPOSAL_DETAIL_SELECT)
    .single();

  console.log('✅ createProposal result:', { proposal, error: proposalError });

  if (proposalError) throw proposalError;

  if (items?.length > 0) {
    const _currency = proposalData.currency || 'USD';
    const itemsToInsert = items.map((item, index) =>
      buildProposalItemInsertRow(proposal.id, item, index, _currency),
    );

    const { error: itemsError } = await supabase
      .from('proposal_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    const total = items.reduce((sum, i) => sum + lineTotalForProposalItem(i), 0);
    const cur = (proposalData.currency || 'USD').toUpperCase();
    const updatePayload = {};
    if (cur === 'USD') {
      updatePayload.total_amount_usd = total;
      updatePayload.total_amount = 0;
    } else {
      updatePayload.total_amount = total;
      updatePayload.total_amount_usd = 0;
    }

    const { error: updateError } = await supabase
      .from('proposals')
      .update(updatePayload)
      .eq('id', proposal.id);

    if (updateError) throw updateError;
  }

  const annualRows = filterPersistableAnnualFixedRows(annualFixedCosts);
  if (annualRows.length > 0) {
    const annualPayload = annualRows.map((row, index) =>
      buildAnnualFixedInsertRow(proposal.id, row, index),
    );
    const { error: annualError } = await supabase.from('proposal_annual_fixed_costs').insert(annualPayload);
    if (annualError) throw annualError;
  }

  return proposal;
}

/**
 * Update a proposal
 */
export async function updateProposal({ id, ...proposalData }) {
  const updates = sanitizeDates({ ...proposalData });
  if (updates.site_id === '' || updates.site_id == null) {
    updates.site_id = null;
  }

  // DEBUG: Log proposal update payload
  console.log('🔍 updateProposal payload:', {
    id,
    vat_rate: updates.vat_rate,
    has_tevkifat: updates.has_tevkifat,
    fullPayload: updates,
  });

  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select(PROPOSAL_DETAIL_SELECT)
    .single();

  console.log('✅ updateProposal result:', { data, error });

  if (error) throw error;
  return data;
}

/**
 * Replace all items for a proposal
 */
export async function updateProposalItems(proposalId, items) {
  // Delete existing items
  const { error: deleteError } = await supabase
    .from('proposal_items')
    .delete()
    .eq('proposal_id', proposalId);

  if (deleteError) throw deleteError;

  const { data: _cRow } = await supabase.from('proposals').select('currency').eq('id', proposalId).single();
  const _currency = _cRow?.currency || 'USD';

  // Insert new items
  if (items?.length > 0) {
    const itemsToInsert = items.map((item, index) =>
      buildProposalItemInsertRow(proposalId, item, index, _currency),
    );

    const { error: insertError } = await supabase
      .from('proposal_items')
      .insert(itemsToInsert);

    if (insertError) throw insertError;
  }

  const total = (items || []).reduce((sum, i) => sum + lineTotalForProposalItem(i), 0);
  const cur = (_currency || 'USD').toUpperCase();
  const updatePayload = {};
  if (cur === 'USD') {
    updatePayload.total_amount_usd = total;
    updatePayload.total_amount = 0;
  } else {
    updatePayload.total_amount = total;
    updatePayload.total_amount_usd = 0;
  }

  const { error: updateError } = await supabase
    .from('proposals')
    .update(updatePayload)
    .eq('id', proposalId);

  if (updateError) throw updateError;

  return { success: true };
}

/**
 * Update proposal status with timestamp
 */
export async function updateProposalStatus({ id, status }) {
  const updates = { status };

  if (status === 'sent') updates.sent_at = new Date().toISOString();
  if (status === 'accepted') updates.accepted_at = new Date().toISOString();
  if (status === 'rejected') updates.rejected_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select(PROPOSAL_DETAIL_SELECT)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft-delete a proposal (sets deleted_at).
 * Uses SECURITY DEFINER RPC — see 00161_soft_delete_proposal_rpc.sql — to avoid
 * PostgREST 403 when RLS WITH CHECK + get_my_role() misbehaves on direct UPDATE.
 */
export async function deleteProposal(id) {
  const { error } = await supabase.rpc('soft_delete_proposal', { p_id: id });

  if (error) throw error;
  return { success: true };
}

/**
 * Duplicate a proposal (creates a new draft copy with all items)
 */
export async function duplicateProposal(proposalId) {
  // Fetch original proposal
  const { data: original, error: origError } = await supabase
    .from('proposals')
    .select(PROPOSAL_DETAIL_SELECT)
    .eq('id', proposalId)
    .single();
  if (origError) throw origError;

  // Fetch original items
  const { data: origItems, error: itemsError } = await supabase
    .from('proposal_items')
    .select('description, quantity, unit, unit_price, unit_price_usd, material_id, cost, cost_usd, margin_percent, product_cost, product_cost_usd, labor_cost, labor_cost_usd, shipping_cost, shipping_cost_usd, material_cost, material_cost_usd, misc_cost, misc_cost_usd')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });
  if (itemsError) throw itemsError;

  const { data: origAnnual, error: annualError } = await supabase
    .from('proposal_annual_fixed_costs')
    .select('description, quantity, unit, unit_price, currency')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });
  if (annualError) throw annualError;

  // Map items to createProposal format
  const currency = original.currency || 'USD';
  const items = (origItems || []).map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit: item.unit || 'adet',
    unit_price: currency === 'USD' ? (item.unit_price_usd ?? 0) : (item.unit_price ?? 0),
    material_id: coalesceUuid(item.material_id),
    cost: currency === 'USD' ? item.cost_usd : item.cost,
    margin_percent: item.margin_percent,
    product_cost: currency === 'USD' ? item.product_cost_usd : item.product_cost,
    labor_cost: currency === 'USD' ? item.labor_cost_usd : item.labor_cost,
    shipping_cost: currency === 'USD' ? item.shipping_cost_usd : item.shipping_cost,
    material_cost: currency === 'USD' ? item.material_cost_usd : item.material_cost,
    misc_cost: currency === 'USD' ? item.misc_cost_usd : item.misc_cost,
  }));

  const annual_fixed_costs = (origAnnual || []).map((row) => ({
    description: row.description,
    quantity: row.quantity,
    unit: row.unit || 'adet',
    unit_price: Number(row.unit_price) || 0,
    currency: normalizeAnnualFixedCurrency(row.currency),
  }));

  // Strip fields that shouldn't be copied
  const {
    id: _id, proposal_no: _no, created_at: _ca, updated_at: _ua,
    status: _s, sent_at: _sa, accepted_at: _aa, rejected_at: _ra,
    deleted_at: _da, created_by: _cb, total_amount: _ta, total_amount_usd: _tau,
    ...copyData
  } = original;

  return createProposal({ ...copyData, items, annual_fixed_costs });
}

/**
 * Fetch work orders linked to a proposal
 */
export async function fetchProposalWorkOrders(proposalId) {
  const { data, error } = await supabase
    .from('proposal_work_orders')
    .select('work_order_id')
    .eq('proposal_id', proposalId);

  if (error) throw error;

  if (!data || data.length === 0) return [];

  const woIds = data.map((r) => r.work_order_id);
  const { data: workOrders, error: woError } = await supabase
    .from('work_orders_detail')
    .select('id, form_no, status, work_type, scheduled_date, description')
    .in('id', woIds)
    .order('scheduled_date', { ascending: true });

  if (woError) throw woError;
  return workOrders;
}

/**
 * Link a work order to a proposal
 */
export async function linkWorkOrderToProposal({ proposalId, workOrderId }) {
  // Insert junction record
  const { error: junctionError } = await supabase
    .from('proposal_work_orders')
    .insert({ proposal_id: proposalId, work_order_id: workOrderId });

  if (junctionError) throw junctionError;

  // Set convenience FK
  const { error: fkError } = await supabase
    .from('work_orders')
    .update({ proposal_id: proposalId })
    .eq('id', workOrderId);

  if (fkError) throw fkError;

  return { success: true };
}

/**
 * Unlink a work order from a proposal
 */
export async function unlinkWorkOrderFromProposal({ proposalId, workOrderId }) {
  // Remove junction record
  const { error: junctionError } = await supabase
    .from('proposal_work_orders')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('work_order_id', workOrderId);

  if (junctionError) throw junctionError;

  // Clear convenience FK
  const { error: fkError } = await supabase
    .from('work_orders')
    .update({ proposal_id: null })
    .eq('id', workOrderId);

  if (fkError) throw fkError;

  return { success: true };
}
