import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import * as api from './api';
import { siteKeys } from '../customerSites/api';
import { customerKeys } from '../customers/hooks';

export const workOrderKeys = {
  all: ['workOrders'],
  lists: () => [...workOrderKeys.all, 'list'],
  list: (filters) => [...workOrderKeys.lists(), filters],
  details: () => [...workOrderKeys.all, 'detail'],
  detail: (id) => [...workOrderKeys.details(), id],
  bySite: (siteId) => [...workOrderKeys.all, 'site', siteId],
  byCustomer: (customerId) => [...workOrderKeys.all, 'customer', customerId],
  daily: (date, workerId) => [...workOrderKeys.all, 'daily', date, workerId],
  materials: (id) => [...workOrderKeys.detail(id), 'materials'],
};

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  
  return useMutation({
    mutationFn: ({ id, status }) => api.updateWorkOrder({ id, status }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      toast.success(t('success.statusUpdated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    }
  });
}

export function useWorkOrders(filters) {
  return useQuery({
    queryKey: workOrderKeys.list(filters),
    queryFn: () => api.fetchWorkOrders(filters),
  });
}

export function useWorkOrder(id) {
  return useQuery({
    queryKey: workOrderKeys.detail(id),
    queryFn: () => api.fetchWorkOrder(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}

export function useDailyWorkList(date, workerId) {
  return useQuery({
    queryKey: workOrderKeys.daily(date, workerId),
    queryFn: () => api.fetchDailyWorkList(date, workerId),
    enabled: !!date,
  });
}

export function useWorkOrderMaterials(workOrderId) {
  return useQuery({
    queryKey: workOrderKeys.materials(workOrderId),
    queryFn: () => api.fetchWorkOrderMaterials(workOrderId),
    enabled: !!workOrderId,
  });
}

export function useWorkOrdersBySite(siteId) {
  return useQuery({
    queryKey: workOrderKeys.bySite(siteId),
    queryFn: () => api.fetchWorkOrdersBySite(siteId),
    enabled: !!siteId,
  });
}

export function useWorkOrdersByCustomer(customerId) {
  return useQuery({
    queryKey: workOrderKeys.byCustomer(customerId),
    queryFn: () => api.fetchWorkOrdersByCustomer(customerId),
    enabled: !!customerId,
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  
  return useMutation({
    mutationFn: api.createWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: siteKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    }
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  
  return useMutation({
    mutationFn: api.updateWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.all });
      queryClient.invalidateQueries({ queryKey: siteKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    }
  });
}

export function useDeleteWorkOrder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['common', 'workOrders']);
  
  return useMutation({
    mutationFn: (id) => api.deleteWorkOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.all });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      const isPermissionDenied =
        error?.code === 'DELETE_PERMISSION_DENIED' ||
        error?.message === 'DELETE_PERMISSION_DENIED' ||
        (error?.message && (error.message.includes('policy') || error.message.includes('row level') || error.message.includes('permission')));
      const message = isPermissionDenied
        ? t('workOrders:delete.permissionDenied')
        : getErrorMessage(error, 'common.deleteFailed');
      toast.error(message);
    }
  });
}
