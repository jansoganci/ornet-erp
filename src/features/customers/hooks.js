import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import { siteKeys } from '../customerSites/api';
import {
  fetchCustomers,
  fetchCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './api';
import { importCustomersAndSitesFromRows } from './importApi';
// Query keys
export const customerKeys = {
  all: ['customers'],
  lists: () => [...customerKeys.all, 'list'],
  list: (filters) => [...customerKeys.lists(), filters],
  details: () => [...customerKeys.all, 'detail'],
  detail: (id) => [...customerKeys.details(), id],
};

/**
 * Hook to fetch customers list with optional search
 */
export function useCustomers({ search = '' } = {}) {
  return useQuery({
    queryKey: customerKeys.list({ search }),
    queryFn: () => fetchCustomers({ search }),
  });
}

/**
 * Hook to fetch a single customer
 */
export function useCustomer(id) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a new customer
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    }
  });
}

/**
 * Hook to update a customer
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: updateCustomer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.setQueryData(customerKeys.detail(data.id), data);
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    }
  });
}

/**
 * Hook to import customers and sites from validated rows
 * @param {Object} [options]
 * @param {(progress: {current: number, total: number}) => void} [options.onProgress]
 */
export function useImportCustomersAndSites({ onProgress } = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: (rows) => importCustomersAndSitesFromRows(rows, { onProgress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: siteKeys.all });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.importFailed'));
    },
  });
}

/**
 * Hook to delete a customer
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      queryClient.removeQueries({ queryKey: customerKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: siteKeys.listByCustomer(id) });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    }
  });
}
