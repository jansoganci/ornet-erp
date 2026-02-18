import { useTranslation } from 'react-i18next';
import { cn, formatDate } from '../../../lib/utils';

const statusDotClass = {
  pending:     'bg-warning-400',
  scheduled:   'bg-info-400',
  in_progress: 'bg-primary-500',
  completed:   'bg-success-500',
  cancelled:   'bg-neutral-400',
};

export function RecentWorkOrderRow({ workOrder, onClick }) {
  const { t } = useTranslation('common');

  const title = workOrder.description?.trim()
    || t(`workType.${workOrder.work_type}`, { defaultValue: workOrder.work_type });

  const workerName = workOrder.assigned_workers?.[0]?.name;
  const subtitle = [workOrder.site_name, workerName].filter(Boolean).join(' — ');

  const dotClass = statusDotClass[workOrder.status] ?? 'bg-neutral-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left group"
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', dotClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500 flex-shrink-0 tabular-nums">
        {workOrder.scheduled_date ? formatDate(workOrder.scheduled_date) : '—'}
      </p>
    </button>
  );
}
