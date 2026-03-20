import { useTranslation } from 'react-i18next';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { formatCurrency } from '../../../../lib/utils';
import { useChannelMetrics } from '../../hooks';
import { ChannelKpiCard } from './ChannelKpiCard';
import { ChannelBarChart } from './ChannelBarChart';

export function WorkTab({ year, month, viewMode }) {
  const { t } = useTranslation('finance');

  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useChannelMetrics({ channel: 'work', year, month, viewMode });

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }

  const grossMargin = metrics?.grossMarginPct;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChannelKpiCard
          title={t('dashboardV2.work.revenue')}
          value={formatCurrency(metrics?.revenue ?? 0)}
          variant="positive"
          loading={isLoading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.work.costs')}
          value={`-${formatCurrency(metrics?.costs ?? 0)}`}
          variant="negative"
          loading={isLoading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.work.grossMargin')}
          value={grossMargin != null ? `%${grossMargin}` : '—'}
          variant={grossMargin != null && grossMargin >= 0 ? 'positive' : 'negative'}
          loading={isLoading}
        />
      </div>

      <ChannelBarChart
        title={t('dashboardV2.work.chartTitle')}
        data={metrics?.monthlyBreakdown || []}
        loading={isLoading}
        revenueLabel={t('dashboardV2.chart.revenue')}
        costsLabel={t('dashboardV2.chart.costs')}
      />
    </div>
  );
}
