import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as api from './api';
import {
  transactionKeys,
  categoryKeys,
  rateKeys,
  profitAndLossKeys,
  vatReportKeys,
  financeDashboardKeys,
} from './api';

// Transactions
export function useTransactions(filters) {
  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: () => api.fetchTransactions(filters),
  });
}

export function useTransaction(id) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => api.fetchTransaction(id),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, data }) => api.updateTransaction(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    },
  });
}

// Categories
export function useCategories(filters) {
  return useQuery({
    queryKey: categoryKeys.list(filters),
    queryFn: () => api.fetchCategories(filters),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, data }) => api.updateCategory(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

// Exchange rates
export function useExchangeRates(filters) {
  return useQuery({
    queryKey: rateKeys.list(filters),
    queryFn: () => api.fetchRates(filters),
  });
}

export function useLatestRate(currency) {
  return useQuery({
    queryKey: rateKeys.latest(currency),
    queryFn: () => api.getLatestRate(currency),
    enabled: !!currency,
  });
}

export function useCreateRate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['common', 'finance']);

  return useMutation({
    mutationFn: api.createRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all });
      toast.success(t('common:success.created'));
    },
    onError: (error) => {
      if (String(error?.code) === '23505') {
        toast.error(t('finance:exchangeRates.duplicateDate'));
      } else {
        toast.error(getErrorMessage(error, 'common.createFailed'));
      }
    },
  });
}

export function useFetchTcmbRates() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['common', 'finance']);

  return useMutation({
    mutationFn: api.fetchTcmbRates,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all });
      const count = data?.count ?? 0;
      const msg = count
        ? t('finance:exchangeRates.fetchSuccess', { count, date: data?.date ?? '' })
        : t('finance:exchangeRates.fetchNoData');
      toast.success(msg);
    },
    onError: (error) => {
      toast.error(error?.message || getErrorMessage(error, 'common.error'));
    },
  });
}

// P&L
export function useProfitAndLoss(period, viewMode = 'total') {
  return useQuery({
    queryKey: profitAndLossKeys.list(period, viewMode),
    queryFn: () => api.fetchProfitAndLoss(period, viewMode),
  });
}

// VAT Report
export function useVatReport({ period, viewMode = 'total', periodType = 'month' }) {
  return useQuery({
    queryKey: vatReportKeys.list(period, viewMode, periodType),
    queryFn: () => api.fetchVatReport({ period, viewMode, periodType }),
  });
}

// Finance Dashboard
export function useFinanceDashboardKpis({ period, viewMode = 'total' } = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.kpis(period, viewMode),
    queryFn: () => api.fetchFinanceDashboardKpis({ period, viewMode }),
  });
}

export function useRevenueExpensesByMonth({ months = 6, viewMode = 'total' } = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.revenueExpenses(`last${months}`, viewMode),
    queryFn: () => api.fetchRevenueExpensesByMonth({ months, viewMode }),
  });
}

export function useExpenseByCategory({ period, viewMode = 'total' } = {}) {
  return useQuery({
    queryKey: financeDashboardKeys.expenseByCategory(period, viewMode),
    queryFn: () => api.fetchExpenseByCategory({ period, viewMode }),
  });
}

export function useRecentTransactions(limit = 10) {
  return useQuery({
    queryKey: financeDashboardKeys.recentTransactions(limit),
    queryFn: () => api.fetchRecentTransactions(limit),
  });
}
