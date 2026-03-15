import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FileText, Download } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button, Card, Select, ErrorState, EmptyState, TableSkeleton } from '../../components/ui';
import { useProfitAndLoss } from './hooks';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getErrorMessage } from '../../lib/errorHandler';
import { toCSV, downloadCSV } from '../../lib/csvExport';
import { getSourceLabel } from './exportUtils';

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

  const handleExportCSV = () => {
    if (!plData?.length) return;
    const exportRows = plData.map((row) => ({
      period_date: formatDate(row.period_date),
      source_label: getSourceLabel(row.source_type, row.direction, t),
      direction_label: row.direction === 'income' ? t('finance:exportColumns.income') : t('finance:exportColumns.expense'),
      amount_try: row.amount_try != null && row.amount_try !== '' ? Number(row.amount_try) : '',
      original_currency: row.original_currency ?? 'TRY',
      output_vat: row.output_vat != null && row.output_vat !== '' ? Number(row.output_vat) : '',
      input_vat: row.input_vat != null && row.input_vat !== '' ? Number(row.input_vat) : '',
      cogs_try: row.cogs_try != null && row.cogs_try !== '' ? Number(row.cogs_try) : '',
    }));
    const columns = [
      { key: 'period_date', header: t('finance:exportColumns.date') },
      { key: 'source_label', header: t('finance:exportColumns.category') },
      { key: 'direction_label', header: t('finance:exportColumns.direction') },
      { key: 'amount_try', header: t('finance:exportColumns.amount') },
      { key: 'original_currency', header: t('finance:exportColumns.currency') },
      { key: 'output_vat', header: t('finance:exportColumns.outputVat') },
      { key: 'input_vat', header: t('finance:exportColumns.inputVat') },
      { key: 'cogs_try', header: t('finance:exportColumns.cogs') },
    ];
    const csv = toCSV(exportRows, columns);
    downloadCSV(csv, `${t('finance:export.plFilename')}_${period}.csv`);
  };

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
        <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="xl" padding="default" className="space-y-6">
      <PageHeader title={t('finance:reports.title')} breadcrumbs={breadcrumbs} />

      <Card className="p-4 border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={monthOptions}
              value={period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <ViewModeToggle value={viewMode} onChange={(v) => handleFilterChange('viewMode', v)} size="md" />
            {plData?.length > 0 && (
              <Button
                variant="outline"
                size="md"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportCSV}
              >
                {t('finance:export.csv')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {!hasData ? (
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
