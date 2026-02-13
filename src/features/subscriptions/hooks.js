import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import { supabase } from '../../lib/supabase';
import {
  fetchSubscriptions,
  fetchSubscription,
  createSubscription,
  updateSubscription,
  pauseSubscription,
  cancelSubscription,
  reactivateSubscription,
  bulkUpdateSubscriptionPrices,
  fetchRevisionNotes,
  createRevisionNote,
} from './api';
import { importSubscriptionsFromRows } from './importApi';
import {
  fetchPaymentsBySubscription,
  recordPayment,
  fetchOverdueInvoices,
  fetchSubscriptionStats,
} from './paymentsApi';
import {
  profitAndLossKeys,
  financeDashboardKeys,
  transactionKeys,
} from '../finance/api';
import {
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from './paymentMethodsApi';

// Query key factories
export const subscriptionKeys = {
  all: ['subscriptions'],
  lists: () => [...subscriptionKeys.all, 'list'],
  list: (filters) => [...subscriptionKeys.lists(), filters],
  details: () => [...subscriptionKeys.all, 'detail'],
  detail: (id) => [...subscriptionKeys.details(), id],
  payments: (id) => [...subscriptionKeys.detail(id), 'payments'],
  revisionNotes: (id) => [...subscriptionKeys.detail(id), 'revisionNotes'],
  stats: () => [...subscriptionKeys.all, 'stats'],
  overdueInvoices: () => [...subscriptionKeys.all, 'overdueInvoices'],
};

export const paymentMethodKeys = {
  all: ['paymentMethods'],
  byCustomer: (customerId) => [...paymentMethodKeys.all, customerId],
};

// ============================================================================
// Current user profile
// ============================================================================

export function useCurrentProfile() {
  return useQuery({
    queryKey: ['currentProfile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ============================================================================
// Subscription hooks
// ============================================================================

export function useSubscriptions(filters = {}) {
  return useQuery({
    queryKey: subscriptionKeys.list(filters),
    queryFn: () => fetchSubscriptions(filters),
  });
}

export function useSubscriptionsBySite(siteId) {
  return useQuery({
    queryKey: subscriptionKeys.list({ site_id: siteId }),
    queryFn: () => fetchSubscriptions({ site_id: siteId }),
    enabled: !!siteId,
  });
}

export function useSubscription(id) {
  return useQuery({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => fetchSubscription(id),
    enabled: !!id,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('subscriptions');

  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.stats() });
      toast.success(t('form.success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('subscriptions');

  return useMutation({
    mutationFn: updateSubscription,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.stats() });
      toast.success(t('form.success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function usePauseSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, reason }) => pauseSubscription(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t('success.statusUpdated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, reason, writeOffUnpaid }) => cancelSubscription(id, { reason, writeOffUnpaid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t('success.statusUpdated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: (id) => reactivateSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t('success.statusUpdated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

// ============================================================================
// Revision notes (price revision timeline)
// ============================================================================

export function useRevisionNotes(subscriptionId) {
  return useQuery({
    queryKey: subscriptionKeys.revisionNotes(subscriptionId),
    queryFn: () => fetchRevisionNotes(subscriptionId),
    enabled: !!subscriptionId,
  });
}

export function useCreateRevisionNote() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('subscriptions');

  return useMutation({
    mutationFn: createRevisionNote,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: subscriptionKeys.revisionNotes(variables.subscription_id),
      });
      toast.success(t('priceRevision.notes.successCreated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

// ============================================================================
// Payment hooks
// ============================================================================

export function useSubscriptionPayments(subscriptionId) {
  return useQuery({
    queryKey: subscriptionKeys.payments(subscriptionId),
    queryFn: () => fetchPaymentsBySubscription(subscriptionId),
    enabled: !!subscriptionId,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('subscriptions');

  return useMutation({
    mutationFn: ({ paymentId, data }) => recordPayment(paymentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
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

export function useOverdueInvoices() {
  return useQuery({
    queryKey: subscriptionKeys.overdueInvoices(),
    queryFn: fetchOverdueInvoices,
  });
}

export function useSubscriptionStats() {
  return useQuery({
    queryKey: subscriptionKeys.stats(),
    queryFn: fetchSubscriptionStats,
  });
}

export function useImportSubscriptions() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('subscriptions');

  return useMutation({
    mutationFn: importSubscriptionsFromRows,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t('import.success'));
    },
    onError: (error) => {
      toast.error(error?.message || t('import.failed'));
    },
  });
}

export function useBulkUpdateSubscriptionPrices() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: bulkUpdateSubscriptionPrices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

// ============================================================================
// Payment method hooks
// ============================================================================

export function usePaymentMethods(customerId) {
  return useQuery({
    queryKey: paymentMethodKeys.byCustomer(customerId),
    queryFn: () => fetchPaymentMethods(customerId),
    enabled: !!customerId,
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: createPaymentMethod,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.byCustomer(data.customer_id) });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: updatePaymentMethod,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.byCustomer(data.customer_id) });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.byCustomer(data.customer_id) });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    },
  });
}
