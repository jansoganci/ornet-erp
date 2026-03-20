import { Skeleton } from '../../../../components/ui/Skeleton';
import { cn } from '../../../../lib/utils';

const VARIANT_CLASSES = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-neutral-900 dark:text-neutral-50',
};

export function ChannelKpiCard({ title, value, loading = false, variant = 'neutral', emphasis = false }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
        <Skeleton className="h-3 w-24 mb-2" />
        <Skeleton className="h-7 w-20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white dark:bg-[#171717] p-4',
        emphasis
          ? 'border-neutral-300 dark:border-neutral-700 shadow-sm'
          : 'border-neutral-200/60 dark:border-neutral-800/60'
      )}
    >
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{title}</p>
      <p
        className={cn(
          'font-bold tabular-nums',
          emphasis ? 'text-2xl' : 'text-xl',
          VARIANT_CLASSES[variant]
        )}
      >
        {value}
      </p>
    </div>
  );
}
