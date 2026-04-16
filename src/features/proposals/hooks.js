import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errorHandler';
import {
  fetchProposals,
  fetchProposal,
  fetchProposalItems,
  fetchProposalSections,
  fetchProposalAnnualFixedCosts,
  createProposal,
  updateProposal,
  updateProposalSectionsAndItems,
  updateProposalAnnualFixedCosts,
  updateProposalStatus,
  deleteProposal,
  duplicateProposal,
  fetchProposalsBySite,
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
  sections: (id) => [...proposalKeys.all, 'sections', id],
  annualFixed: (id) => [...proposalKeys.all, 'annualFixed', id],
  workOrders: (id) => [...proposalKeys.all, 'workOrders', id],
  bySite: (siteId) => [...proposalKeys.all, 'bySite', siteId],
};

/** List proposals; `filters` is the React Query key — pass `statusGroup: 'active' | 'archive'` for tabbed lists (distinct cache per tab). */
export function useProposals(filters = {}) {
  return useQuery({
    queryKey: proposalKeys.list(filters),
    queryFn: () => fetchProposals(filters),
    placeholderData: keepPreviousData,
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

export function useProposalSections(proposalId) {
  return useQuery({
    queryKey: proposalKeys.sections(proposalId),
    queryFn: () => fetchProposalSections(proposalId),
    enabled: !!proposalId,
  });
}

export function useProposalAnnualFixedCosts(proposalId) {
  return useQuery({
    queryKey: proposalKeys.annualFixed(proposalId),
    queryFn: () => fetchProposalAnnualFixedCosts(proposalId),
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

export function useUpdateProposalSectionsAndItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, sections, items }) =>
      updateProposalSectionsAndItems(proposalId, sections, items),
    onSuccess: (_, { proposalId }) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.items(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.sections(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.updateFailed'));
    },
  });
}

export function useUpdateProposalAnnualFixedCosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, rows }) => updateProposalAnnualFixedCosts(proposalId, rows),
    onSuccess: (_, { proposalId }) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.annualFixed(proposalId) });
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

export function useDuplicateProposal() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('proposals');

  return useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      toast.success(t('detail.duplicateSuccess'));
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'common.createFailed'));
    },
  });
}

export function useProposalsBySite(siteId) {
  return useQuery({
    queryKey: proposalKeys.bySite(siteId),
    queryFn: () => fetchProposalsBySite(siteId),
    enabled: !!siteId,
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
