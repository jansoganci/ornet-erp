import { supabase } from '../../lib/supabase';

// Query keys
export const recurringKeys = {
  all: ['recurring_templates'],
  lists: () => [...recurringKeys.all, 'list'],
  list: (filters) => [...recurringKeys.lists(), filters],
  lastGenerated: () => [...recurringKeys.all, 'last_generated'],
};

const TEMPLATE_SELECT = '*, expense_categories(id, code, name_tr)';

// Templates CRUD
export async function fetchRecurringTemplates(filters = {}) {
  let query = supabase
    .from('recurring_expense_templates')
    .select(TEMPLATE_SELECT)
    .is('deleted_at', null)
    .order('day_of_month', { ascending: true })
    .order('name', { ascending: true });

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createRecurringTemplate(data) {
  const { data: result, error } = await supabase
    .from('recurring_expense_templates')
    .insert(data)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return result;
}

export async function updateRecurringTemplate(id, data) {
  const { data: result, error } = await supabase
    .from('recurring_expense_templates')
    .update(data)
    .eq('id', id)
    .select(TEMPLATE_SELECT)
    .single();

  if (error) throw error;
  return result;
}

// Fetch last generated transaction date per template (for "last generated" indicator)
export async function fetchTemplateLastGenerated() {
  // Use JS fallback by default to avoid red 404 errors in console during demo.
  // The RPC fn_last_generated_per_template appears to be missing in some environments.
  return fetchTemplateLastGeneratedFallback();
}

async function fetchTemplateLastGeneratedFallback() {
  const { data: txs, error: txError } = await supabase
    .from('financial_transactions')
    .select('recurring_template_id, transaction_date')
    .not('recurring_template_id', 'is', null)
    .order('transaction_date', { ascending: false });

  if (txError) throw txError;

  const lastDates = {};
  (txs || []).forEach((r) => {
    if (!lastDates[r.recurring_template_id]) {
      lastDates[r.recurring_template_id] = r.transaction_date;
    }
  });
  return lastDates;
}

export async function deleteRecurringTemplate(id) {
  const { error } = await supabase.rpc('soft_delete_recurring_template', { template_id: id });
  if (error) throw error;
}

export async function triggerRecurringGeneration() {
  const { data, error } = await supabase.rpc('fn_generate_recurring_expenses');
  if (error) throw error;
  return data;
}
