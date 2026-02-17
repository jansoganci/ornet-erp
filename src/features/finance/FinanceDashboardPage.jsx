import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Percent,
  Receipt,
  Package,
  ChevronRight,
  CardSim,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { PageContainer, PageHeader } from '../../components/layout';
import { Card, Select, Spinner, ErrorState } from '../../components/ui';
import {
  useFinanceDashboardKpis,
  useRevenueExpensesByMonth,
  useExpenseByCategory,
  useRecentTransactions,
} from './hooks';
import { KpiCard } from './components/KpiCard';
import { ViewModeToggle } from './components/ViewModeToggle';
import { formatDate, formatCurrency } from '../../lib/utils';

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

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function FinanceDashboardPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();

  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [viewMode, setViewMode] = useState('total');

  const monthOptions = useMemo(() => getLast6Months(), []);

  const { data: kpis, isLoading: kpisLoading, error: kpisError, refetch } = useFinanceDashboardKpis({ period, viewMode });
  const { data: revenueExpenses = [], isLoading: chartLoading } = useRevenueExpensesByMonth({ months: 6, viewMode });
  const { data: expenseByCat = [], isLoading: pieLoading } = useExpenseByCategory({ period, viewMode });
  const { data: recentTransactions = [] } = useRecentTransactions(10);

  const pieData = useMemo(
    () =>
      expenseByCat.map((item, i) => ({
        ...item,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [expenseByCat]
  );

  if (kpisError) {
    return (
      <PageContainer>
        <PageHeader title={t('finance:dashboard.title')} />
        <ErrorState message={kpisError.message} onRetry={refetch} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={t('finance:dashboard.title')} />

      <Card className="p-4 shadow-sm border-neutral-200/60 dark:border-neutral-800/60 mb-6">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="w-full md:w-40">
            <Select
              label={t('finance:filters.period')}
              options={monthOptions}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <ViewModeToggle value={viewMode} onChange={setViewMode} size="md" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          title={t('finance:dashboard.mrr')}
          value={formatCurrency(kpis?.mrr ?? 0)}
          icon={TrendingUp}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.arpc')}
          value={formatCurrency(kpis?.arpc ?? 0)}
          icon={Users}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.grossMargin')}
          value={
            kpis?.grossMarginPct != null
              ? `${kpis.grossMarginPct}%`
              : '-'
          }
          icon={Percent}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.netProfit')}
          value={formatCurrency(kpis?.netProfit ?? 0)}
          icon={TrendingDown}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.vatPayable')}
          value={formatCurrency(kpis?.vatPayable ?? 0)}
          icon={Receipt}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.materialCostPct')}
          value={
            kpis?.materialCostPct != null
              ? `${kpis.materialCostPct}%`
              : '-'
          }
          icon={Package}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.simNetProfit')}
          value={formatCurrency(kpis?.simNetProfit ?? 0)}
          icon={CardSim}
          loading={kpisLoading}
        />
        <KpiCard
          title={t('finance:dashboard.subscriptionNetProfit')}
          value={formatCurrency(kpis?.subscriptionNetProfit ?? 0)}
          icon={Repeat}
          loading={kpisLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-4">
          <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4">
            {t('finance:dashboard.revenueVsExpenses')}
          </h3>
          {chartLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : revenueExpenses.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">
              {t('common:empty.noData')}
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueExpenses} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-[#262626]" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" name={t('finance:list.titleIncome')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name={t('finance:list.title')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4">
            {t('finance:dashboard.expenseByCategory')}
          </h3>
          {pieLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">
              {t('common:empty.noData')}
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
            {t('finance:dashboard.recentTransactions')}
          </h3>
          <button
            type="button"
            onClick={() => navigate('/finance/income')}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
          >
            {t('finance:list.titleIncome')}
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 text-sm">
            {t('common:empty.noData')}
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => {
              const isIncome = tx.direction === 'income';
              const label =
                isIncome
                  ? t(`finance:income.incomeTypes.${tx.source_type}`, { defaultValue: tx.source_type })
                  : t(`finance:expenseCategories.${tx.source_type}`, { defaultValue: tx.source_type });
              return (
                <div
                  key={`${tx.source_id}-${tx.source_type}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900/50 cursor-pointer transition-colors"
                  onClick={() =>
                    navigate(isIncome ? '/finance/income' : '/finance/expenses')
                  }
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-neutral-900 dark:text-neutral-50">
                      {formatDate(tx.period_date || tx.created_at)}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                      {label}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      isIncome ? 'text-success-600' : 'text-error-600'
                    }`}
                  >
                    {isIncome ? '+' : ''}
                    {formatCurrency(tx.amount_try ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
