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
  dashboardV2Keys,
  financeSettingsKeys,
  financeHealthKeys,
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
      // transaction lists
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      // computed reports — all three must stay in sync after any transaction change
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardV2Keys.all });
      queryClient.invalidateQueries({ queryKey: vatReportKeys.all });
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
      // transaction detail + lists
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      // computed reports — all three must stay in sync after any transaction change
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardV2Keys.all });
      queryClient.invalidateQueries({ queryKey: vatReportKeys.all });
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
      // transaction lists + detail (all, covers both)
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      // computed reports — all three must stay in sync after any transaction change
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardV2Keys.all });
      queryClient.invalidateQueries({ queryKey: vatReportKeys.all });
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

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['common', 'finance']);

  return useMutation({
    mutationFn: api.deleteExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success(t('common:success.deleted'));
    },
    onError: (error) => {
      if (String(error?.code) === '23503') {
        toast.error(t('finance:categories.deleteInUse'));
      } else {
        toast.error(getErrorMessage(error, 'common.deleteFailed'));
      }
    },
  });
}

// Exchange rates
export function useExchangeRates(filters) {
  return useQuery({
    queryKey: rateKeys.list(filters),
    queryFn: () => api.fetchRates(filters),
    staleTime: 1000 * 60 * 60, // 1 hour - TCMB rates change once per day
  });
}

export function useLatestRate(currency) {
  return useQuery({
    queryKey: rateKeys.latest(currency),
    queryFn: () => api.getLatestRate(currency),
    enabled: !!currency,
    staleTime: 1000 * 60 * 60, // 1 hour - TCMB rates change once per day
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

export function useDeleteRate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.deleteRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rateKeys.all });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
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
      toast.error(getErrorMessage(error, 'common.unexpected'));
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

// Dashboard V2
export function useChannelMetrics({ channel, year, month, viewMode = 'total' } = {}) {
  return useQuery({
    queryKey: dashboardV2Keys.channel(channel, year, month, viewMode),
    queryFn: () => api.fetchChannelMetrics({ channel, year, month, viewMode }),
    enabled: !!channel && !!year,
  });
}

export function useOverviewTotals({ year, month, viewMode = 'total' } = {}) {
  return useQuery({
    queryKey: dashboardV2Keys.overview(year, month, viewMode),
    queryFn: () => api.fetchOverviewTotals({ year, month, viewMode }),
    enabled: !!year,
  });
}

export function useGeneralExpenses({ year, month, viewMode = 'total' } = {}) {
  return useQuery({
    queryKey: dashboardV2Keys.generalExpenses(year, month, viewMode),
    queryFn: () => api.fetchGeneralExpenses({ year, month, viewMode }),
    enabled: !!year,
  });
}

export function useFinanceSettings() {
  return useQuery({
    queryKey: financeSettingsKeys.detail(),
    queryFn: async () => {
      const row = await api.fetchFinanceSettings();
      return {
        tevkifat_threshold_try: Number(row?.tevkifat_threshold_try) || 12000,
        tevkifat_rate_numerator: Number(row?.tevkifat_rate_numerator) || 9,
        tevkifat_rate_denominator: Number(row?.tevkifat_rate_denominator) || 10,
      };
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ── Finance Health Check ─────────────────────────────────────────────────────

/** Returns the count of records in view_finance_health_check. */
export function useFinanceHealthCheck() {
  return useQuery({
    queryKey: financeHealthKeys.count(),
    queryFn: api.fetchFinanceHealthCheckCount,
    staleTime: 5 * 60_000,
  });
}

/**
 * Returns the full list of problematic records.
 * Pass { enabled: true } only when the user explicitly opens the detail modal
 * to avoid loading the full list on every Finance Dashboard mount.
 */
export function useFinanceHealthCheckRecords({ enabled = false } = {}) {
  return useQuery({
    queryKey: financeHealthKeys.records(),
    queryFn: api.fetchFinanceHealthCheckRecords,
    enabled,
    staleTime: 5 * 60_000,
  });
}
