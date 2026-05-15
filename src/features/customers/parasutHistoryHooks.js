import { useQuery } from '@tanstack/react-query';
import { fetchParasutHistory } from './parasutHistoryApi';

export const parasutHistoryKeys = {
  all: ['parasutHistory'],
  customer: (customerId) => [...parasutHistoryKeys.all, customerId],
};

export function useParasutHistory(customerId) {
  return useQuery({
    queryKey: parasutHistoryKeys.customer(customerId),
    queryFn: () => fetchParasutHistory(customerId),
    enabled: !!customerId && import.meta.env.VITE_PARASUT_ENABLED === 'true',
  });
}
