import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import * as api from './api';

export const simCardKeys = {
  all: ['simCards'],
  lists: () => [...simCardKeys.all, 'list'],
  list: (filters) => [...simCardKeys.lists(), { filters }],
  details: () => [...simCardKeys.all, 'detail'],
  detail: (id) => [...simCardKeys.details(), id],
  history: (id) => [...simCardKeys.detail(id), 'history'],
};

export function useSimCards() {
  return useQuery({
    queryKey: simCardKeys.lists(),
    queryFn: api.fetchSimCards,
  });
}

export function useSimCard(id) {
  return useQuery({
    queryKey: simCardKeys.detail(id),
    queryFn: () => api.fetchSimCardById(id),
    enabled: !!id,
  });
}

export function useCreateSimCard() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.createSimCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: simCardKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateSimCard() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.updateSimCard,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: simCardKeys.lists() });
      queryClient.invalidateQueries({ queryKey: simCardKeys.detail(data.id) });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteSimCard() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.deleteSimCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: simCardKeys.lists() });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useSimCardHistory(id) {
  return useQuery({
    queryKey: simCardKeys.history(id),
    queryFn: () => api.fetchSimCardHistory(id),
    enabled: !!id,
  });
}

export function useSimFinancialStats() {
  return useQuery({
    queryKey: [...simCardKeys.all, 'financial-stats'],
    queryFn: api.fetchSimFinancialStats,
  });
}

export function useSimCardsByCustomer(customerId) {
  return useQuery({
    queryKey: [...simCardKeys.lists(), 'customer', customerId],
    queryFn: () => api.fetchSimCardsByCustomer(customerId),
    enabled: !!customerId,
  });
}

export function useBulkCreateSimCards() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: api.bulkCreateSimCards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: simCardKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
