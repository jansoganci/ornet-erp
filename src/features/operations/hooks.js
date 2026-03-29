import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import {
  serviceRequestKeys,
  fetchServiceRequests,
  fetchServiceRequest,
  createServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
  updateContactStatus,
  convertRequestToWorkOrder,
  boomerangRequest,
  fetchOperationsStats,
  cancelServiceRequest,
} from './api';
import { workOrderKeys } from '../workOrders/hooks';

// ── Queries ─────────────────────────────────────────────────────────────────

export function useServiceRequests(filters) {
  return useQuery({
    queryKey: serviceRequestKeys.list(filters),
    queryFn: () => fetchServiceRequests(filters),
    staleTime: 60_000, // Pool status and contact status change frequently
  });
}

export function useServiceRequest(id) {
  return useQuery({
    queryKey: serviceRequestKeys.detail(id),
    queryFn: () => fetchServiceRequest(id),
    enabled: !!id,
  });
}

export function useOperationsStats(dateFrom, dateTo) {
  return useQuery({
    queryKey: serviceRequestKeys.stats({ dateFrom, dateTo }),
    queryFn: () => fetchOperationsStats(dateFrom, dateTo),
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Create a new service request (Quick Entry).
 */
export function useCreateServiceRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('operations');

  return useMutation({
    mutationFn: createServiceRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
      toast.success(t('toast.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

/**
 * Update a service request (edit fields).
 */
export function useUpdateServiceRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('operations');

  return useMutation({
    mutationFn: updateServiceRequest,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
      toast.success(t('toast.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

/**
 * Update contact status (traffic light).
 * Used by Call Queue and inline status buttons.
 */
export function useUpdateContactStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, contactStatus, contactNotes }) =>
      updateContactStatus(id, contactStatus, contactNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

/**
 * Convert a confirmed request to a work order.
 * Invalidates both service_requests and workOrders caches.
 */
export function useConvertToWorkOrder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('operations');

  return useMutation({
    mutationFn: ({ requestId, scheduleData }) =>
      convertRequestToWorkOrder(requestId, scheduleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      toast.success(t('toast.workOrderCreated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

/**
 * Boomerang a failed request back to the pool.
 * Invalidates both service_requests and workOrders caches.
 */
export function useBoomerangRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('operations');

  return useMutation({
    mutationFn: ({ requestId, failureReason }) =>
      boomerangRequest(requestId, failureReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
      queryClient.invalidateQueries({ queryKey: workOrderKeys.lists() });
      toast.success(t('toast.boomeranged'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

/**
 * Delete (soft) a service request.
 */
export function useDeleteServiceRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: deleteServiceRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    },
  });
}

/**
 * Cancel a service request.
 */
export function useCancelServiceRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('operations');

  return useMutation({
    mutationFn: cancelServiceRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      queryClient.invalidateQueries({ queryKey: serviceRequestKeys.stats() });
      toast.success(t('toast.cancelled'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}
