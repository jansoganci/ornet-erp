import { useId } from 'react';
import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SparklineTooltip } from '../../../components/ui/ChartTooltip';
import { SPARKLINE_COLORS } from '../../../lib/chartTheme';

/**
 * SparklineStatCard — Financial metric card with embedded mini sparkline chart.
 *
 * Use for: revenue totals, MRR, subscription counts — metrics with time-series history.
 * Do NOT use for simple operational counts — use KPIStatCard for those.
 *
 * Props:
 *   title        — card label (translated string)
 *   value        — formatted metric value, e.g. "₺84,200"
 *   change       — delta string shown below value, e.g. "+20.1%"
 *   changeType   — 'positive' | 'negative'  (drives sparkline + delta color)
 *   icon         — Lucide icon component
 *   chartData    — Array<{ name: string, value: number }>  (7 data points recommended)
 *   formatter    — optional fn(value) → string for tooltip formatting
 *   loading      — shows skeleton when true
 *   className    — additional classes for the card wrapper
 */
export function SparklineStatCard({
  title,
  value,
  change,
  changeType = 'positive',
  icon: Icon,
  chartData,
  formatter,
  loading = false,
  className,
}) {
  // Unique id per instance — prevents linearGradient id collisions in the DOM
  const uid = useId();
  const gradientId = `sparkGrad-${uid.replace(/:/g, '')}`;

  const isPositive = changeType === 'positive';
  const lineColor = isPositive ? SPARKLINE_COLORS.positive : SPARKLINE_COLORS.negative;
  const changeColor = isPositive
    ? 'text-green-500 dark:text-green-400'
    : 'text-red-500 dark:text-red-400';

  const hasData = Array.isArray(chartData) && chartData.length > 0;

  // ── Skeleton state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn(
        'rounded-xl border p-5',
        'bg-white border-gray-200',
        'dark:bg-gray-800/40 dark:border-white/10 dark:backdrop-blur-sm',
        className
      )}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-12 w-28 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      // Base
      'rounded-xl border p-5 relative overflow-hidden',
      'transition-all duration-150 hover:-translate-y-px',

      // Glass surface — same token as KPIStatCard
      'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300',
      'dark:bg-gray-800/40 dark:backdrop-blur-sm dark:border-white/10',
      'dark:hover:bg-gray-800/60 dark:hover:border-white/20',

      className
    )}>
      {/* Header row: label + icon */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-500 truncate pr-2">
          {title}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 flex-shrink-0 text-neutral-400 dark:text-neutral-600" />
        )}
      </div>

      {/* Bottom row: value+delta on left, sparkline on right */}
      <div className="flex items-end justify-between gap-2">

        {/* Left: value + change */}
        <div className="min-w-0">
          <p
            className="text-2xl font-semibold tracking-tighter text-neutral-900 dark:text-neutral-50 tabular-nums leading-none mb-1.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </p>
          {change && (
            <span className={cn('text-xs font-medium delta-badge inline-block', changeColor)}>
              {change}
            </span>
          )}
        </div>

        {/* Right: sparkline */}
        {hasData && (
          <div className="h-12 w-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={lineColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={<SparklineTooltip formatter={formatter} />}
                  cursor={{
                    stroke: 'rgba(255,255,255,0.08)',
                    strokeWidth: 1,
                    strokeDasharray: '3 3',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
