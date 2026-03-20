import { useTranslation } from 'react-i18next';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Card } from '../../../../components/ui/Card';
import { formatCurrency } from '../../../../lib/utils';
import { useOverviewTotals, useGeneralExpenses } from '../../hooks';
import { ChannelKpiCard } from './ChannelKpiCard';

export function OverviewTab({ year, month, viewMode }) {
  const { t } = useTranslation('finance');

  const {
    data: totals,
    isLoading: totalsLoading,
    error: totalsError,
    refetch,
  } = useOverviewTotals({ year, month, viewMode });

  const {
    data: generalExpenses = [],
    isLoading: expensesLoading,
  } = useGeneralExpenses({ year, month, viewMode });

  if (totalsError) {
    return <ErrorState message={totalsError.message} onRetry={refetch} />;
  }

  const loading = totalsLoading;
  const remaining = totals?.remaining ?? 0;
  const remainingVariant = remaining >= 0 ? 'positive' : 'negative';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChannelKpiCard
          title={t('dashboardV2.overview.totalRevenue')}
          value={formatCurrency(totals?.totalRevenue ?? 0)}
          variant="positive"
          loading={loading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.overview.totalExpenses')}
          value={`-${formatCurrency(totals?.totalExpenses ?? 0)}`}
          variant="negative"
          loading={loading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.overview.remaining')}
          value={`${remaining >= 0 ? '+' : ''}${formatCurrency(remaining)}`}
          variant={remainingVariant}
          emphasis
          loading={loading}
        />
      </div>

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-3">
          {t('dashboardV2.overview.generalExpenses')}
        </h3>

        {expensesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : generalExpenses.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">
            {t('dashboardV2.overview.noExpenses')}
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {generalExpenses.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between py-2.5"
              >
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {t(`expenseCategories.${item.category}`, { defaultValue: item.category })}
                </span>
                <span className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
