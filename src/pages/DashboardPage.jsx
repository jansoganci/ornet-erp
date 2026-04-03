import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CreditCard,
  TrendingUp,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { PageContainer } from '../components/layout';
import { Skeleton, CardSkeleton } from '../components/ui';
import { cn } from '../lib/utils';
import { fetchFinanceDashboardKpis, financeDashboardKeys } from '../features/finance/api';
import { useSubscriptionStats, useCurrentProfile } from '../features/subscriptions/hooks';
import { useAuth } from '../hooks/useAuth';
import { KpiCard } from '../components/ui';
import { QuickActionsBar } from '../features/dashboard/components/QuickActionsBar';
import { TodayScheduleFeed } from '../features/dashboard/components/TodayScheduleFeed';
import { WorkOrderStatusDonut } from '../features/dashboard/components/WorkOrderStatusDonut';
import { TodayTaskChecklist } from '../features/dashboard/components/TodayTaskChecklist';
import { RevenueExpenseLineChart } from '../features/dashboard/components/RevenueExpenseLineChart';
import { OverduePaymentsList } from '../features/dashboard/components/OverduePaymentsList';
import { CurrencyWidget } from '../features/dashboard/components/CurrencyWidget';

/** Same MoM % logic as SubscriptionsListPage MRR card — plain KPI, no sparkline. */
function getMrrMomTrend(current, previous) {
  if (!previous || previous === 0) return null;
  const diff = current - previous;
  const percent = (diff / previous) * 100;
  const value = Math.abs(Math.round(percent));
  if (value === 0) return null;
  return { value, isPositive: diff > 0 };
}

export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();

  const { data: subStats, isLoading: isSubStatsLoading } = useSubscriptionStats();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: financeKpis, isLoading: isFinanceKpisLoading } = useQuery({
    queryKey: financeDashboardKeys.kpis(currentMonth, 'total'),
    queryFn: () => fetchFinanceDashboardKpis({ period: currentMonth, viewMode: 'total' }),
  });
  const { data: currentProfile } = useCurrentProfile();
  const isAdmin = currentProfile?.role === 'admin';

  const isInitialLoading = isSubStatsLoading || isFinanceKpisLoading;

  const unpaidTotal = subStats?.unpaid_total_amount ?? 0;
  const currencyFmt = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  });

  const mrrMom = getMrrMomTrend(
    Number(subStats?.mrr) || 0,
    Number(subStats?.mrr_previous_month) || 0,
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (isInitialLoading) {
    return (
      <PageContainer maxWidth="full" padding="compact" className="space-y-5">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <CardSkeleton count={4} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <CardSkeleton count={1} className="h-80" />
          </div>
          <div className="lg:col-span-4 flex flex-col gap-4">
            <CardSkeleton count={1} className="h-64" />
            <CardSkeleton count={1} className="min-h-[12rem]" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <CardSkeleton count={1} className="h-64" />
          </div>
          <div className="lg:col-span-4">
            <CardSkeleton count={1} className="h-64" />
          </div>
        </div>
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

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
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
        <div className="w-full md:w-auto md:flex-shrink-0">
          <CurrencyWidget />
        </div>
      </div>

      {/* Row 1 — four KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-stretch">
        <KpiCard
          className="h-full"
          title={t('kpi.activeSubscriptions')}
          value={subStats?.active_count ?? 0}
          icon={CreditCard}
          trendType="neutral"
          href="/subscriptions"
          loading={isSubStatsLoading}
        />
        <KpiCard
          className="h-full"
          title={t('kpi.subscriptionRevenue')}
          value={currencyFmt.format(subStats?.mrr ?? 0)}
          icon={TrendingUp}
          trend={
            mrrMom ? `${mrrMom.isPositive ? '+' : '-'}${mrrMom.value}%` : undefined
          }
          trendType={
            mrrMom?.isPositive ? 'up' : mrrMom ? 'down' : 'neutral'
          }
          href="/subscriptions"
          loading={isSubStatsLoading}
        />
        <KpiCard
          className={cn(
            'h-full',
            unpaidTotal > 0 && 'border-l-4 border-l-red-500 dark:border-l-red-500',
          )}
          title={t('kpi.uncollectedPayments')}
          value={currencyFmt.format(unpaidTotal)}
          icon={AlertCircle}
          trendType="down"
          variant="default"
          href="/subscriptions"
          loading={isSubStatsLoading}
        />
        <KpiCard
          className="h-full"
          title={t('kpi.netProfit')}
          value={currencyFmt.format(financeKpis?.netProfit ?? 0)}
          icon={DollarSign}
          trendType="neutral"
          href="/finance"
          loading={isFinanceKpisLoading}
        />
      </div>

      {/* Row 2 — revenue/expense chart + donut + today tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:auto-rows-fr">
        <div className="lg:col-span-8 flex min-h-0">
          <div className="flex-1 min-h-0 w-full">
            <RevenueExpenseLineChart />
          </div>
        </div>
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
          <div className="flex-shrink-0 min-h-0">
            <WorkOrderStatusDonut />
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            <TodayTaskChecklist />
          </div>
        </div>
      </div>

      {/* Row 3 — schedule + overdue payments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 min-h-0">
          <TodayScheduleFeed />
        </div>
        <div className="lg:col-span-4 min-h-0">
          <OverduePaymentsList />
        </div>
      </div>

    </PageContainer>
  );
}
