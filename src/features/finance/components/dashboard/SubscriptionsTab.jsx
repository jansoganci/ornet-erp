import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { formatCurrency } from '../../../../lib/utils';
import { useChannelMetrics } from '../../hooks';
import { useSubscriptionStats } from '../../../subscriptions/hooks';
import { ChannelKpiCard } from './ChannelKpiCard';
import { ChannelBarChart } from './ChannelBarChart';

export function SubscriptionsTab({ year, month, viewMode }) {
  const { t } = useTranslation('finance');

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch,
  } = useChannelMetrics({ channel: 'subscriptions', year, month, viewMode });

  const { data: stats, isLoading: statsLoading } = useSubscriptionStats();

  if (metricsError) {
    return <ErrorState message={metricsError.message} onRetry={refetch} />;
  }

  const loading = metricsLoading || statsLoading;
  const mrr = Number(stats?.mrr) || 0;
  const distinctCustomers = Number(stats?.distinct_customer_count) || 0;
  const arpc = distinctCustomers > 0 ? Math.round((mrr / distinctCustomers) * 100) / 100 : 0;
  const grossMargin = metrics?.grossMarginPct;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChannelKpiCard
          title={t('dashboardV2.subscriptions.estimatedMonthly')}
          value={formatCurrency(mrr)}
          variant="positive"
          loading={loading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.subscriptions.perCustomer')}
          value={formatCurrency(arpc)}
          variant="neutral"
          loading={loading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.subscriptions.grossMargin')}
          value={grossMargin != null ? `%${grossMargin}` : '—'}
          variant={grossMargin != null && grossMargin >= 0 ? 'positive' : 'negative'}
          loading={loading}
        />
      </div>

      <div className="flex items-start gap-1.5 px-1">
        <Info className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs italic text-neutral-400 dark:text-neutral-500">
          {t('dashboardV2.subscriptions.hint')}
        </p>
      </div>

      <ChannelBarChart
        title={t('dashboardV2.subscriptions.chartTitle')}
        data={metrics?.monthlyBreakdown || []}
        loading={metricsLoading}
        revenueLabel={t('dashboardV2.chart.revenue')}
        costsLabel={t('dashboardV2.chart.costs')}
      />
    </div>
  );
}
