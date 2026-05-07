import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../lib/utils';

export function VatSummaryStrip({ netAmount, vatRate, show, direction = 'expense' }) {
  const { t } = useTranslation('finance');

  if (!show) return null;

  const net = Number(netAmount) || 0;
  const rate = Number(vatRate) || 0;
  const vatAmount = Math.round(net * rate / 100 * 100) / 100;
  const total = net + vatAmount;

  const totalColor =
    direction === 'income'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800 p-4">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-neutral-500 dark:text-neutral-400 mb-3">
        {t('vatSummary.title')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
            {t('vatSummary.net')}
          </p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">
            {formatCurrency(net)}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
            {t('vatSummary.vatAmount', { rate })}
          </p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">
            {formatCurrency(vatAmount)}
          </p>
        </div>
        <div className="sm:border-l sm:border-neutral-200 dark:sm:border-neutral-700 sm:pl-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
            {t('vatSummary.total')}
          </p>
          <p className={`text-sm font-bold tabular-nums ${totalColor}`}>
            {formatCurrency(total)}
          </p>
        </div>
      </div>
    </div>
  );
}
