import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';
import { TrendingUp, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { useOperationsStats } from '../hooks';
import { REGIONS, CONTACT_STATUSES } from '../schema';
import { cn } from '../../../lib/utils';

const PERIOD_OPTIONS = [
  { value: 'this_month', labelKey: 'insights.thisMonth' },
  { value: 'last_month', labelKey: 'insights.lastMonth' },
  { value: 'this_quarter', labelKey: 'insights.thisQuarter' },
];

function getDateRange(period) {
  const now = new Date();
  switch (period) {
    case 'last_month': {
      const last = subMonths(now, 1);
      return { from: format(startOfMonth(last), 'yyyy-MM-dd'), to: format(endOfMonth(last), 'yyyy-MM-dd') };
    }
    case 'this_quarter':
      return { from: format(startOfQuarter(now), 'yyyy-MM-dd'), to: format(endOfQuarter(now), 'yyyy-MM-dd') };
    default:
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
}

const CONTACT_VARIANT = {
  not_contacted: 'error',
  no_answer: 'warning',
  confirmed: 'success',
  cancelled: 'default',
};

const REGION_VARIANT = {
  istanbul_europe: 'info',
  istanbul_anatolia: 'primary',
  outside_istanbul: 'default',
};

export function InsightsTab() {
  const { t } = useTranslation('operations');
  const [period, setPeriod] = useState('this_month');

  const { from: dateFrom, to: dateTo } = useMemo(() => getDateRange(period), [period]);
  const { data: stats, isLoading } = useOperationsStats(dateFrom, dateTo);

  const pool = stats?.pool ?? {};
  const periodStats = stats?.period ?? {};

  const totalInPeriod = (periodStats.completed ?? 0) + (periodStats.failed ?? 0);
  const successRate = totalInPeriod > 0 ? Math.round(((periodStats.completed ?? 0) / totalInPeriod) * 100) : 0;

  const periodOptions = PERIOD_OPTIONS.map((p) => ({
    value: p.value,
    label: t(p.labelKey),
  }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('insights.period')}:
        </span>
        <Select
          options={periodOptions}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          wrapperClassName="w-40"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Clock}
          label={t('insights.inPool')}
          value={pool.open ?? 0}
          variant="warning"
        />
        <KpiCard
          icon={TrendingUp}
          label={t('insights.scheduled')}
          value={pool.scheduled ?? 0}
          variant="info"
        />
        <KpiCard
          icon={CheckCircle}
          label={t('insights.successRate')}
          value={`${successRate}%`}
          variant="success"
        />
        <KpiCard
          icon={XCircle}
          label={t('insights.failed')}
          value={periodStats.failed ?? 0}
          variant="error"
        />
        <KpiCard
          icon={RefreshCw}
          label={t('insights.avgReschedules')}
          value={periodStats.avg_reschedules != null ? Number(periodStats.avg_reschedules).toFixed(1) : '0.0'}
          variant="default"
        />
      </div>

      {/* Breakdown cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Regional breakdown */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
            {t('insights.regionBreakdown')}
          </h4>
          <div className="space-y-2">
            {REGIONS.map((region) => {
              const count = pool.by_region?.[region] ?? 0;
              return (
                <div key={region} className="flex items-center justify-between">
                  <Badge variant={REGION_VARIANT[region]} size="sm">
                    {t(`regions.${region}`)}
                  </Badge>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Contact status breakdown */}
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
            {t('insights.contactBreakdown')}
          </h4>
          <div className="space-y-2">
            {CONTACT_STATUSES.filter((s) => s !== 'cancelled').map((status) => {
              const count = pool.by_contact?.[status] ?? 0;
              return (
                <div key={status} className="flex items-center justify-between">
                  <Badge variant={CONTACT_VARIANT[status]} size="sm" dot>
                    {t(`contactStatus.${status}`)}
                  </Badge>
                  <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Period totals */}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
          {t('insights.totalRequests')}
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              {periodStats.total ?? 0}
            </p>
            <p className="text-xs text-neutral-500">{t('insights.totalRequests')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-success-600 dark:text-success-400">
              {periodStats.completed ?? 0}
            </p>
            <p className="text-xs text-neutral-500">{t('status.completed')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-error-600 dark:text-error-400">
              {periodStats.failed ?? 0}
            </p>
            <p className="text-xs text-neutral-500">{t('status.failed')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, variant }) {
  const colorMap = {
    warning: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20',
    info: 'text-info-600 dark:text-info-400 bg-info-50 dark:bg-info-900/20',
    success: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/20',
    error: 'text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20',
    default: 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800',
  };

  return (
    <Card className="p-4">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', colorMap[variant])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{label}</p>
    </Card>
  );
}
