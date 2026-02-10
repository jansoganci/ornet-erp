import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';

const FILTERS = ['all', 'workOrders', 'plans'];

export function CalendarFilterBar({ value, onChange }) {
  const { t } = useTranslation('calendar');

  return (
    <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 p-0.5 bg-neutral-50 dark:bg-[#1a1a1a]">
      {FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap',
            value === filter
              ? 'bg-white dark:bg-[#262626] text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          )}
        >
          {t(`filter.${filter}`)}
        </button>
      ))}
    </div>
  );
}
