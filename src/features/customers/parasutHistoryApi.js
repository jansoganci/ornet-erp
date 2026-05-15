import { supabase } from '../../lib/supabase';

export async function fetchParasutHistory(customerId) {
  const { data, error } = await supabase.functions.invoke('parasut-dispatch', {
    body: {
      action: 'fetch-history',
      payload: { customer_id: customerId },
    },
  });

  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Paraşüt geçmişi alınamadı');
  return data?.data?.data || [];
}
