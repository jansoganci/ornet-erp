import { cn } from '../../../lib/utils';

export function LocationSummaryCard({ site, subscription, onClick }) {
  const isActive = site.is_active !== false;

  const priceStr = subscription?.base_price
    ? new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
      }).format(Number(subscription.base_price)) + '/ay'
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-[#262626] bg-white dark:bg-[#171717] hover:border-primary-500/50 dark:hover:border-primary-500/40 hover:shadow-sm transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'w-2 h-2 rounded-full flex-shrink-0 mt-0.5',
            isActive ? 'bg-success-500' : 'bg-neutral-400'
          )} />
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 truncate">
            {site.site_name || '—'}
          </p>
        </div>
        {priceStr && (
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0 tabular-nums">
            {priceStr}
          </p>
        )}
      </div>
      {site.panel_info && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 pl-4 truncate">
          {site.panel_info}
        </p>
      )}
    </button>
  );
}
