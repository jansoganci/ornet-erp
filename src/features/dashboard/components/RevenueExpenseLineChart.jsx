import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ChartTooltip } from '../../../components/ui/ChartTooltip';
import { CHART_COLORS, formatTL } from '../../../lib/chartTheme';
import { useMonthlyRevenue } from '../hooks';

// ── Month label helpers ─────────────────────────────────────────────────────

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function monthLabel(yyyyMM) {
  const parts = yyyyMM?.split('-');
  if (!parts || parts.length < 2) return yyyyMM ?? '';
  const monthIndex = parseInt(parts[1], 10) - 1;
  return TR_MONTHS[monthIndex] ?? yyyyMM;
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-40 w-full rounded" />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

/**
 * RevenueExpenseLineChart — Line chart showing monthly income vs. expense.
 * Data source: useMonthlyRevenue() → get_monthly_revenue_expense(7)
 * Two lines: revenue (green) and expense (red).
 */
export function RevenueExpenseLineChart() {
  const { t } = useTranslation('dashboard');
  const { data: raw, isLoading } = useMonthlyRevenue(7);

  const chartData = Array.isArray(raw)
    ? raw.map((row) => ({
        name: monthLabel(row.month),
        revenue: Number(row.revenue),
        expense: Number(row.expense),
      }))
    : [];

  return (
    <div className="rounded-xl border overflow-hidden bg-white border-gray-200 dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
          {t('sections.revenueChart')}
        </h3>
      </div>

      {/* Body */}
      {isLoading ? (
        <ChartSkeleton />
      ) : (
        <div className="px-2 py-4">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_COLORS.grid}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis
                tickFormatter={(v) => formatTL(v)}
                tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v) => formatTL(v)}
                    labelFormatter={(label) => label}
                  />
                }
              />
              <Legend
                iconType="circle"
                iconSize={6}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value) =>
                  value === 'revenue' ? t('chart.revenue') : t('chart.expense')
                }
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={CHART_COLORS.profit}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke={CHART_COLORS.expense}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
