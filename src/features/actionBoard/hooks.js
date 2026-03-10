import { useQuery } from '@tanstack/react-query';
import * as api from './api';

export const actionBoardKeys = {
  all: ['actionBoard'],
  lateWorkOrders: () => [...actionBoardKeys.all, 'lateWorkOrders'],
  overduePayments: () => [...actionBoardKeys.all, 'overduePayments'],
  pendingProposals: () => [...actionBoardKeys.all, 'pendingProposals'],
};

export function useActionBoardData() {
  const lateWorkOrders = useQuery({
    queryKey: actionBoardKeys.lateWorkOrders(),
    queryFn: api.fetchLateWorkOrders,
    staleTime: 2 * 60 * 1000,
  });

  const overduePayments = useQuery({
    queryKey: actionBoardKeys.overduePayments(),
    queryFn: api.fetchOverduePayments,
    staleTime: 2 * 60 * 1000,
  });

  const pendingProposals = useQuery({
    queryKey: actionBoardKeys.pendingProposals(),
    queryFn: api.fetchAcceptedProposalsWithoutWO,
    staleTime: 2 * 60 * 1000,
  });

  return {
    lateWorkOrders: lateWorkOrders.data ?? [],
    overduePayments: overduePayments.data ?? [],
    pendingProposals: pendingProposals.data ?? [],
    isLoading:
      lateWorkOrders.isLoading ||
      overduePayments.isLoading ||
      pendingProposals.isLoading,
    errors: {
      lateWorkOrders: lateWorkOrders.error,
      overduePayments: overduePayments.error,
      pendingProposals: pendingProposals.error,
    },
    refetch: () => {
      lateWorkOrders.refetch();
      overduePayments.refetch();
      pendingProposals.refetch();
    },
  };
}

/** Lightweight hook for the dashboard doorbell card — counts only */
export function useActionBoardCounts() {
  const { lateWorkOrders, overduePayments, pendingProposals, isLoading } =
    useActionBoardData();
  const total =
    lateWorkOrders.length + overduePayments.length + pendingProposals.length;
  return { total, isLoading };
}
