import { useQuery } from '@tanstack/react-query';
import * as api from './api';

export const dashboardKeys = {
  all: ['dashboard'],
  stats: () => [...dashboardKeys.all, 'stats'],
  schedule: () => [...dashboardKeys.all, 'schedule'],
  tasks: () => [...dashboardKeys.all, 'tasks'],
  revenue: (months) => [...dashboardKeys.all, 'revenue', months],
  overduePayments: () => [...dashboardKeys.all, 'overduePayments'],
};

export function useDashboardStats() {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: api.fetchDashboardStats,
  });
}

export function useTodaySchedule() {
  return useQuery({
    queryKey: dashboardKeys.schedule(),
    queryFn: api.fetchTodaySchedule,
  });
}

export function usePendingTasks() {
  return useQuery({
    queryKey: dashboardKeys.tasks(),
    queryFn: api.fetchPendingTasks,
  });
}

export function useMonthlyRevenue(monthsBack = 7) {
  return useQuery({
    queryKey: dashboardKeys.revenue(monthsBack),
    queryFn: () => api.fetchMonthlyRevenue(monthsBack),
  });
}

export function useOverduePayments() {
  return useQuery({
    queryKey: dashboardKeys.overduePayments(),
    queryFn: api.fetchOverduePayments,
  });
}
