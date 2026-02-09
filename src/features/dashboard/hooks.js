import { useQuery } from '@tanstack/react-query';
import * as api from './api';

export const dashboardKeys = {
  all: ['dashboard'],
  stats: () => [...dashboardKeys.all, 'stats'],
  schedule: () => [...dashboardKeys.all, 'schedule'],
  tasks: () => [...dashboardKeys.all, 'tasks'],
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
