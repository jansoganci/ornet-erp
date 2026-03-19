import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import { collectionKeys, fetchCollectionPayments, fetchCollectionStats } from './collectionApi';
import { recordPayment } from '../subscriptions/paymentsApi';
import { subscriptionKeys } from '../subscriptions/hooks';
import {
  transactionKeys,
  profitAndLossKeys,
  financeDashboardKeys,
} from './api';

export function useCollectionPayments(filters) {
  return useQuery({
    queryKey: collectionKeys.list(filters),
    queryFn: () => fetchCollectionPayments(filters),
  });
}

export function useCollectionStats(filters) {
  return useQuery({
    queryKey: collectionKeys.stat(filters),
    queryFn: () => fetchCollectionStats(filters),
  });
}

/**
 * Record a payment from the Collection Desk.
 * Invalidates collection queries + subscription + finance caches.
 */
export function useCollectionRecordPayment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('subscriptions');

  return useMutation({
    mutationFn: ({ paymentId, data }) => recordPayment(paymentId, data),
    onSuccess: (data) => {
      // Invalidate collection desk
      queryClient.invalidateQueries({ queryKey: collectionKeys.all });
      // Invalidate subscription caches
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      if (data?.subscription_id) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.payments(data.subscription_id) });
      }
      // Invalidate finance caches
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      toast.success(t('payment.success'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}
