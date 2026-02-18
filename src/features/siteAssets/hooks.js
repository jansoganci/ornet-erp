import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as api from './api';
import { assetKeys } from './api';

// ─── Queries ───────────────────────────────────────────────

export function useAssets(filters) {
  return useQuery({
    queryKey: assetKeys.list(filters),
    queryFn: () => api.fetchAssets(filters),
  });
}

export function useAsset(id) {
  return useQuery({
    queryKey: assetKeys.detail(id),
    queryFn: () => api.fetchAsset(id),
    enabled: !!id,
  });
}

export function useAssetsBySite(siteId) {
  return useQuery({
    queryKey: assetKeys.bySite(siteId),
    queryFn: () => api.fetchAssetsBySite(siteId),
    enabled: !!siteId,
  });
}

export function useAssetsByCustomer(customerId) {
  return useQuery({
    queryKey: assetKeys.byCustomer(customerId),
    queryFn: () => api.fetchAssetsByCustomer(customerId),
    enabled: !!customerId,
  });
}

export function useAssetsByWorkOrder(workOrderId) {
  return useQuery({
    queryKey: assetKeys.byWorkOrder(workOrderId),
    queryFn: () => api.fetchAssetsByWorkOrder(workOrderId),
    enabled: !!workOrderId,
  });
}

export function useAssetHistory(assetId) {
  return useQuery({
    queryKey: assetKeys.history(assetId),
    queryFn: () => api.fetchAssetHistory(assetId),
    enabled: !!assetId,
  });
}

// ─── Mutations ─────────────────────────────────────────────

function invalidateAssetQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: assetKeys.all });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.createAsset,
    onSuccess: () => {
      invalidateAssetQueries(queryClient);
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useBulkCreateAssets() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.bulkCreateAssets,
    onSuccess: (data) => {
      invalidateAssetQueries(queryClient);
      toast.success(t('success.created') + ` (${data.length})`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, data }) => api.updateAsset(id, data),
    onSuccess: () => {
      invalidateAssetQueries(queryClient);
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useRemoveAsset() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, ...opts }) => api.removeAsset(id, opts),
    onSuccess: () => {
      invalidateAssetQueries(queryClient);
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.deleteAsset,
    onSuccess: () => {
      invalidateAssetQueries(queryClient);
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    },
  });
}

export function useLinkAssetToWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workOrderId, assetId, action, notes }) =>
      api.linkAssetToWorkOrder(workOrderId, assetId, action, notes),
    onSuccess: () => {
      invalidateAssetQueries(queryClient);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}
