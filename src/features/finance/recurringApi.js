import { supabase } from '../../lib/supabase';

// Query keys
export const recurringKeys = {
  all: ['recurring_templates'],
  lists: () => [...recurringKeys.all, 'list'],
  list: (filters) => [...recurringKeys.lists(), filters],
  details: () => [...recurringKeys.all, 'detail'],
  detail: (id) => [...recurringKeys.details(), id],
};

const TEMPLATE_SELECT = '*, expense_categories(id, code, name_tr)';

// Templates CRUD
export async function fetchRecurringTemplates(filters = {}) {
  let query = supabase
    .from('recurring_expense_templates')
    .select(TEMPLATE_SELECT)
    .order('day_of_month', { ascending: true })
    .order('name', { ascending: true });

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchRecurringTemplate(id) {
  const { data, error } = await supabase
    .from('recurring_expense_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .single();

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

export async function deleteRecurringTemplate(id) {
  const { error } = await supabase
    .from('recurring_expense_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Trigger cron manually (for testing)
export async function generateRecurringExpenses() {
  const { data, error } = await supabase.rpc('fn_generate_recurring_expenses');
  if (error) throw error;
  return data;
}
