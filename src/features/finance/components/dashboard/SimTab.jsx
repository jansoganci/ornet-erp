import { useTranslation } from 'react-i18next';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { formatCurrency } from '../../../../lib/utils';
import { useSimFinancialStats } from '../../../simCards/hooks';
import { ChannelKpiCard } from './ChannelKpiCard';

export function SimTab() {
  const { t } = useTranslation('finance');

  const {
    data: simStats,
    isLoading,
    error,
    refetch,
  } = useSimFinancialStats();

  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }

  const revenue = Number(simStats?.total_monthly_revenue) || 0;
  const costs = Number(simStats?.total_monthly_cost) || 0;
  const profit = Number(simStats?.total_monthly_profit) || 0;
  const grossMargin = revenue > 0
    ? Math.round((profit / revenue) * 10000) / 100
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChannelKpiCard
          title={t('dashboardV2.sim.revenue')}
          value={formatCurrency(revenue)}
          variant="positive"
          loading={isLoading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.sim.operatorCost')}
          value={`-${formatCurrency(costs)}`}
          variant="negative"
          loading={isLoading}
        />
        <ChannelKpiCard
          title={t('dashboardV2.sim.grossMargin')}
          value={grossMargin != null ? `%${grossMargin}` : '—'}
          variant={grossMargin != null && grossMargin >= 0 ? 'positive' : 'negative'}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
