import { RefreshCw, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLatestRate, useFetchTcmbRates } from '../../finance/hooks';
import { Skeleton } from '../../../components/ui';
import { cn } from '../../../lib/utils';

/**
 * CurrencyWidget — Compact inline USD/TRY rate chip.
 * Designed to sit on the right side of the dashboard welcome row.
 * Glassmorphism tokens match the rest of the dashboard cards.
 */
export function CurrencyWidget() {
  const { t } = useTranslation('finance');
  const { data: usdRate, isLoading } = useLatestRate('USD');
  const fetchTcmbRatesMutation = useFetchTcmbRates();

  if (isLoading) {
    return <Skeleton className="h-10 w-56 rounded-xl flex-shrink-0" />;
  }

  const buy  = usdRate?.buy_rate  ? Number(usdRate.buy_rate).toFixed(4)  : '–';
  const sell = usdRate?.sell_rate ? Number(usdRate.sell_rate).toFixed(4) : '–';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3.5 py-2 flex-shrink-0',
      'bg-white border-gray-200',
      'dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10'
    )}>
      {/* Icon + label */}
      <div className="flex items-center gap-1.5">
        <DollarSign className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          USD/TRY
        </span>
      </div>

      {/* Divider */}
      <span className="w-px h-4 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

      {/* Buy */}
      <div className="text-center">
        <p className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 uppercase leading-none mb-0.5">
          {t('exchangeRates.effectiveBuy')}
        </p>
        <p className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
          {buy}
        </p>
      </div>

      {/* Sell */}
      <div className="text-center">
        <p className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 uppercase leading-none mb-0.5">
          {t('exchangeRates.effectiveSell')}
        </p>
        <p className="text-xs font-semibold tabular-nums text-primary-600 dark:text-primary-400">
          {sell}
        </p>
      </div>

      {/* Divider */}
      <span className="w-px h-4 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

      {/* Refresh */}
      <button
        type="button"
        onClick={() => fetchTcmbRatesMutation.mutate()}
        disabled={fetchTcmbRatesMutation.isPending}
        title={t('exchangeRates.fetchTcmb')}
        className="flex items-center justify-center w-6 h-6 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
      >
        <RefreshCw className={cn('w-3 h-3', fetchTcmbRatesMutation.isPending && 'animate-spin')} />
      </button>
    </div>
  );
}
