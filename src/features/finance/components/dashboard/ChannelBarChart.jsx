import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Spinner } from '../../../../components/ui/Spinner';
import { useTheme } from '../../../../hooks/themeContext';
import { CHART_COLORS, formatTL } from '../../../../lib/chartTheme';
import { formatCurrency } from '../../../../lib/utils';

const MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function formatPeriodLabel(period) {
  const parts = period.split('-');
  if (parts.length < 2) return period;
  const monthIdx = parseInt(parts[1], 10) - 1;
  return MONTH_SHORT[monthIdx] || period;
}

export function ChannelBarChart({ title, data = [], loading = false, revenueLabel, costsLabel }) {
  const { t } = useTranslation('finance');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const tooltipStyle = isDark
    ? { backgroundColor: '#171717', border: '1px solid #262626', color: '#f5f5f5' }
    : undefined;

  const chartData = data.map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period),
  }));

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4">{title}</p>
        <div className="h-48 md:h-64 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  const hasData = chartData.some((d) => d.revenue > 0 || d.costs > 0);

  if (!hasData) {
    return (
      <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4">{title}</p>
        <div className="h-48 md:h-64 flex items-center justify-center text-neutral-500 text-sm">
          {t('dashboardV2.noDataGeneral')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 bg-white dark:bg-[#171717] p-4">
      <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-4">{title}</p>
      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-[#262626]" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTL} />
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={tooltipStyle} />
            <Legend />
            <Bar
              dataKey="revenue"
              name={revenueLabel || t('dashboardV2.chart.revenue')}
              fill={CHART_COLORS.revenue}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="costs"
              name={costsLabel || t('dashboardV2.chart.costs')}
              fill={CHART_COLORS.expense}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
