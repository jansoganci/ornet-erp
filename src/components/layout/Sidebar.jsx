import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { LogOut, User, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { useCurrentProfile } from '../../features/subscriptions/hooks';
import { navItems } from './navItems';
import { NavGroup } from './NavGroup';

function isFlatItem(item) {
  return !item.type || item.type !== 'group';
}

const DEFAULT_GROUP_STATE = {
  planning: true,
  revenueInfra: true,
  settings: false, // Ayarlar default collapsed (less frequently used)
};

function loadGroupState() {
  try {
    const saved = localStorage.getItem('sidebarGroups');
    if (saved) return { ...DEFAULT_GROUP_STATE, ...JSON.parse(saved) };
  } catch {
    // ignore invalid JSON
  }
  return DEFAULT_GROUP_STATE;
}

export function Sidebar({ isOpen, onClose, isCollapsed = false }) {
  const { t: tCommon } = useTranslation('common');
  const { t: tAuth } = useTranslation('auth');
  const { user, signOut } = useAuth();
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const [groupState, setGroupState] = useState(loadGroupState);

  useEffect(() => {
    localStorage.setItem('sidebarGroups', JSON.stringify(groupState));
  }, [groupState]);

  const handleGroupToggle = (id) => {
    setGroupState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024) onClose();
  };

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
          'fixed inset-y-0 left-0 z-50 bg-white dark:bg-[#171717] border-r border-neutral-200 dark:border-[#262626] flex flex-col transition-all duration-300 ease-in-out shadow-sm overflow-hidden',
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
            <h1 className="text-xl font-bold font-heading text-primary-600 dark:text-primary-400">
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
          'flex-1 py-6 space-y-1 overflow-y-auto overflow-x-hidden',
          isCollapsed ? 'px-2' : 'px-4'
        )}>
          {visibleNavItems.map((item) =>
            isFlatItem(item) ? (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] min-w-[44px]',
                    isCollapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 shadow-sm border-l-2 border-primary-600 dark:border-primary-500'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200'
                  )
                }
                title={isCollapsed ? tCommon(item.labelKey) : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="flex-1 truncate">{tCommon(item.labelKey)}</span>
                )}
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    'flex items-center justify-center rounded-full bg-primary-600 dark:bg-primary-500 text-white text-xs font-semibold min-w-[20px] h-5 px-1.5',
                    isCollapsed ? 'absolute -top-1 -right-1' : ''
                  )}>
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </NavLink>
            ) : (
              <NavGroup
                key={item.id}
                id={item.id}
                labelKey={item.labelKey}
                icon={item.icon}
                children={item.children}
                isCollapsed={isCollapsed}
                expanded={groupState[item.id] ?? true}
                onToggle={() => handleGroupToggle(item.id)}
                onItemClick={handleNavClick}
              />
            )
          )}
        </nav>

        {/* User / Logout */}
        <div className={cn(
          'border-t border-neutral-200 dark:border-[#262626] space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]',
          isCollapsed ? 'p-2' : 'p-4'
        )}>

          {/* User Info - Clickable link to profile */}
          <Link
            to="/profile"
            onClick={handleNavClick}
            className={cn(
              'flex items-center rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800',
              isCollapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
            )}
            title={isCollapsed ? tCommon('nav.profile') : undefined}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate">
                  {currentProfile?.full_name || user?.email?.split('@')[0] || tCommon('labels.admin')}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user?.email}</p>
              </div>
            )}
          </Link>

          {/* Logout Button */}
          {isSupabaseConfigured && (
            <button
              onClick={handleLogout}
              className={cn(
                'flex items-center justify-center w-full text-sm font-medium text-error-600 border border-error-200 dark:border-error-900/30 hover:bg-error-50 dark:hover:bg-error-950/30 rounded-md transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-0',
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
