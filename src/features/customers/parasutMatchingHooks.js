import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  acceptParasutMatch,
  createParasutContact,
  fetchParasutMatchCandidates,
  rejectParasutMatch,
  runParasutBulkMatch,
  runParasutBulkMatchNameFallback,
} from './parasutMatchingApi';
import { customerKeys } from './hooks';

export const parasutMatchKeys = {
  all: ['parasutMatchCandidates'],
  list: (status) => [...parasutMatchKeys.all, status],
};

export function useMatchCandidates(status) {
  return useQuery({
    queryKey: parasutMatchKeys.list(status),
    queryFn: () => fetchParasutMatchCandidates({ status }),
  });
}

// Batched: call with an offset (default 0), read result.nextOffset/done to
// keep going. Each call processes one bounded batch of customers so the
// edge function invocation stays well under Supabase's sync response time
// limit even with 300-500 customers (see parasut-implementation-plan.md
// Phase 1.4).
export function useRunBulkMatch() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('customers');

  return useMutation({
    mutationFn: (offset = 0) => runParasutBulkMatch(offset),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: parasutMatchKeys.all });
      if (result?.done) {
        toast.success(t('parasutMatching.bulkMatchDone', { count: result?.processed ?? 0 }));
      }
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRunBulkMatchNameFallback() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('customers');

  return useMutation({
    mutationFn: runParasutBulkMatchNameFallback,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: parasutMatchKeys.all });
      toast.success(t('parasutMatching.nameFallbackSuccess', { count: result?.inserted ?? 0 }));
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useAcceptMatch() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('customers');

  return useMutation({
    mutationFn: acceptParasutMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parasutMatchKeys.all });
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(t('parasutMatching.accepted'));
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('customers');

  return useMutation({
    mutationFn: rejectParasutMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parasutMatchKeys.all });
      toast.success(t('parasutMatching.rejected'));
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useCreateParasutContact() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('customers');

  return useMutation({
    mutationFn: createParasutContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(t('parasutMatching.contactCreated'));
    },
    onError: (error) => toast.error(error.message),
  });
}
