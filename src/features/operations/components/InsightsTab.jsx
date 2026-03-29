import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';
import { TrendingUp, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ChartTooltip } from '../../../components/ui/ChartTooltip';
import { useOperationsStats } from '../hooks';
import { useTheme } from '../../../hooks/themeContext';
import { REGIONS, CONTACT_STATUSES } from '../schema';
import { cn } from '../../../lib/utils';
import { CHART_COLORS } from '../../../lib/chartTheme';

// ── Period selector ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 'this_month',   labelKey: 'insights.thisMonth' },
  { value: 'last_month',   labelKey: 'insights.lastMonth' },
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

// ── Badge variant maps ───────────────────────────────────────────────────────

const CONTACT_VARIANT = {
  not_contacted: 'error',
  no_answer:     'warning',
  confirmed:     'success',
  cancelled:     'default',
};

const REGION_VARIANT = {
  istanbul_europe:   'info',
  istanbul_anatolia: 'primary',
  outside_istanbul:  'default',
};

// ── KPI card color map ───────────────────────────────────────────────────────

const KPI_COLORS = {
  warning: {
    wrapper: 'bg-warning-50 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
    value:   'text-warning-700 dark:text-warning-300',
  },
  info: {
    wrapper: 'bg-info-50 dark:bg-info-900/30 text-info-600 dark:text-info-400',
    value:   'text-info-700 dark:text-info-300',
  },
  success: {
    wrapper: 'bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    value:   'text-success-700 dark:text-success-300',
  },
  error: {
    wrapper: 'bg-error-50 dark:bg-error-900/30 text-error-600 dark:text-error-400',
    value:   'text-error-700 dark:text-error-300',
  },
  default: {
    wrapper: 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400',
    value:   'text-neutral-900 dark:text-neutral-50',
  },
};

// ── Bar chart colors by status ───────────────────────────────────────────────
// Sourced from CHART_COLORS — never hardcode hex in chart components.

const BAR_FILLS = {
  completed: CHART_COLORS.completed,   // green-500
  scheduled: CHART_COLORS.in_progress, // blue-500
  failed:    CHART_COLORS.expense,      // rose-500
  cancelled: CHART_COLORS.cancelled,   // gray-500
};

// ── Main component ───────────────────────────────────────────────────────────

export function InsightsTab() {
  const { t } = useTranslation('operations');
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [period, setPeriod] = useState('this_month');

  const { from: dateFrom, to: dateTo } = useMemo(() => getDateRange(period), [period]);
  const { data: stats, isLoading } = useOperationsStats(dateFrom, dateTo);

  // pool = real-time open request counts
  // period = historical counts for the selected date range
  const pool        = stats?.pool ?? {};
  const periodStats = stats?.period ?? {};

  const totalFinalized  = (periodStats.completed ?? 0) + (periodStats.failed ?? 0);
  const successRate     = totalFinalized > 0
    ? Math.round(((periodStats.completed ?? 0) / totalFinalized) * 100)
    : 0;

  const periodOptions = PERIOD_OPTIONS.map((p) => ({ value: p.value, label: t(p.labelKey) }));

  // Chart data — shows how the period's requests resolved
  const chartData = [
    { status: t('status.completed'), value: periodStats.completed ?? 0, fill: BAR_FILLS.completed },
    { status: t('status.scheduled'), value: periodStats.scheduled ?? 0, fill: BAR_FILLS.scheduled },
    { status: t('status.failed'),    value: periodStats.failed    ?? 0, fill: BAR_FILLS.failed    },
    { status: t('status.cancelled'), value: periodStats.cancelled ?? 0, fill: BAR_FILLS.cancelled },
  ];

  // Theme-aware chart infrastructure colors
  const gridStroke  = isDark ? '#262626' : CHART_COLORS.gridLight;
  const axisColor   = isDark ? '#737373' : '#6b7280';

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Period selector ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('insights.period')}:
        </span>
        <Select
          options={periodOptions}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          wrapperClassName="w-44"
        />
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
          {t('insights.generalStats')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard
            icon={Clock}
            label={t('insights.inPool')}
            value={pool.total_open ?? 0}
            variant="warning"
          />
          <KpiCard
            icon={TrendingUp}
            label={t('insights.scheduled')}
            value={periodStats.scheduled ?? 0}
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
            value={
              periodStats.avg_reschedules != null
                ? Number(periodStats.avg_reschedules).toFixed(1)
                : '0.0'
            }
            variant="default"
          />
        </div>
      </section>

      {/* ── Period breakdown chart ────────────────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
          {t('insights.periodBreakdown')}
        </h3>
        <Card className="p-5">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              barCategoryGap="35%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridStroke}
                vertical={false}
              />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 12, fill: axisColor }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={64}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ── Breakdown cards ───────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Regional breakdown */}
        <Card className="p-5">
          <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
            {t('insights.regionBreakdown')}
          </h4>
          <div className="space-y-3">
            {REGIONS.map((region) => {
              const count    = pool.by_region?.[region] ?? 0;
              const maxCount = Math.max(...REGIONS.map((r) => pool.by_region?.[r] ?? 0), 1);
              const pct      = Math.round((count / maxCount) * 100);
              return (
                <div key={region}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={REGION_VARIANT[region]} size="sm">
                      {t(`regions.${region}`)}
                    </Badge>
                    <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-neutral-400 dark:bg-neutral-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Contact status breakdown */}
        <Card className="p-5">
          <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
            {t('insights.contactBreakdown')}
          </h4>
          <div className="space-y-3">
            {CONTACT_STATUSES.filter((s) => s !== 'cancelled').map((status) => {
              // pool.not_contacted / pool.no_answer / pool.confirmed live directly on pool
              const count    = pool[status] ?? 0;
              const total    = (pool.total_open ?? 1);
              const pct      = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={CONTACT_VARIANT[status]} size="sm" dot>
                      {t(`contactStatus.${status}`)}
                    </Badge>
                    <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        status === 'confirmed'    && 'bg-success-500',
                        status === 'no_answer'    && 'bg-warning-500',
                        status === 'not_contacted'&& 'bg-error-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Period totals ─────────────────────────────────────────────────── */}
      <Card className="p-5">
        <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
          {t('insights.totalRequests')}
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-neutral-900 dark:text-neutral-50">
              {periodStats.total_requests ?? 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              {t('insights.totalRequests')}
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-success-600 dark:text-success-400">
              {periodStats.completed ?? 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              {t('status.completed')}
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight tabular-nums text-error-600 dark:text-error-400">
              {periodStats.failed ?? 0}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
              {t('status.failed')}
            </p>
          </div>
        </div>
      </Card>

    </div>
  );
}

// ── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, variant }) {
  const colors = KPI_COLORS[variant] ?? KPI_COLORS.default;

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        'bg-white dark:bg-[#171717]',
        'border-neutral-200 dark:border-[#262626]',
        'shadow-sm hover:shadow-md transition-shadow duration-150',
      )}
    >
      {/* Icon wrapper */}
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', colors.wrapper)}>
        <Icon className="w-5 h-5" />
      </div>
      {/* Value */}
      <p className={cn(
        'text-2xl font-bold tracking-tight tabular-nums leading-none mb-1',
        colors.value,
      )}>
        {value}
      </p>
      {/* Label */}
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1">
        {label}
      </p>
    </div>
  );
}
