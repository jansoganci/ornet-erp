import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as recurringApi from './recurringApi';
import { recurringKeys } from './recurringApi';
import { transactionKeys, profitAndLossKeys, financeDashboardKeys, vatReportKeys } from './api';

// Templates
export function useTemplateLastGenerated() {
  return useQuery({
    queryKey: recurringKeys.lastGenerated(),
    queryFn: () => recurringApi.fetchTemplateLastGenerated(),
  });
}

export function useRecurringTemplates(filters) {
  return useQuery({
    queryKey: recurringKeys.list(filters),
    queryFn: () => recurringApi.fetchRecurringTemplates(filters),
  });
}

export function useRecurringMonthStatus({ year, month }) {
  const enabled = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12;
  return useQuery({
    queryKey: recurringKeys.monthStatus(year, month),
    queryFn: () => recurringApi.fetchRecurringMonthStatus({ year, month }),
    enabled,
  });
}

export function useCreateRecurringTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: recurringApi.createRecurringTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdateRecurringTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, data }) => recurringApi.updateRecurringTemplate(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: recurringKeys.lists() });
      // Snapshot all active list variants (with or without filters) for rollback.
      const previousData = queryClient.getQueriesData({ queryKey: recurringKeys.lists() });
      queryClient.setQueriesData({ queryKey: recurringKeys.lists() }, (old) =>
        Array.isArray(old) ? old.map((tpl) => (tpl.id === id ? { ...tpl, ...data } : tpl)) : old
      );
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      toast.success(t('success.updated'));
    },
    onError: (error, _variables, context) => {
      context?.previousData?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useDeleteRecurringTemplate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: recurringApi.deleteRecurringTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    },
  });
}

export function useTriggerRecurringGeneration() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('recurring');

  return useMutation({
    mutationFn: async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const before = await recurringApi.fetchRecurringMonthStatus({ year, month });
      if (before.isComplete) {
        return { inserted: 0, skipped: true };
      }

      await recurringApi.triggerRecurringGeneration();

      const after = await recurringApi.fetchRecurringMonthStatus({ year, month });
      const inserted = before.missingCount - after.missingCount;

      return { inserted, skipped: false };
    },
    onSuccess: ({ inserted, skipped }) => {
      queryClient.invalidateQueries({ queryKey: recurringKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: profitAndLossKeys.all });
      queryClient.invalidateQueries({ queryKey: financeDashboardKeys.all });
      queryClient.invalidateQueries({ queryKey: vatReportKeys.all });

      if (skipped || inserted === 0) {
        toast.info(t('generate.alreadyComplete'));
      } else {
        toast.success(t('generate.success', { count: inserted }));
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}
