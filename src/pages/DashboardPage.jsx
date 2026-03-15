import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CalendarCheck,
  CreditCard,
  TrendingUp,
  AlertCircle,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { PageContainer } from '../components/layout';
import { Skeleton, CardSkeleton } from '../components/ui';
import { cn } from '../lib/utils';
import { formatTL } from '../lib/chartTheme';
import {
  useDashboardStats,
  useMonthlyRevenue,
} from '../features/dashboard/hooks';
import { useSimFinancialStats } from '../features/simCards/hooks';
import { useSubscriptionStats, useCurrentProfile } from '../features/subscriptions/hooks';
import { useActionBoardCounts } from '../features/actionBoard/hooks';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { KPIStatCard } from '../features/dashboard/components/KPIStatCard';
import { SparklineStatCard } from '../features/dashboard/components/SparklineStatCard';
import { QuickActionsBar } from '../features/dashboard/components/QuickActionsBar';
import { TodayScheduleFeed } from '../features/dashboard/components/TodayScheduleFeed';
import { WorkOrderStatusDonut } from '../features/dashboard/components/WorkOrderStatusDonut';
import { TodayTaskChecklist } from '../features/dashboard/components/TodayTaskChecklist';
import { RevenueExpenseLineChart } from '../features/dashboard/components/RevenueExpenseLineChart';
import { OverduePaymentsList } from '../features/dashboard/components/OverduePaymentsList';
import { CurrencyWidget } from '../features/dashboard/components/CurrencyWidget';

// ── Action Board doorbell (admin only) ────────────────────────────────────

function ActionBoardCard({ lateWorkOrderCount, overduePaymentCount, pendingProposalCount, isLoading, isError }) {
  const { t } = useTranslation('actionBoard');
  const navigate = useNavigate();

  const total = lateWorkOrderCount + overduePaymentCount + pendingProposalCount;

  // Rule 1: loading or all-clear → render nothing
  if (isLoading || (!isError && total === 0)) return null;

  // Build specific message parts in order: work orders · proposals · payments
  const parts = [];
  if (lateWorkOrderCount  > 0) parts.push(t('dashboard.lateWorkOrders',  { count: lateWorkOrderCount }));
  if (pendingProposalCount > 0) parts.push(t('dashboard.pendingProposals', { count: pendingProposalCount }));
  if (overduePaymentCount  > 0) parts.push(t('dashboard.overduePayments',  { count: overduePaymentCount }));

  return (
    <button
      type="button"
      onClick={() => navigate('/action-board')}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-5 text-left',
        'transition-all duration-150 hover:-translate-y-px',
        'w-full lg:w-auto',
        isError
          ? [
              'bg-amber-50 border-amber-200',
              'dark:bg-amber-950/20 dark:border-amber-900/50',
              'hover:bg-amber-50/80 dark:hover:bg-amber-950/30',
            ]
          : [
              'border-l-4 border-l-red-500',
              'bg-red-50 border-red-200',
              'dark:bg-red-950/20 dark:border-red-900/50 dark:border-l-red-500',
              'hover:bg-red-50/80 dark:hover:bg-red-950/30',
            ]
      )}
    >
      <AlertCircle className={cn(
        'w-4 h-4 flex-shrink-0',
        isError
          ? 'text-amber-500 dark:text-amber-400'
          : 'text-red-500 dark:text-red-400 alert-accent-border'
      )} />

      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500 mb-1">
          {t('dashboard.title')}
        </p>
        <p className="text-sm font-medium text-red-700 dark:text-red-400 truncate">
          {isError ? t('dashboard.loadError') : parts.join(' · ')}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-neutral-400 dark:text-neutral-500 flex-shrink-0 ml-auto" />
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();

  const { data: stats, isLoading: isStatsLoading } = useDashboardStats();
  const { data: subStats, isLoading: isSubStatsLoading } = useSubscriptionStats();
  const { data: simStats, isLoading: isSimStatsLoading } = useSimFinancialStats();
  const { data: monthlyRevenue, isLoading: isRevenueLoading } = useMonthlyRevenue(7);
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';
  const {
    lateWorkOrderCount,
    overduePaymentCount,
    pendingProposalCount,
    isLoading: isActionLoading,
    isError: isActionError,
  } = useActionBoardCounts();

  const isInitialLoading = isStatsLoading || isSubStatsLoading || isSimStatsLoading;

  // ── Build real sparkline data from monthly revenue ────────────────────────
  const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const revenueChartData = Array.isArray(monthlyRevenue)
    ? monthlyRevenue.map((row) => {
        const monthIndex = parseInt(row.month?.split('-')[1], 10) - 1;
        return { name: TR_MONTHS_SHORT[monthIndex] ?? row.month, value: Number(row.revenue) };
      })
    : [];

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (isInitialLoading) {
    return (
      <PageContainer maxWidth="full" padding="compact" className="space-y-5">
        <Skeleton className="h-5 w-48" />
        {/* KPI strip skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <CardSkeleton count={6} />
        </div>
        {/* Sparkline row skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <CardSkeleton count={3} />
        </div>
        {/* Quick actions skeleton */}
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-lg flex-shrink-0" />
          ))}
        </div>
        {/* Zone B — Feed + Donut skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <CardSkeleton count={1} className="h-64" />
          </div>
          <div className="lg:col-span-4">
            <CardSkeleton count={1} className="h-64" />
          </div>
        </div>
        {/* Zone E — Checklist + Overdue skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6">
            <CardSkeleton count={1} className="h-48" />
          </div>
          <div className="lg:col-span-6">
            <CardSkeleton count={1} className="h-48" />
          </div>
        </div>
        {/* Zone F — Revenue chart skeleton */}
        <CardSkeleton count={1} className="h-56" />
      </PageContainer>
    );
  }

  // ── Greeting ─────────────────────────────────────────────────────────────

  const formattedToday = new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t('greeting.morning')
    : hour < 17
    ? t('greeting.afternoon')
    : t('greeting.evening');

  const userName = user?.email?.split('@')[0] || tCommon('labels.admin');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="full" padding="compact" className="space-y-5">

      {/* ── Welcome + Currency + Shortcuts ───────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 leading-snug">
            {greeting}, {userName}
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
            {formattedToday}
          </p>
          <div className="mt-2">
            <QuickActionsBar isAdmin={isAdmin} />
          </div>
        </div>
        <CurrencyWidget />
      </div>

      {/* ── ZONE A — KPI Strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KPIStatCard
          title={t('kpi.overdueWorkOrders')}
          value={stats?.pending_work_orders ?? 0}
          icon={AlertTriangle}
          trendType="up"
          trendChange={stats?.pending_work_orders > 0
            ? `${stats.pending_work_orders} ${t('kpi.waitingLabel')}`
            : undefined}
          variant={stats?.pending_work_orders > 0 ? 'alert' : 'default'}
          href="/work-orders?status=pending"
          loading={isStatsLoading}
        />
        <KPIStatCard
          title={t('kpi.todayPlanned')}
          value={stats?.today_work_orders ?? 0}
          icon={CalendarCheck}
          trendType="neutral"
          href="/daily-work"
          loading={isStatsLoading}
        />
        <KPIStatCard
          title={t('kpi.activeSubscriptions')}
          value={subStats?.active_count ?? 0}
          icon={CreditCard}
          trendType="neutral"
          href="/subscriptions"
          loading={isSubStatsLoading}
        />
        <KPIStatCard
          title={t('kpi.mrr')}
          value={new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            maximumFractionDigits: 0,
          }).format(subStats?.mrr ?? 0)}
          icon={TrendingUp}
          trendType="up"
          href="/subscriptions"
          loading={isSubStatsLoading}
        />
        <KPIStatCard
          title={t('kpi.uncollectedPayments')}
          value={new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            maximumFractionDigits: 0,
          }).format(subStats?.unpaid_total_amount ?? 0)}
          icon={AlertCircle}
          trendType="down"
          variant={(subStats?.unpaid_total_amount ?? 0) > 0 ? 'alert' : 'default'}
          href="/subscriptions"
          loading={isSubStatsLoading}
        />
        <KPIStatCard
          title={t('kpi.netProfit')}
          value={formatTL(simStats?.total_monthly_profit ?? 0)}
          icon={DollarSign}
          trendType="up"
          href="/finance"
          loading={isSimStatsLoading}
        />
      </div>

      {/* ── ZONE C — Sparkline Financial Cards ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <SparklineStatCard
          title={t('sparkline.monthlyRevenue')}
          value={new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            maximumFractionDigits: 0,
          }).format(simStats?.total_monthly_profit ?? 0)}
          change="+12.4%"
          changeType="positive"
          icon={DollarSign}
          formatter={formatTL}
          loading={isSimStatsLoading || isRevenueLoading}
          chartData={revenueChartData.length > 0 ? revenueChartData : [
            { name: 'Eyl', value: 62000 },
            { name: 'Eki', value: 71000 },
            { name: 'Kas', value: 68000 },
            { name: 'Ara', value: 75000 },
            { name: 'Oca', value: 80000 },
            { name: 'Şub', value: 78000 },
            { name: 'Mar', value: simStats?.total_monthly_profit ?? 84200 },
          ]}
        />
        <SparklineStatCard
          title={t('sparkline.subscriptions')}
          value={subStats?.active_count ?? 0}
          change="+5"
          changeType="positive"
          icon={CreditCard}
          loading={isSubStatsLoading}
          chartData={[
            { name: 'Eyl', value: 210 },
            { name: 'Eki', value: 215 },
            { name: 'Kas', value: 218 },
            { name: 'Ara', value: 220 },
            { name: 'Oca', value: 224 },
            { name: 'Şub', value: 226 },
            { name: 'Mar', value: subStats?.active_count ?? 231 },
          ]}
        />
        <SparklineStatCard
          title={t('sparkline.mrrTrend')}
          value={new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            maximumFractionDigits: 0,
          }).format(subStats?.mrr ?? 0)}
          change="+8.2%"
          changeType="positive"
          icon={TrendingUp}
          formatter={formatTL}
          loading={isSubStatsLoading}
          chartData={[
            { name: 'Eyl', value: 45000 },
            { name: 'Eki', value: 47000 },
            { name: 'Kas', value: 48500 },
            { name: 'Ara', value: 50000 },
            { name: 'Oca', value: 52000 },
            { name: 'Şub', value: 53500 },
            { name: 'Mar', value: subStats?.mrr ?? 55200 },
          ]}
        />
      </div>

      {/* Action Board doorbell — admin only, hidden when all clear */}
      {isAdmin && (
        <ActionBoardCard
          lateWorkOrderCount={lateWorkOrderCount}
          overduePaymentCount={overduePaymentCount}
          pendingProposalCount={pendingProposalCount}
          isLoading={isActionLoading}
          isError={isActionError}
        />
      )}

      {/* ── ZONE B — Schedule feed + Donut ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <TodayScheduleFeed />
        </div>
        <div className="lg:col-span-4">
          <WorkOrderStatusDonut />
        </div>
      </div>

      {/* ── ZONE E — Task checklist + Overdue payments ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6">
          <TodayTaskChecklist />
        </div>
        <div className="lg:col-span-6">
          <OverduePaymentsList />
        </div>
      </div>

      {/* ── ZONE F — Revenue / Expense line chart ────────────────────────── */}
      <RevenueExpenseLineChart />

    </PageContainer>
  );
}
