import { Skeleton } from '../../../../components/ui/Skeleton';
import { cn } from '../../../../lib/utils';
import { Info } from 'lucide-react';

const VARIANT_CLASSES = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-600 dark:text-red-400',
  neutral: 'text-neutral-900 dark:text-neutral-50',
};

export function ChannelKpiCard({
  title,
  value,
  loading = false,
  variant = 'neutral',
  emphasis = false,
  infoTooltip,
}) {
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
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{title}</p>
        {infoTooltip && (
          <span className="relative group/info shrink-0">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-white/70 dark:bg-neutral-900/50">
              <Info className="w-3.5 h-3.5" />
            </span>
            <span className="pointer-events-none absolute right-0 top-6 z-30 hidden w-56 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-2 text-[11px] leading-4 text-neutral-700 dark:text-neutral-200 shadow-lg group-hover/info:block">
              {infoTooltip}
            </span>
          </span>
        )}
      </div>
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
