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
  const { data, error } = await supabase
    .from('financial_transactions')
    .select('recurring_template_id, transaction_date')
    .not('recurring_template_id', 'is', null)
    .order('transaction_date', { ascending: false });

  if (error) throw error;

  // Build a map: templateId -> latest transaction_date
  const map = {};
  for (const row of data) {
    if (!map[row.recurring_template_id]) {
      map[row.recurring_template_id] = row.transaction_date;
    }
  }
  return map;
}

export async function deleteRecurringTemplate(id) {
  const { error } = await supabase
    .from('recurring_expense_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
