import { CustomerDetailContext } from './customerDetailContextBase';

export function CustomerDetailProvider({ value, children }) {
  return (
    <CustomerDetailContext.Provider value={value}>
      {children}
    </CustomerDetailContext.Provider>
  );
}
