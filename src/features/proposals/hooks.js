import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import {
  fetchProposals,
  fetchProposal,
  fetchProposalItems,
  createProposal,
  updateProposal,
  updateProposalItems,
  updateProposalStatus,
  deleteProposal,
  fetchProposalWorkOrders,
  linkWorkOrderToProposal,
  unlinkWorkOrderFromProposal,
} from './api';

export const proposalKeys = {
  all: ['proposals'],
  lists: () => [...proposalKeys.all, 'list'],
  list: (filters) => [...proposalKeys.lists(), filters],
  details: () => [...proposalKeys.all, 'detail'],
  detail: (id) => [...proposalKeys.details(), id],
  items: (id) => [...proposalKeys.all, 'items', id],
  workOrders: (id) => [...proposalKeys.all, 'workOrders', id],
};

export function useProposals(filters = {}) {
  return useQuery({
    queryKey: proposalKeys.list(filters),
    queryFn: () => fetchProposals(filters),
  });
}

export function useProposal(id) {
  return useQuery({
    queryKey: proposalKeys.detail(id),
    queryFn: () => fetchProposal(id),
    enabled: !!id,
  });
}

export function useProposalItems(proposalId) {
  return useQuery({
    queryKey: proposalKeys.items(proposalId),
    queryFn: () => fetchProposalItems(proposalId),
    enabled: !!proposalId,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      toast.success(t('success.created'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: updateProposal,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(data.id) });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useUpdateProposalItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, items }) => updateProposalItems(proposalId, items),
    onSuccess: (_, { proposalId }) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.items(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: updateProposalStatus,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(data.id) });
      toast.success(t('success.statusUpdated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: deleteProposal,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      queryClient.removeQueries({ queryKey: proposalKeys.detail(id) });
      toast.success(t('success.deleted'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.deleteFailed'));
    },
  });
}

export function useProposalWorkOrders(proposalId) {
  return useQuery({
    queryKey: proposalKeys.workOrders(proposalId),
    queryFn: () => fetchProposalWorkOrders(proposalId),
    enabled: !!proposalId,
  });
}

export function useLinkWorkOrder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: linkWorkOrderToProposal,
    onSuccess: (_, { proposalId }) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.workOrders(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useUnlinkWorkOrder() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');

  return useMutation({
    mutationFn: unlinkWorkOrderFromProposal,
    onSuccess: (_, { proposalId }) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.workOrders(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      toast.success(t('success.updated'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}
