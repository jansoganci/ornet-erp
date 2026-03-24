import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../lib/utils';
import { getBreadcrumbFromPath } from '../lib/breadcrumbConfig';
import { Sidebar } from '../components/layout/Sidebar';
import { UserProfileDropdown } from '../components/layout/UserProfileDropdown';
import { Footer } from '../components/layout/Footer';
import { navItems, getTopNavRoutes } from '../components/layout/navItems';
import { MobileNavDrawer } from '../components/layout/MobileNavDrawer';
import { QuickActionsSheet } from '../components/layout/QuickActionsSheet';
import { useTheme } from '../hooks/themeContext';
import { useCurrentProfile } from '../features/subscriptions/hooks';
import { Sun, Moon, Menu, ChevronRight, ChevronDown, MoreHorizontal, Plus, User } from 'lucide-react';
import { IconButton } from '../components/ui';
import { QuickEntryModal } from '../features/finance';
import { NotificationBell } from '../features/notifications';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MobileSidebarProvider } from '../contexts/MobileSidebarContext';

export function AppLayout() {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation('common');
  const { theme, toggleTheme } = useTheme();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const canWrite = isAdmin || currentProfile?.role === 'accountant';
  const hasFinanceAccess = canWrite;
  const hasNotificationAccess = canWrite;
  const visibleNavItems = navItems
    .filter((item) => (!item.adminOnly || isAdmin) && (!item.canWriteOnly || canWrite))
    .map((item) => {
      if (item.type !== 'group') return item;
      if (item.canWriteOnly && !canWrite) return null;
      const visibleChildren = item.children.filter((child) => !child.canWriteOnly || canWrite);
      if (visibleChildren.length === 0) return null;
      return { ...item, children: visibleChildren };
    })
    .filter(Boolean);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === 'true'; } catch { return false; }
  });

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebarCollapsed', String(next));
      } catch (_) {
        void _;
      }
      return next;
    });
  };
  const [quickEntryState, setQuickEntryState] = useState({ open: false, direction: null });
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const openMobileSidebarDrawer = useCallback(() => setIsSidebarOpen(true), []);

  const activeTopNavRoutes = getTopNavRoutes(canWrite);
  const topNavItems = visibleNavItems.filter(
    (item) => (!item.type || item.type !== 'group') && activeTopNavRoutes.includes(item.to)
  );
  
  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isSidebarOpen]);

  // Quick entry: Ctrl+N / Cmd+N (desktop)
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (hasFinanceAccess) setQuickEntryState({ open: true, direction: null });
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
                {crumb.label != null ? crumb.label : t(crumb.labelKey)}
              </Link>
            ) : (
              <span className="text-neutral-900 dark:text-neutral-50 font-medium truncate max-w-[120px] sm:max-w-[180px]">
                {crumb.label != null ? crumb.label : t(crumb.labelKey)}
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
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      <div className={cn(
        'flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden',
        isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
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

        {/* Main Content - mobilde FAB yok, ekstra 4rem padding kaldırıldı */}
        <main className={cn(
          'flex-1 p-4 sm:p-6 lg:p-8 lg:pb-8',
          'max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))]'
        )}>
          <ErrorBoundary>
            <MobileSidebarProvider openSidebar={openMobileSidebarDrawer}>
              <Outlet />
            </MobileSidebarProvider>
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Mobile/Tablet Bottom Navigation - canWrite: Ana Sayfa, Operasyon, +, Müşteriler, İş Emri ; !canWrite: nav + More */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#171717] border-t border-neutral-200 dark:border-[#262626] px-2 py-1 pb-[env(safe-area-inset-bottom)] lg:hidden transition-colors h-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around h-full">
          {canWrite ? (
            <>
              {topNavItems.slice(0, 2).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  aria-label={tCommon(item.labelKey)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[56px] min-h-[44px]',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[64px]" aria-hidden="true">{tCommon(item.labelKey)}</span>
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => setQuickActionsOpen(true)}
                className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[56px] min-h-[44px] text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 hover:bg-primary-100 dark:hover:bg-primary-950/50"
                aria-label={tCommon('nav.quickActions.title')}
              >
                <Plus className="w-5 h-5 flex-shrink-0" />
                <span className="hidden sm:inline truncate max-w-[64px]" aria-hidden="true">+</span>
              </button>
              {topNavItems.slice(2).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  aria-label={tCommon(item.labelKey)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[56px] min-h-[44px]',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[64px]" aria-hidden="true">{tCommon(item.labelKey)}</span>
                </NavLink>
              ))}
            </>
          ) : (
            <>
              {topNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  aria-label={tCommon(item.labelKey)}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[56px] min-h-[44px]',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[64px]" aria-hidden="true">{tCommon(item.labelKey)}</span>
                </NavLink>
              ))}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[56px] min-h-[44px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              aria-label={tCommon('nav.more')}
            >
              <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline truncate max-w-[64px]" aria-hidden="true">{tCommon('nav.more')}</span>
            </button>
            </>
          )}
        </div>
      </nav>

      <MobileNavDrawer open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      <QuickActionsSheet
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onQuickEntry={(direction) => {
          setQuickActionsOpen(false);
          setQuickEntryState({ open: true, direction });
        }}
        hasFinanceAccess={hasFinanceAccess}
        canWrite={canWrite}
      />

      {/* Quick Entry FAB - sadece desktop, mobilde tab bar + kullanılıyor */}
      {hasFinanceAccess && (
        <button
          type="button"
          onClick={() => setQuickEntryState({ open: true, direction: null })}
          className="fixed max-lg:hidden lg:bottom-8 lg:right-8 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          aria-label={tCommon('finance:expense.addButton')}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <QuickEntryModal
        open={quickEntryState.open}
        onClose={() => setQuickEntryState({ open: false, direction: null })}
        direction={quickEntryState.direction}
      />
    </div>
  );
}
