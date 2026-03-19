import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, Banknote } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Layout for Subscriptions module with tabbed navigation.
 * Tab 1: Abonelik Listesi (subscription list)
 * Tab 2: Tahsilat Masası (collection desk)
 * Tabs only visible on /subscriptions and /subscriptions/collection.
 */
export function SubscriptionsLayout() {
  const { t } = useTranslation(['subscriptions', 'common']);
  const { pathname } = useLocation();
  const showTabs = pathname === '/subscriptions' || pathname === '/subscriptions/collection';

  return (
    <div className="space-y-6">
      {showTabs && (
        <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-[#262626] w-fit">
          <NavLink
            to="/subscriptions"
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-white dark:bg-[#171717] text-primary-700 dark:text-primary-400 shadow-sm border border-neutral-200 dark:border-[#262626]'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              )
            }
          >
            <CreditCard className="w-4 h-4" />
            {t('subscriptions:tabs.list')}
          </NavLink>
          <NavLink
            to="/subscriptions/collection"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-white dark:bg-[#171717] text-primary-700 dark:text-primary-400 shadow-sm border border-neutral-200 dark:border-[#262626]'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
              )
            }
          >
            <Banknote className="w-4 h-4" />
            {t('subscriptions:tabs.collection')}
          </NavLink>
        </div>
      )}
      <Outlet />
    </div>
  );
}
