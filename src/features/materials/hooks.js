import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as api from './api';
import { materialKeys } from './api';

export function useMaterials(filters) {
  return useQuery({
    queryKey: materialKeys.list(filters),
    queryFn: () => api.fetchMaterials(filters),
  });
}

export function useActiveMaterials() {
  return useQuery({
    queryKey: materialKeys.active(),
    queryFn: api.fetchActiveMaterials,
  });
}

export function useMaterial(id) {
  return useQuery({
    queryKey: materialKeys.detail(id),
    queryFn: () => api.fetchMaterial(id),
    enabled: !!id,
  });
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.createMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    }
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: ({ id, data }) => api.updateMaterial(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: materialKeys.lists() });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    }
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.deleteMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.all });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    }
  });
}

export function useMaterialCategories() {
  return useQuery({
    queryKey: materialKeys.categories(),
    queryFn: api.fetchMaterialCategories,
  });
}
