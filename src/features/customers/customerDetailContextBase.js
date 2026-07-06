import { createContext, useContext } from 'react';

export const CustomerDetailContext = createContext(null);

export function useCustomerDetail() {
  const ctx = useContext(CustomerDetailContext);
  if (!ctx) {
    throw new Error('useCustomerDetail must be used within CustomerDetailProvider');
  }
  return ctx;
}
