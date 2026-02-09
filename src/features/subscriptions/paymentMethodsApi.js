import { supabase } from '../../lib/supabase';

/**
 * Fetch active payment methods for a customer
 */
export async function fetchPaymentMethods(customerId) {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Create a new payment method — handle is_default toggle
 */
export async function createPaymentMethod(methodData) {
  // If this method is being set as default, unset others first
  if (methodData.is_default) {
    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('customer_id', methodData.customer_id)
      .eq('is_active', true);
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .insert(methodData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a payment method
 */
export async function updatePaymentMethod({ id, ...updateData }) {
  // If setting as default, unset others first
  if (updateData.is_default) {
    const { data: current } = await supabase
      .from('payment_methods')
      .select('customer_id')
      .eq('id', id)
      .single();

    if (current) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('customer_id', current.customer_id)
        .eq('is_active', true)
        .neq('id', id);
    }
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Soft delete a payment method (set is_active = false)
 */
export async function deletePaymentMethod(id) {
  const { data, error } = await supabase
    .from('payment_methods')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
