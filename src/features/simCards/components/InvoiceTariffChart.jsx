import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../../../components/ui';
import { formatCurrency } from '../../../lib/utils';
import { useTheme } from '../../../hooks/themeContext';

const CHART_COLORS = {
  count: '#6366f1',
  amount: '#22c55e',
};

function truncate(str, max = 20) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '…';
}

export function InvoiceTariffChart({ tariffBreakdown }) {
  const { t } = useTranslation('invoiceAnalysis');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const tickColor = isDark ? '#737373' : '#737373';
  const gridColor = isDark ? '#262626' : '#e5e5e5';
  const tooltipBg = isDark ? '#171717' : '#ffffff';
  const tooltipBorder = isDark ? '#262626' : '#e5e5e5';
  const tooltipText = isDark ? '#f5f5f5' : '#171717';

  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 8,
    color: tooltipText,
    fontSize: 12,
  };

  // Convert Map to sorted array (by count desc)
  const chartData = Array.from(tariffBreakdown.entries())
    .map(([tariff, { count, total }]) => ({
      tariff: truncate(tariff),
      fullTariff: tariff,
      count,
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card className="p-5 mb-6 border-neutral-200/60 dark:border-neutral-800/60">
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 mb-5">
        {t('chart.title')}
      </h3>

      {chartData.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">{t('chart.noData')}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Count per tariff */}
          <div>
            <p className="text-xs uppercase font-bold text-neutral-400 tracking-wider mb-3">
              {t('chart.byCount')}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="tariff" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name, props) => [value, props.payload.fullTariff]}
                  labelFormatter={() => ''}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="count" fill={CHART_COLORS.count} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Total amount per tariff */}
          <div>
            <p className="text-xs uppercase font-bold text-neutral-400 tracking-wider mb-3">
              {t('chart.byAmount')}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 8, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="tariff" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name, props) => [formatCurrency(value), props.payload.fullTariff]}
                  labelFormatter={() => ''}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="total" fill={CHART_COLORS.amount} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}
