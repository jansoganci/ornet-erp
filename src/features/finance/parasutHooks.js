import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  cancelParasutDraft,
  fetchProposalParasutTransactions,
  fetchSubscriptionParasutTransactions,
  fetchWorkOrderParasutTransactions,
  finalizeParasutInvoice,
  prepareParasutInvoice,
} from './parasutApi';
import { subscriptionKeys } from '../subscriptions/hooks';

export const parasutFinanceKeys = {
  all: ['parasutFinance'],
  subscription: (subscriptionId) => [...parasutFinanceKeys.all, 'subscription', subscriptionId],
  proposal: (proposalId) => [...parasutFinanceKeys.all, 'proposal', proposalId],
  workOrder: (workOrderId) => [...parasutFinanceKeys.all, 'workOrder', workOrderId],
};

export function useSubscriptionParasutTransactions(subscriptionId) {
  return useQuery({
    queryKey: parasutFinanceKeys.subscription(subscriptionId),
    queryFn: () => fetchSubscriptionParasutTransactions(subscriptionId),
    enabled: !!subscriptionId && import.meta.env.VITE_PARASUT_ENABLED === 'true',
  });
}

export function useProposalParasutTransactions(proposalId) {
  return useQuery({
    queryKey: parasutFinanceKeys.proposal(proposalId),
    queryFn: () => fetchProposalParasutTransactions(proposalId),
    enabled: !!proposalId && import.meta.env.VITE_PARASUT_ENABLED === 'true',
  });
}

export function useWorkOrderParasutTransactions(workOrderId) {
  return useQuery({
    queryKey: parasutFinanceKeys.workOrder(workOrderId),
    queryFn: () => fetchWorkOrderParasutTransactions(workOrderId),
    enabled: !!workOrderId && import.meta.env.VITE_PARASUT_ENABLED === 'true',
  });
}

function useParasutMutation(mutationFn, successKey) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('finance');

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parasutFinanceKeys.all });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t(successKey));
    },
    onError: (error) => toast.error(error.message),
  });
}

export function usePrepareParasutInvoice() {
  return useParasutMutation(prepareParasutInvoice, 'parasut.invoicePrepared');
}

export function useFinalizeParasutInvoice() {
  return useParasutMutation(finalizeParasutInvoice, 'parasut.invoiceFinalized');
}

export function useCancelParasutDraft() {
  return useParasutMutation(cancelParasutDraft, 'parasut.draftCancelled');
}
