import { supabase } from '../../lib/supabase';

export async function fetchSimCards() {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`
      *,
      customers:customer_id (company_name),
      customer_sites:site_id (site_name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchSimCardById(id) {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`
      *,
      customers:customer_id (company_name),
      customer_sites:site_id (site_name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSimCard(simCardData) {
  const { data, error } = await supabase
    .from('sim_cards')
    .insert([simCardData])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSimCard({ id, ...updates }) {
  const { data, error } = await supabase
    .from('sim_cards')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSimCard(id) {
  const { error } = await supabase
    .from('sim_cards')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchSimCardHistory(simCardId) {
  const { data, error } = await supabase
    .from('sim_card_history')
    .select(`
      *,
      profiles:changed_by (full_name)
    `)
    .eq('sim_card_id', simCardId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function bulkCreateSimCards(simCardsArray) {
  const { data, error } = await supabase
    .from('sim_cards')
    .insert(simCardsArray)
    .select();

  if (error) throw error;
  return data;
}

export async function fetchSimCardsByCustomer(customerId) {
  const { data, error } = await supabase
    .from('sim_cards')
    .select(`
      *,
      customer_sites:site_id (site_name)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function fetchSimFinancialStats() {
  const { data: stats, error: statsError } = await supabase
    .from('view_sim_card_stats')
    .select('*')
    .single();

  const { data: financials, error: finError } = await supabase
    .from('view_sim_card_financials')
    .select('*')
    .single();

  if (statsError) throw statsError;
  if (finError) throw finError;

  return {
    ...stats,
    ...financials
  };
}
