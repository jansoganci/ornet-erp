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

/**
 * Fetch all proposals with optional filters
 */
export async function fetchProposals({ search = '', status = '' } = {}) {
  let query = supabase
    .from('proposals_detail')
    .select('*')
    .order('created_at', { ascending: false });

  if (search) {
    const normalized = normalizeForSearch(search);
    query = query.or(
      `title_search.ilike.%${normalized}%,customer_company_name_search.ilike.%${normalized}%,proposal_no_search.ilike.%${normalized}%`
    );
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Fetch a single proposal by ID
 */
export async function fetchProposal(id) {
  const { data, error } = await supabase
    .from('proposals_detail')
    .select('*')
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
    .select('*, materials(code, name, description)')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Create a new proposal with items
 */
export async function createProposal({ items, ...proposalData }) {
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

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert(payload)
    .select()
    .single();

  if (proposalError) throw proposalError;

  if (items?.length > 0) {
    const itemsToInsert = items.map((item, index) => {
      const unitPrice = item.unit_price ?? 0;
      const cost = item.cost ?? null;
      return {
        proposal_id: proposal.id,
        sort_order: index,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'adet',
        unit_price: unitPrice,
        unit_price_usd: unitPrice,
        material_id: item.material_id ?? null,
        cost,
        cost_usd: cost,
        margin_percent: item.margin_percent ?? null,
        product_cost: item.product_cost ?? null,
        product_cost_usd: item.product_cost ?? null,
        labor_cost: item.labor_cost ?? null,
        labor_cost_usd: item.labor_cost ?? null,
        shipping_cost: item.shipping_cost ?? null,
        shipping_cost_usd: item.shipping_cost ?? null,
        material_cost: item.material_cost ?? null,
        material_cost_usd: item.material_cost ?? null,
        misc_cost: item.misc_cost ?? null,
        misc_cost_usd: item.misc_cost ?? null,
      };
    });

    const { error: itemsError } = await supabase
      .from('proposal_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    const total = items.reduce((sum, i) => sum + (i.quantity * (i.unit_price ?? 0)), 0);
    const updatePayload = { total_amount: total };
    if ((proposalData.currency || 'USD') === 'USD') {
      updatePayload.total_amount_usd = total;
    }

    const { error: updateError } = await supabase
      .from('proposals')
      .update(updatePayload)
      .eq('id', proposal.id);

    if (updateError) throw updateError;
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
  const { data, error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

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

  // Insert new items
  if (items?.length > 0) {
    const itemsToInsert = items.map((item, index) => {
      const unitPrice = item.unit_price ?? 0;
      const cost = item.cost ?? null;
      return {
        proposal_id: proposalId,
        sort_order: index,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'adet',
        unit_price: unitPrice,
        unit_price_usd: unitPrice,
        material_id: item.material_id ?? null,
        cost,
        cost_usd: cost,
        margin_percent: item.margin_percent ?? null,
        product_cost: item.product_cost ?? null,
        product_cost_usd: item.product_cost ?? null,
        labor_cost: item.labor_cost ?? null,
        labor_cost_usd: item.labor_cost ?? null,
        shipping_cost: item.shipping_cost ?? null,
        shipping_cost_usd: item.shipping_cost ?? null,
        material_cost: item.material_cost ?? null,
        material_cost_usd: item.material_cost ?? null,
        misc_cost: item.misc_cost ?? null,
        misc_cost_usd: item.misc_cost ?? null,
      };
    });

    const { error: insertError } = await supabase
      .from('proposal_items')
      .insert(itemsToInsert);

    if (insertError) throw insertError;
  }

  const total = (items || []).reduce((sum, i) => sum + (i.quantity * (i.unit_price ?? 0)), 0);
  const { data: proposal } = await supabase.from('proposals').select('currency').eq('id', proposalId).single();
  const updatePayload = { total_amount: total };
  if ((proposal?.currency || 'USD') === 'USD') {
    updatePayload.total_amount_usd = total;
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
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a proposal
 */
export async function deleteProposal(id) {
  const { error } = await supabase
    .from('proposals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
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
    .select('*')
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
