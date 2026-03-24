import { createContext, useContext, useMemo } from 'react';

const MobileSidebarContext = createContext({
  openMobileSidebar: () => {},
});

export function MobileSidebarProvider({ children, openSidebar }) {
  const value = useMemo(
    () => ({
      openMobileSidebar: () => {
        openSidebar();
      },
    }),
    [openSidebar],
  );

  return <MobileSidebarContext.Provider value={value}>{children}</MobileSidebarContext.Provider>;
}

/** @returns {{ openMobileSidebar: () => void }} */
// eslint-disable-next-line react-refresh/only-export-components -- hook paired with Provider in this module
export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
