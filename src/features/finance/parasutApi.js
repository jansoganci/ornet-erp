import { supabase } from '../../lib/supabase';

const invokeParasut = async (action, payload) => {
  const { data, error } = await supabase.functions.invoke('parasut-dispatch', {
    body: { action, payload },
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.error || 'Paraşüt işlemi başarısız');
  return data?.data;
};

export async function fetchSubscriptionParasutTransactions(subscriptionId) {
  if (!subscriptionId) return [];

  const { data, error } = await supabase
    .from('financial_transactions')
    .select(`
      *,
      subscription_payments!inner (
        id,
        subscription_id,
        payment_month,
        total_amount,
        status
      ),
      customers (
        id,
        company_name,
        tax_number,
        identity_type,
        parasut_contact_id
      )
    `)
    .eq('direction', 'income')
    .eq('subscription_payments.subscription_id', subscriptionId)
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchProposalParasutTransactions(proposalId) {
  if (!proposalId) return [];

  const { data, error } = await supabase
    .from('financial_transactions')
    .select('*, customers(id, company_name, tax_number, identity_type, parasut_contact_id)')
    .eq('direction', 'income')
    .eq('proposal_id', proposalId)
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchWorkOrderParasutTransactions(workOrderId) {
  if (!workOrderId) return [];

  const { data, error } = await supabase
    .from('financial_transactions')
    .select('*, customers(id, company_name, tax_number, identity_type, parasut_contact_id)')
    .eq('direction', 'income')
    .eq('work_order_id', workOrderId)
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function prepareParasutInvoice(financialTransactionId) {
  return invokeParasut('prepare-invoice', { financial_transaction_id: financialTransactionId });
}

export function finalizeParasutInvoice(financialTransactionId) {
  return invokeParasut('finalize-invoice', { financial_transaction_id: financialTransactionId });
}

export function cancelParasutDraft(financialTransactionId) {
  return invokeParasut('cancel-draft', { financial_transaction_id: financialTransactionId });
}
