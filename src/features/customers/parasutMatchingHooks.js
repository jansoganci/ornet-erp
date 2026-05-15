import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  acceptParasutMatch,
  createParasutContact,
  fetchParasutMatchCandidates,
  rejectParasutMatch,
  runParasutBulkMatch,
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

export function useRunBulkMatch() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('customers');

  return useMutation({
    mutationFn: runParasutBulkMatch,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: parasutMatchKeys.all });
      toast.success(t('parasutMatching.bulkMatchSuccess', { count: result?.inserted ?? 0 }));
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
