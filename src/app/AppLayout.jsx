import { useTranslation } from 'react-i18next';
import { Outlet, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Sidebar } from '../components/layout/Sidebar';
import { navItems, topNavRoutes } from '../components/layout/navItems';
import { MobileNavDrawer } from '../components/layout/MobileNavDrawer';
import { useTheme } from '../hooks/themeContext';
import { useCurrentProfile } from '../features/subscriptions/hooks';
import { Sun, Moon, Menu, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { IconButton } from '../components/ui';
import { QuickEntryModal } from '../features/finance';
import { NotificationBell } from '../features/notifications';

export function AppLayout() {
  const { t: tCommon } = useTranslation('common');
  const { theme, toggleTheme } = useTheme();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const hasFinanceAccess = isAdmin || currentProfile?.role === 'accountant';
  const hasNotificationAccess = isAdmin || currentProfile?.role === 'accountant';
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  // Build top nav items for mobile bar: flat items matching topNavRoutes
  const topNavItems = visibleNavItems.filter(
    (item) => (!item.type || item.type !== 'group') && topNavRoutes.includes(item.to)
  );
  
  // Sidebar collapse state (desktop only) - persist in localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Save collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Quick entry: Ctrl+N / Cmd+N
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (hasFinanceAccess) setQuickEntryOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasFinanceAccess]);

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] transition-colors">
      {/* Sidebar (Responsive Drawer / Collapsible Desktop) */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className={cn(
        'flex flex-col transition-all duration-300',
        // Desktop: Adjust padding based on sidebar state
        isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#171717] border-b border-neutral-200 dark:border-[#262626] transition-colors">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile/Tablet Menu Button */}
            <IconButton
              icon={<Menu className="w-6 h-6" />}
              variant="ghost"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden"
              aria-label={tCommon('actions.menu')}
            />
            {/* Desktop Sidebar Toggle */}
            <IconButton
              icon={isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              variant="ghost"
              onClick={handleToggleCollapse}
              className="hidden lg:flex"
              aria-label={isSidebarCollapsed ? (tCommon('actions.expand') || 'Expand sidebar') : (tCommon('actions.collapse') || 'Collapse sidebar')}
            />
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {tCommon('appName')}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {hasNotificationAccess && <NotificationBell />}
            {/* Theme Toggle */}
            <IconButton
              icon={theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              variant="ghost"
              onClick={toggleTheme}
              className="text-neutral-500 dark:text-neutral-400"
              aria-label={tCommon('theme.toggle')}
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile/Tablet Bottom Navigation - Top 5 + More */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#171717] border-t border-neutral-200 dark:border-[#262626] px-2 py-1 pb-[env(safe-area-inset-bottom)] lg:hidden transition-colors h-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around h-full">
          {topNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px]',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate max-w-[64px]">{tCommon(item.labelKey)}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-colors min-w-[56px] min-h-[44px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label={tCommon('nav.more')}
          >
            <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
            <span className="truncate max-w-[64px]">{tCommon('nav.more')}</span>
          </button>
        </div>
      </nav>

      <MobileNavDrawer open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      {/* Quick Entry FAB */}
      {hasFinanceAccess && (
        <button
          type="button"
          onClick={() => setQuickEntryOpen(true)}
          className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          aria-label={tCommon('finance:expense.addButton')}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <QuickEntryModal
        open={quickEntryOpen}
        onClose={() => setQuickEntryOpen(false)}
      />
    </div>
  );
}
