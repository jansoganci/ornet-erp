import { Card } from '../../../components/ui';
import { cn } from '../../../lib/utils';

export function KpiCard({ title, value, icon: Icon, loading = false, onClick }) {
  const isInteractive = typeof onClick === 'function';

  return (
    <Card
      className={cn(
        'p-4 flex items-center gap-3 border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] transition-colors',
        isInteractive && 'cursor-pointer hover:border-neutral-300 dark:hover:border-[#404040]'
      )}
      onClick={isInteractive ? onClick : undefined}
    >
      {Icon && (
        <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/20 flex-shrink-0">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider truncate">{title}</p>
        {loading ? (
          <div className="h-6 w-20 bg-neutral-100 dark:bg-[#262626] animate-pulse rounded mt-1" />
        ) : (
          <p className="text-lg font-black text-neutral-900 dark:text-neutral-50 mt-1 tabular-nums truncate">{value}</p>
        )}
      </div>
    </Card>
  );
}
