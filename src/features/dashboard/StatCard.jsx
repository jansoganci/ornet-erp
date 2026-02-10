import { Card } from '../../components/ui';
import { cn } from '../../lib/utils';

/**
 * Compact stat card – single neutral style, no icon box.
 * Icon (if passed) is inline at left with text color only; no background box.
 */
export function StatCard({ title, value, icon, loading = false, onClick }) {
  const Icon = icon;
  const isInteractive = typeof onClick === 'function';

  return (
    <Card
      className={cn(
        'p-3 flex items-center gap-3 border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] transition-colors',
        isInteractive && 'cursor-pointer hover:border-neutral-300 dark:hover:border-[#404040]'
      )}
      onClick={isInteractive ? onClick : undefined}
    >
      {Icon && (
        <span className="flex-shrink-0 text-neutral-500 dark:text-neutral-400">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{title}</p>
        {loading ? (
          <div className="h-5 w-12 bg-neutral-100 dark:bg-[#262626] animate-pulse rounded mt-0.5" />
        ) : (
          <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mt-0.5 tabular-nums">{value}</p>
        )}
      </div>
    </Card>
  );
}
