import { createContext, useContext } from 'react';

const CustomerDetailContext = createContext(null);

export function CustomerDetailProvider({ value, children }) {
  return (
    <CustomerDetailContext.Provider value={value}>
      {children}
    </CustomerDetailContext.Provider>
  );
}

export function useCustomerDetail() {
  const ctx = useContext(CustomerDetailContext);
  if (!ctx) {
    throw new Error('useCustomerDetail must be used within CustomerDetailProvider');
  }
  return ctx;
}
