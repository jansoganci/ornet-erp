import { supabase } from '../../lib/supabase';

export async function runParasutBulkMatch() {
  const { data, error } = await supabase.functions.invoke('parasut-dispatch', {
    body: { action: 'bulk-match' },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Paraşüt eşleştirme başarısız');
  return data?.data;
}

export async function createParasutContact(customerId) {
  const { data, error } = await supabase.functions.invoke('parasut-dispatch', {
    body: {
      action: 'create-contact',
      payload: { customer_id: customerId, confirmed: true },
    },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Paraşüt kişi oluşturma başarısız');
  return data?.data;
}

export async function fetchParasutMatchCandidates({ status = 'pending' } = {}) {
  let query = supabase
    .from('parasut_match_candidates')
    .select(`
      *,
      customers (
        id,
        company_name,
        tax_number,
        identity_type,
        parasut_contact_id
      )
    `)
    .order('created_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function acceptParasutMatch(candidate) {
  const now = new Date().toISOString();
  const { error: customerError } = await supabase
    .from('customers')
    .update({ parasut_contact_id: candidate.parasut_contact_id })
    .eq('id', candidate.customer_id);

  if (customerError) throw customerError;

  const { data, error } = await supabase
    .from('parasut_match_candidates')
    .update({ status: 'accepted', decided_at: now })
    .eq('id', candidate.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rejectParasutMatch(candidateId) {
  const { data, error } = await supabase
    .from('parasut_match_candidates')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', candidateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
