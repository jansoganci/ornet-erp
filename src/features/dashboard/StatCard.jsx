import { Card } from '../../components/ui';
import { cn } from '../../lib/utils';

export function StatCard({ title, value, icon, variant = 'default', loading = false }) {
  const Icon = icon;
  const variants = {
    default: 'border-neutral-200 dark:border-[#262626]',
    primary: 'border-primary-100 dark:border-primary-900/30 bg-primary-50/30 dark:bg-primary-900/10',
    success: 'border-success-100 dark:border-success-900/30 bg-success-50/30 dark:bg-success-900/10',
    warning: 'border-warning-100 dark:border-warning-900/30 bg-warning-50/30 dark:bg-warning-900/10',
    error: 'border-error-100 dark:border-error-900/30 bg-error-50/30 dark:bg-error-900/10',
    info: 'border-info-100 dark:border-info-900/30 bg-info-50/30 dark:bg-info-900/10',
  };

  const iconColors = {
    default: 'text-neutral-500 dark:text-neutral-400',
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    error: 'text-error-600 dark:text-error-400',
    info: 'text-info-600 dark:text-info-400',
  };

  return (
    <Card className={cn('p-5 flex items-center gap-4 transition-all', variants[variant])}>
      <div className={cn('p-3 rounded-xl bg-white dark:bg-[#171717] shadow-sm', iconColors[variant])}>
        {Icon && <Icon className="w-6 h-6" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 truncate">{title}</p>
        {loading ? (
          <div className="h-8 w-16 bg-neutral-100 dark:bg-[#171717] animate-pulse rounded mt-1" />
        ) : (
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mt-0.5">{value}</h3>
        )}
      </div>
    </Card>
  );
}
