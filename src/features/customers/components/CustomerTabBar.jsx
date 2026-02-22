import { useTranslation } from 'react-i18next';
import { LayoutDashboard, MapPin, Wrench, Wifi, Package } from 'lucide-react';
import { cn } from '../../../lib/utils';

const TABS = [
  { key: 'overview',    icon: LayoutDashboard, labelKey: 'detail.tabs.overview' },
  { key: 'locations',   icon: MapPin,           labelKey: 'detail.tabs.locations',   countKey: 'locations' },
  { key: 'workOrders',  icon: Wrench,           labelKey: 'detail.tabs.workOrders',  countKey: 'workOrders' },
  { key: 'simCards',    icon: Wifi,             labelKey: 'detail.tabs.simCards',    countKey: 'simCards' },
  { key: 'equipment',   icon: Package,          labelKey: 'detail.tabs.equipment',   countKey: 'equipment' },
];

export function CustomerTabBar({ activeTab, onTabChange, counts = {} }) {
  const { t } = useTranslation('customers');

  return (
    <div className="flex items-center gap-1 p-1 w-full bg-neutral-100 dark:bg-neutral-800/60 rounded-xl overflow-x-auto no-scrollbar">
      {TABS.map(({ key, icon: IconComponent, labelKey, countKey }) => {
        const isActive = activeTab === key;
        const count = countKey != null ? (counts[countKey] ?? 0) : null;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 min-w-0',
              isActive
                ? 'bg-white dark:bg-[#171717] text-neutral-900 dark:text-neutral-50 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-white/60 dark:hover:bg-neutral-700/40'
            )}
          >
            <IconComponent className="w-4 h-4" />
            <span>{t(labelKey)}</span>
            {count != null && count > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[18px] text-center tabular-nums leading-none',
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                  : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
