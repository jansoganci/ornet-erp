import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { getBreadcrumbFromPath } from '../lib/breadcrumbConfig';
import { Sidebar } from '../components/layout/Sidebar';
import { UserProfileDropdown } from '../components/layout/UserProfileDropdown';
import { Footer } from '../components/layout/Footer';
import { navItems, topNavRoutes } from '../components/layout/navItems';
import { MobileNavDrawer } from '../components/layout/MobileNavDrawer';
import { useTheme } from '../hooks/themeContext';
import { useCurrentProfile } from '../features/subscriptions/hooks';
import { Sun, Moon, Menu, ChevronRight, ChevronDown, MoreHorizontal, Plus, User } from 'lucide-react';
import { IconButton } from '../components/ui';
import { QuickEntryModal } from '../features/finance';
import { NotificationBell } from '../features/notifications';
import { ErrorBoundary } from '../components/ErrorBoundary';

export function AppLayout() {
  const { t } = useTranslation();
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Build top nav items for mobile bar: flat items matching topNavRoutes
  const topNavItems = visibleNavItems.filter(
    (item) => (!item.type || item.type !== 'group') && topNavRoutes.includes(item.to)
  );
  
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

  function TopbarBreadcrumb() {
    const location = useLocation();
    const crumbs = getBreadcrumbFromPath(location.pathname);
    if (crumbs.length <= 1) return null;
    return (
      <nav className="hidden md:flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400" aria-label="Breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />}
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors truncate max-w-[120px] sm:max-w-[180px]"
              >
                {t(crumb.labelKey)}
              </Link>
            ) : (
              <span className="text-neutral-900 dark:text-neutral-50 font-medium truncate max-w-[120px] sm:max-w-[180px]">
                {t(crumb.labelKey)}
              </span>
            )}
          </span>
        ))}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] transition-colors overflow-x-hidden">
      {/* Sidebar (Responsive Drawer / Collapsible Desktop) */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={false}
      />

      <div className="flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#171717] border-b border-neutral-200 dark:border-[#262626] transition-colors">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            {/* Mobile/Tablet Menu Button */}
            <IconButton
              icon={<Menu className="w-6 h-6" />}
              variant="ghost"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden shrink-0"
              aria-label={tCommon('actions.menu')}
            />
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <TopbarBreadcrumb />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasNotificationAccess && <NotificationBell />}
            <IconButton
              icon={theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              variant="ghost"
              onClick={toggleTheme}
              className="text-neutral-500 dark:text-neutral-400"
              aria-label={tCommon('theme.toggle')}
            />
            {/* User Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-controls="user-profile-dropdown"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 shrink-0">
                  <User className="w-4 h-4" />
                </span>
                <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0 hidden sm:block" />
              </button>
              <UserProfileDropdown
                isOpen={userMenuOpen}
                onClose={() => setUserMenuOpen(false)}
                triggerRef={userMenuRef}
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <Footer />
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
