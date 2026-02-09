import { useQuery } from '@tanstack/react-query';
import * as api from './api';

export const workHistoryKeys = {
  all: ['workHistory'],
  search: (filters) => [...workHistoryKeys.all, 'search', filters],
};

export function useSearchWorkHistory(filters) {
  return useQuery({
    queryKey: workHistoryKeys.search(filters),
    queryFn: () => api.searchWorkHistory(filters),
    enabled: !!(filters.search || filters.dateFrom || filters.dateTo || filters.workType || filters.workerId || filters.siteId),
  });
}
