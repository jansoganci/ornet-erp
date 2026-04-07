import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  PlusCircle,
  MinusCircle,
  Download,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui';
import { Skeleton } from '../../components/ui/Skeleton';
import { FinanceDashboardFilters } from './components/dashboard/FinanceDashboardFilters';
import { ChannelKpiCard } from './components/dashboard/ChannelKpiCard';
import { ChannelBarChart } from './components/dashboard/ChannelBarChart';
import { FinanceHealthBanner } from './components/dashboard/FinanceHealthBanner';
import { QuickEntryModal } from './components/QuickEntryModal';
import {
  useOverviewTotals,
  useRevenueExpensesByMonth,
  useIncomeBySource,
  useExpensesBySource,
} from './hooks';
import { fetchProfitAndLoss } from './api';
import { formatCurrency } from '../../lib/utils';
import { toCSV, downloadCSV } from '../../lib/csvExport';
import { getSourceLabel } from './exportUtils';

function mapIncomeSourceToGroup(sourceType) {
  if (sourceType === 'subscription') return 'subscriptions';
  if (sourceType === 'sim_rental') return 'sim';
  if (sourceType === 'proposal') return 'proposals';
  if (['service', 'installation', 'maintenance', 'sale'].includes(sourceType)) return 'workOrders';
  return 'other';
}

function BreakdownCard({ title, rows, total, loading, totalLabel }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
        <div className="mb-4">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
      <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 py-3">—</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-300">{row.label}</span>
              <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {formatCurrency(row.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 pt-3 border-t border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between">
        <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{totalLabel}</span>
        <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export function FinanceDashboardPage() {
  const { t } = useTranslation(['finance', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const year = Number(searchParams.get('year')) || defaultYear;
  const monthParam = searchParams.get('month');
  const month = monthParam ? Number(monthParam) : defaultMonth;
  const viewMode = searchParams.get('viewMode') || 'total';

  const updateParam = (key, value, defaultValue) => {
    setSearchParams((prev) => {
      if (value === defaultValue || value === null || value === undefined || value === '') {
        prev.delete(key);
      } else {
        prev.set(key, String(value));
      }
      return prev;
    });
  };

  const handleYearChange = (v) => updateParam('year', v, defaultYear);
  const handleMonthChange = (v) => updateParam('month', v, defaultMonth);
  const handleViewModeChange = (v) => updateParam('viewMode', v, 'total');

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [quickEntry, setQuickEntry] = useState({ open: false, direction: null });
  const [isExporting, setIsExporting] = useState(false);

  const filterProps = { year, month, viewMode };

  const { data: overviewTotals, isLoading: overviewLoading } = useOverviewTotals(filterProps);
  const { data: incomeBySource = [], isLoading: incomeLoading } = useIncomeBySource(filterProps);
  const { data: expensesBySource = [], isLoading: expensesLoading } = useExpensesBySource(filterProps);
  const { data: revenueByMonth = [], isLoading: revenueByMonthLoading } = useRevenueExpensesByMonth({
    months: 6,
    viewMode,
  });

  const monthNames = t('common:monthsFull', { returnObjects: true });
  const periodLabel = month
    ? `${monthNames[month - 1]} ${year}`
    : String(year);

  const totalRevenue = overviewTotals?.totalRevenue ?? 0;
  const totalExpenses = overviewTotals?.totalExpenses ?? 0;
  const remaining = overviewTotals?.remaining ?? 0;

  const chartData = useMemo(
    () => revenueByMonth.map((d) => ({ period: d.period, revenue: d.revenue, costs: d.expenses })),
    [revenueByMonth]
  );

  const incomeRows = useMemo(() => {
    const grouped = {
      subscriptions: 0,
      workOrders: 0,
      sim: 0,
      proposals: 0,
      other: 0,
    };
    for (const row of incomeBySource) {
      const group = mapIncomeSourceToGroup(row.source_type);
      grouped[group] += Number(row.amount) || 0;
    }
    return [
      { key: 'subscriptions', label: t('common:nav.subscriptions'), amount: grouped.subscriptions },
      { key: 'workOrders', label: t('common:nav.workOrders'), amount: grouped.workOrders },
      { key: 'sim', label: t('simCards:title'), amount: grouped.sim },
      { key: 'proposals', label: t('common:nav.proposals'), amount: grouped.proposals },
      { key: 'other', label: t('common:type.other'), amount: grouped.other },
    ].filter((item) => item.amount > 0);
  }, [incomeBySource, t]);

  const expenseRows = useMemo(
    () => expensesBySource.map((row) => ({
      key: row.source_type || 'other',
      label: getSourceLabel(row.source_type, 'expense', t),
      amount: Number(row.amount) || 0,
    })),
    [expensesBySource, t]
  );

  const handleExportCSV = async () => {
    const period = month ? `${year}-${String(month).padStart(2, '0')}` : null;
    setIsExporting(true);
    try {
      const plData = await fetchProfitAndLoss(period, viewMode);
      if (!plData?.length) return;

      const exportRows = plData.map((row) => ({
        period_date: row.period_date,
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
      const filenamePeriod = period || String(year);
      downloadCSV(csv, `${t('finance:export.plFilename')}_${filenamePeriod}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageContainer maxWidth="full" padding="default">
      {/* ===== MOBILE LAYOUT ===== */}
      <div className="md:hidden space-y-4">
        <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-3 pb-3 bg-white dark:bg-[#171717] border-b border-neutral-200 dark:border-[#262626]">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              {t('dashboardV2.title')}
            </h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMobileFilters((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-[#262626] text-sm font-medium text-neutral-700 dark:text-neutral-200 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                {periodLabel}
              </button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportCSV}
                loading={isExporting}
              >
                {t('finance:export.csv')}
              </Button>
            </div>
          </div>

          {showMobileFilters && (
            <div className="mt-3">
              <FinanceDashboardFilters
                year={year}
                month={month}
                viewMode={viewMode}
                onYearChange={handleYearChange}
                onMonthChange={handleMonthChange}
                onViewModeChange={handleViewModeChange}
              />
            </div>
          )}
        </div>

        <FinanceHealthBanner />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ChannelKpiCard
            title={t('dashboardV2.overview.totalRevenue')}
            value={formatCurrency(totalRevenue)}
            loading={overviewLoading}
            variant="positive"
          />
          <ChannelKpiCard
            title={t('dashboardV2.overview.totalExpenses')}
            value={formatCurrency(totalExpenses)}
            loading={overviewLoading}
            variant="negative"
          />
          <ChannelKpiCard
            title={t('dashboardV2.overview.remaining')}
            value={formatCurrency(remaining)}
            loading={overviewLoading}
            variant={remaining >= 0 ? 'positive' : 'negative'}
            emphasis
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <BreakdownCard
            title={t('dashboardV2.overview.totalRevenue')}
            rows={incomeRows}
            total={totalRevenue}
            loading={incomeLoading}
            totalLabel={t('finance:exportColumns.total')}
          />
          <BreakdownCard
            title={t('dashboardV2.overview.totalExpenses')}
            rows={expenseRows}
            total={totalExpenses}
            loading={expensesLoading}
            totalLabel={t('finance:exportColumns.total')}
          />
        </div>

        <ChannelBarChart
          title={t('dashboardV2.mobile.cashFlow')}
          data={chartData}
          loading={revenueByMonthLoading}
          revenueLabel={t('dashboardV2.chart.revenue')}
          costsLabel={t('dashboardV2.chart.expenses')}
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setQuickEntry({ open: true, direction: 'income' })}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-green-500/30 bg-green-500/10 dark:bg-green-500/5 text-green-600 dark:text-green-400 text-sm font-semibold transition-colors active:bg-green-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            {t('quickActions.addIncome')}
          </button>
          <button
            type="button"
            onClick={() => setQuickEntry({ open: true, direction: 'expense' })}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 dark:bg-red-500/5 text-red-600 dark:text-red-400 text-sm font-semibold transition-colors active:bg-red-500/20"
          >
            <MinusCircle className="w-4 h-4" />
            {t('quickActions.addExpense')}
          </button>
        </div>
      </div>

      <div className="hidden md:block space-y-6">
        <PageHeader
          title={t('finance:dashboardV2.title')}
          breadcrumbs={[
            { label: t('common:nav.dashboard'), to: '/' },
            { label: t('finance:dashboardV2.title') },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportCSV}
                loading={isExporting}
              >
                {t('finance:export.csv')}
              </Button>
              <Button
                variant="outline"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                onClick={() => setQuickEntry({ open: true, direction: 'income' })}
              >
                {t('finance:quickActions.addIncome')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<MinusCircle className="w-4 h-4" />}
                onClick={() => setQuickEntry({ open: true, direction: 'expense' })}
              >
                {t('finance:quickActions.addExpense')}
              </Button>
            </div>
          }
        />

        <FinanceHealthBanner />

        <FinanceDashboardFilters
          year={year}
          month={month}
          viewMode={viewMode}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          onViewModeChange={handleViewModeChange}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChannelKpiCard
            title={t('dashboardV2.overview.totalRevenue')}
            value={formatCurrency(totalRevenue)}
            loading={overviewLoading}
            variant="positive"
          />
          <ChannelKpiCard
            title={t('dashboardV2.overview.totalExpenses')}
            value={formatCurrency(totalExpenses)}
            loading={overviewLoading}
            variant="negative"
          />
          <ChannelKpiCard
            title={t('dashboardV2.overview.remaining')}
            value={formatCurrency(remaining)}
            loading={overviewLoading}
            variant={remaining >= 0 ? 'positive' : 'negative'}
            emphasis
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <BreakdownCard
            title={t('dashboardV2.overview.totalRevenue')}
            rows={incomeRows}
            total={totalRevenue}
            loading={incomeLoading}
            totalLabel={t('finance:exportColumns.total')}
          />
          <BreakdownCard
            title={t('dashboardV2.overview.totalExpenses')}
            rows={expenseRows}
            total={totalExpenses}
            loading={expensesLoading}
            totalLabel={t('finance:exportColumns.total')}
          />
        </div>

        <ChannelBarChart
          title={t('dashboardV2.mobile.cashFlow')}
          data={chartData}
          loading={revenueByMonthLoading}
          revenueLabel={t('dashboardV2.chart.revenue')}
          costsLabel={t('dashboardV2.chart.expenses')}
        />
      </div>

      <QuickEntryModal
        open={quickEntry.open}
        onClose={() => setQuickEntry({ open: false, direction: null })}
        direction={quickEntry.direction}
      />
    </PageContainer>
  );
}
