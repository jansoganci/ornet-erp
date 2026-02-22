import { cn } from '../../../lib/utils';
import { Card } from '../../../components/ui';

const variantStyles = {
  success: 'bg-success-50 dark:bg-success-950/20 text-success-600 dark:text-success-400',
  warning: 'bg-warning-50 dark:bg-warning-950/20 text-warning-600 dark:text-warning-400',
  error:   'bg-error-50 dark:bg-error-950/20 text-error-600 dark:text-error-400',
  info:    'bg-info-50 dark:bg-info-950/20 text-info-600 dark:text-info-400',
  default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
};

export function CustomerMetricCard({ icon: IconComponent, label, value, variant = 'default' }) {
  return (
    <Card padding="compact" className="flex items-center gap-4">
      <div className={cn('p-2.5 rounded-xl flex-shrink-0', variantStyles[variant])}>
        <IconComponent className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums leading-none">
          {value}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 truncate">{label}</p>
      </div>
    </Card>
  );
}
