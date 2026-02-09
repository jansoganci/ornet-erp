import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as api from './api';
import { siteKeys } from './api';

export function useSitesByCustomer(customerId) {
  return useQuery({
    queryKey: siteKeys.listByCustomer(customerId),
    queryFn: () => api.fetchSitesByCustomer(customerId),
    enabled: !!customerId,
  });
}

export function useSite(id) {
  return useQuery({
    queryKey: siteKeys.detail(id),
    queryFn: () => api.fetchSite(id),
    enabled: !!id,
  });
}

export function useSiteByAccountNo(accountNo) {
  return useQuery({
    queryKey: siteKeys.byAccountNo(accountNo),
    queryFn: () => api.fetchSiteByAccountNo(accountNo),
    enabled: !!accountNo,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.createSite,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: siteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: siteKeys.listByCustomer(data.customer_id) });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    }
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, data }) => api.updateSite(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: siteKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: siteKeys.listByCustomer(data.customer_id) });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    }
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.deleteSite,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: siteKeys.all });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    }
  });
}

export function useSearchSites(query) {
  return useQuery({
    queryKey: [...siteKeys.lists(), 'search', query],
    queryFn: () => api.searchSites(query),
    enabled: query?.length > 2,
  });
}
