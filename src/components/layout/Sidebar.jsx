import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { LogOut, User, Sun, Moon, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useTheme } from '../../hooks/themeContext';
import { useCurrentProfile } from '../../features/subscriptions/hooks';
import { navItems } from './navItems';

export function Sidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }) {
  const { t: tCommon } = useTranslation('common');
  const { t: tAuth } = useTranslation('auth');
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <>
      {/* Backdrop - Only for mobile/tablet drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-white dark:bg-[#171717] border-r border-neutral-200 dark:border-[#262626] flex flex-col transition-all duration-300 ease-in-out',
          // Mobile/Tablet: Drawer behavior
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Desktop: Width based on collapse state
          isCollapsed ? 'lg:w-16' : 'lg:w-64',
          // Mobile/Tablet: Always full width when open
          'w-64'
        )}
      >
        {/* Brand */}
        <div className={cn(
          'flex items-center justify-between h-16 border-b border-neutral-200 dark:border-[#262626]',
          isCollapsed ? 'px-4 lg:px-2 lg:justify-center' : 'px-6'
        )}>
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {tCommon('appName')}
            </h1>
          )}
          {isCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary-600 dark:bg-primary-500 flex items-center justify-center lg:mx-auto">
              <span className="text-white text-sm font-bold">O</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 py-6 space-y-1 overflow-y-auto',
          isCollapsed ? 'px-2' : 'px-4'
        )}>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={() => {
                // Close drawer on mobile/tablet after navigation
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                )
              }
              title={isCollapsed ? tCommon(item.labelKey) : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="truncate">{tCommon(item.labelKey)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className={cn(
          'border-t border-neutral-200 dark:border-[#262626] space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]',
          isCollapsed ? 'p-2' : 'p-4'
        )}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center w-full rounded-lg transition-colors text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800',
              isCollapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'
            )}
            title={isCollapsed ? (theme === 'light' ? tCommon('theme.darkMode') : tCommon('theme.lightMode')) : undefined}
          >
            <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
              {theme === 'light' ? <Moon className="w-5 h-5 text-primary-600" /> : <Sun className="w-5 h-5 text-warning-500" />}
              {!isCollapsed && (
                <span>{theme === 'light' ? tCommon('theme.darkMode') : tCommon('theme.lightMode')}</span>
              )}
            </div>
          </button>

          {/* User Info - Hidden when collapsed */}
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
                  {user?.email?.split('@')[0] || tCommon('labels.admin')}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
              </div>
            </div>
          )}
          
          {/* Logout Button */}
          {isSupabaseConfigured && (
            <button
              onClick={handleLogout}
              className={cn(
                'flex items-center justify-center w-full text-sm font-medium text-error-600 border border-error-200 dark:border-error-900/30 hover:bg-error-50 dark:hover:bg-error-950/30 rounded-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-0',
                isCollapsed ? 'px-2 py-2' : 'gap-2 px-4 py-2'
              )}
              title={isCollapsed ? tAuth('logout') : undefined}
            >
              <LogOut className="w-4 h-4" />
              {!isCollapsed && <span>{tAuth('logout')}</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
