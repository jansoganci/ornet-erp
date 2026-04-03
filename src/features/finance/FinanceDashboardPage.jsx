import { useMemo, useState } from 'react';
// NOTE: useMemo is kept for mobileKpis / mobileChartData pure computations below.
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  LayoutGrid,
  ClipboardList,
  Receipt,
  Wifi,
  PlusCircle,
  MinusCircle,
  ChevronRight,
  Fuel,
  Building2,
  Users,
  Cloud,
  MoreHorizontal,
  Wallet,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/layout';
import { Button } from '../../components/ui';
import { Skeleton } from '../../components/ui/Skeleton';
import { FinanceDashboardFilters } from './components/dashboard/FinanceDashboardFilters';
import { FinanceDashboardTabs } from './components/dashboard/FinanceDashboardTabs';
import { OverviewTab } from './components/dashboard/OverviewTab';
import { WorkTab } from './components/dashboard/WorkTab';
import { SubscriptionsTab } from './components/dashboard/SubscriptionsTab';
import { SimTab } from './components/dashboard/SimTab';
import { ChannelBarChart } from './components/dashboard/ChannelBarChart';
import { FinanceHealthBanner } from './components/dashboard/FinanceHealthBanner';
import { QuickEntryModal } from './components/QuickEntryModal';
import {
  useOverviewTotals,
  useGeneralExpenses,
  useChannelMetrics,
  useRevenueExpensesByMonth,
} from './hooks';
import { formatCurrency } from '../../lib/utils';

const VALID_TABS = ['overview', 'work', 'subscriptions', 'sim'];

const TAB_ICONS = {
  overview: LayoutGrid,
  work: ClipboardList,
  subscriptions: Receipt,
  sim: Wifi,
};

const CATEGORY_ICONS = {
  fuel: Fuel,
  rent: Building2,
  payroll: Users,
  software: Cloud,
  sim_operator: Wifi,
  other: MoreHorizontal,
};

export function FinanceDashboardPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const year = Number(searchParams.get('year')) || defaultYear;
  const monthParam = searchParams.get('month');
  const month = monthParam ? Number(monthParam) : defaultMonth;
  const viewMode = searchParams.get('viewMode') || 'total';
  const tab = searchParams.get('tab') || 'overview';
  const activeTab = VALID_TABS.includes(tab) ? tab : 'overview';

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
  const handleTabChange = (v) => updateParam('tab', v, 'overview');

  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [quickEntry, setQuickEntry] = useState({ open: false, direction: null });

  const tabProps = { year, month, viewMode };
  const activeChannel = activeTab !== 'overview' ? activeTab : null;

  const { data: overviewTotals, isLoading: overviewLoading } = useOverviewTotals(tabProps);
  const { data: channelMetrics, isLoading: channelLoading } = useChannelMetrics({
    channel: activeChannel,
    ...tabProps,
  });
  const { data: generalExpenses = [], isLoading: expensesLoading } = useGeneralExpenses(tabProps);
  const { data: revenueByMonth = [], isLoading: revenueByMonthLoading } = useRevenueExpensesByMonth({
    months: 6,
    viewMode,
  });

  const monthNames = t('common:monthsFull', { returnObjects: true });
  const periodLabel = month
    ? `${monthNames[month - 1]} ${year}`
    : String(year);

  const mobileKpis = useMemo(() => {
    if (activeTab === 'overview') {
      const revenue = overviewTotals?.totalRevenue ?? 0;
      const expenses = overviewTotals?.totalExpenses ?? 0;
      const netProfit = overviewTotals?.remaining ?? 0;
      const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : null;
      return { revenue, expenses, netProfit, margin };
    }
    const revenue = channelMetrics?.revenue ?? 0;
    const costs = channelMetrics?.costs ?? 0;
    const netProfit = Math.round((revenue - costs) * 100) / 100;
    const margin = channelMetrics?.grossMarginPct;
    return { revenue, expenses: costs, netProfit, margin };
  }, [activeTab, overviewTotals, channelMetrics]);

  const mobileChartData = useMemo(() => {
    if (activeTab === 'overview') {
      return revenueByMonth.map((d) => ({
        period: d.period,
        revenue: d.revenue,
        costs: d.expenses,
      }));
    }
    return channelMetrics?.monthlyBreakdown || [];
  }, [activeTab, revenueByMonth, channelMetrics]);

  const mobileChartConfig = useMemo(() => {
    switch (activeTab) {
      case 'work':
        return { title: t('dashboardV2.work.chartTitle'), costsLabel: t('dashboardV2.chart.costs') };
      case 'subscriptions':
        return { title: t('dashboardV2.subscriptions.chartTitle'), costsLabel: t('dashboardV2.chart.costs') };
      case 'sim':
        return { title: t('dashboardV2.sim.chartTitle'), costsLabel: t('dashboardV2.chart.expenses') };
      default:
        return { title: t('dashboardV2.mobile.cashFlow'), costsLabel: t('dashboardV2.chart.expenses') };
    }
  }, [activeTab, t]);

  const mobileKpiLoading = activeTab === 'overview' ? overviewLoading : channelLoading;
  const mobileChartLoading = activeTab === 'overview' ? revenueByMonthLoading : channelLoading;

  return (
    <PageContainer maxWidth="full" padding="default">
      {/* ===== MOBILE LAYOUT ===== */}
      <div className="md:hidden space-y-4">
        {/* Sticky Header */}
        <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-3 pb-3 bg-white dark:bg-[#171717] border-b border-neutral-200 dark:border-[#262626]">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              {t('dashboardV2.mobileTitle')}
            </h1>
            <button
              type="button"
              onClick={() => setShowMobileFilters((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-[#262626] text-sm font-medium text-neutral-700 dark:text-neutral-200 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              {periodLabel}
            </button>
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

        {/* Health Banner — shown when finance entries have integrity issues */}
        <FinanceHealthBanner />

        {/* Tab Bar */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {VALID_TABS.map((tabKey) => {
            const Icon = TAB_ICONS[tabKey];
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => handleTabChange(tabKey)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-[#262626] text-primary-600 dark:text-primary-400 font-bold'
                    : 'text-neutral-500 dark:text-neutral-400 font-medium'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(`dashboardV2.tabs.${tabKey}`)}
              </button>
            );
          })}
        </div>

        {/* KPI 2×2 Grid */}
        {mobileKpiLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border-l-4 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#171717] p-3.5"
              >
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Gelir */}
            <div className="rounded-xl border-l-4 border-green-400/50 bg-white dark:bg-[#171717] p-3.5">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                {t('dashboardV2.mobile.income')}
              </p>
              <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">
                {formatCurrency(mobileKpis.revenue)}
              </p>
            </div>

            {/* Gider */}
            <div className="rounded-xl border-l-4 border-red-400/50 bg-white dark:bg-[#171717] p-3.5">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                {t('dashboardV2.mobile.expense')}
              </p>
              <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(mobileKpis.expenses)}
              </p>
            </div>

            {/* Net Kar */}
            <div
              className={`rounded-xl border-l-4 ${
                mobileKpis.netProfit >= 0 ? 'border-primary/50' : 'border-red-400/50'
              } bg-white dark:bg-[#171717] p-3.5`}
            >
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                {t('dashboardV2.mobile.netProfit')}
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  mobileKpis.netProfit >= 0
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {mobileKpis.netProfit >= 0 ? '+' : ''}
                {formatCurrency(mobileKpis.netProfit)}
              </p>
              <p
                className={`text-[10px] font-medium mt-0.5 ${
                  mobileKpis.netProfit >= 0
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-red-500 dark:text-red-400'
                }`}
              >
                {mobileKpis.netProfit >= 0
                  ? t('dashboardV2.mobile.efficient')
                  : t('dashboardV2.mobile.loss')}
              </p>
            </div>

            {/* Marj */}
            <div className="rounded-xl border-l-4 border-neutral-400/30 bg-white dark:bg-[#171717] p-3.5">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                {t('dashboardV2.mobile.margin')}
              </p>
              <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                {mobileKpis.margin != null ? `%${mobileKpis.margin}` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <ChannelBarChart
          title={mobileChartConfig.title}
          data={mobileChartData}
          loading={mobileChartLoading}
          revenueLabel={t('dashboardV2.chart.revenue')}
          costsLabel={mobileChartConfig.costsLabel}
        />

        {/* Quick Action Buttons */}
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

        {/* General Expenses — overview tab only */}
        {activeTab === 'overview' && (
          <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                {t('dashboardV2.overview.generalExpenses')}
              </h3>
              <button
                type="button"
                onClick={() => navigate('/finance/expenses')}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 transition-colors"
              >
                {t('dashboardV2.mobile.viewAll')}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {expensesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : generalExpenses.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center">
                {t('dashboardV2.overview.noExpenses')}
              </p>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {generalExpenses.map((item) => {
                  const CatIcon = CATEGORY_ICONS[item.category] || Wallet;
                  return (
                    <div
                      key={item.category}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                          <CatIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                        </div>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {t(`expenseCategories.${item.category}`, {
                            defaultValue: item.category,
                          })}
                        </span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== DESKTOP LAYOUT ===== */}
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
                leftIcon={<TrendingUp className="w-4 h-4" />}
                onClick={() => navigate('/finance/income')}
              >
                {t('finance:quickActions.addIncome')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<TrendingDown className="w-4 h-4" />}
                onClick={() => navigate('/finance/expenses')}
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

        <FinanceDashboardTabs activeTab={activeTab} onChange={handleTabChange} />

        {activeTab === 'overview' && <OverviewTab {...tabProps} />}
        {activeTab === 'work' && <WorkTab {...tabProps} />}
        {activeTab === 'subscriptions' && <SubscriptionsTab {...tabProps} />}
        {activeTab === 'sim' && <SimTab {...tabProps} />}
      </div>

      {/* QuickEntryModal — mobile quick actions */}
      <QuickEntryModal
        open={quickEntry.open}
        onClose={() => setQuickEntry({ open: false, direction: null })}
        direction={quickEntry.direction}
      />
    </PageContainer>
  );
}
