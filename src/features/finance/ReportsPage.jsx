import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Select, Spinner, ErrorState, EmptyState, TableSkeleton } from '../../components/ui';
import { useProfitAndLoss } from './hooks';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatCurrency } from '../../lib/utils';

function getLast6Months() {
  const months = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ value: `${y}-${m}`, label: `${y}-${m}` });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

function aggregatePL(plData) {
  let revenue = 0;
  let cogs = 0;
  let expenses = 0;
  for (const row of plData || []) {
    const amt = Number(row.amount_try) || 0;
    if (amt > 0) {
      revenue += amt;
      cogs += Number(row.cogs_try) || 0;
    } else {
      expenses += Math.abs(amt);
    }
  }
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;
  return {
    revenue: Math.round(revenue * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
  };
}

export function ReportsPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const period = searchParams.get('period') || defaultPeriod;
  const viewMode = searchParams.get('viewMode') || 'total';

  const monthOptions = useMemo(() => getLast6Months(), []);

  const handleFilterChange = (key, value) => {
    setSearchParams((prev) => {
      const isDefault = (k, v) =>
        (k === 'period' && v === defaultPeriod) ||
        (k === 'viewMode' && v === 'total');
      if (value && !isDefault(key, value)) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  };

  const { data: plData, isLoading, error, refetch } = useProfitAndLoss(period, viewMode);

  const pl = useMemo(() => aggregatePL(plData), [plData]);

  const hasData = pl.revenue > 0 || pl.expenses > 0;

  const breadcrumbs = [
    { label: t('common:nav.dashboard'), to: '/' },
    { label: t('finance:dashboard.title'), to: '/finance' },
    { label: t('finance:reports.title') },
  ];

  if (isLoading) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:reports.title')} />
        <div className="mt-6">
          <TableSkeleton cols={2} rows={5} />
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer maxWidth="xl" padding="default">
        <PageHeader title={t('finance:reports.title')} breadcrumbs={breadcrumbs} />
        <ErrorState message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader title={t('finance:reports.title')} breadcrumbs={breadcrumbs} />

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={monthOptions}
              value={period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={FileText}
          title={t('finance:reports.empty')}
          description={t('finance:reports.emptyDescription')}
        />
      ) : (
        <Card className="p-6 overflow-hidden">
          <div className="space-y-4 max-w-md">
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t('finance:reports.revenue')}
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatCurrency(pl.revenue)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
              <span className="text-sm text-neutral-600 dark:text-neutral-400 pl-4">
                - {t('finance:reports.cogs')}
              </span>
              <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                {formatCurrency(pl.cogs)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                = {t('finance:reports.grossProfit')}
              </span>
              <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatCurrency(pl.grossProfit)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-neutral-200 dark:border-[#262626]">
              <span className="text-sm text-neutral-600 dark:text-neutral-400 pl-4">
                - {t('finance:reports.operatingExpenses')}
              </span>
              <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                {formatCurrency(pl.expenses)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-base font-bold text-neutral-900 dark:text-neutral-50">
                = {t('finance:reports.netProfit')}
              </span>
              <span
                className={`text-base font-bold tabular-nums ${
                  pl.netProfit >= 0
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-error-600 dark:text-error-400'
                }`}
              >
                {formatCurrency(pl.netProfit)}
              </span>
            </div>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
